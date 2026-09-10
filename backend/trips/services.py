"""
trips/services.py

Pure Python service functions for the ELD Trip Planner:
  - get_route: geocode addresses + fetch ORS driving directions
  - build_hos_schedule: simulate HOS segments per FMCSA rules
  - split_by_day: split/group segments by calendar date with 24hr totals
"""

import math
from datetime import datetime, timedelta

import requests
from decouple import config

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
METERS_PER_MILE = 1609.344
ORS_BASE = "https://api.openrouteservice.org"

# HOS limits (FMCSA property-carrying rules)
MAX_DRIVING_PER_SHIFT = 11.0       # hours
MAX_SHIFT_WINDOW = 14.0            # hours since start of shift
BREAK_TRIGGER_HOURS = 8.0         # cumulative driving before mandatory break
BREAK_DURATION_HOURS = 0.5        # 30-minute break
REST_DURATION_HOURS = 10.0        # normal daily rest
RESTART_DURATION_HOURS = 34.0     # 34-hour restart
MAX_CYCLE_HOURS = 70.0            # 70-hr/8-day cycle
FUEL_STOP_INTERVAL_MILES = 1000.0 # miles between fuel stops
FUEL_STOP_DURATION_HOURS = 0.5    # 30-minute fuel stop

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_ors_api_key() -> str:
    key = config('ORS_API_KEY', default='')
    if not key:
        raise ValueError(
            "ORS_API_KEY is not set. Add it to your .env file."
        )
    return key


def _geocode(address: str, api_key: str) -> tuple[float, float]:
    """
    Geocode a single address using ORS geocoding endpoint.

    Returns (longitude, latitude) as expected by ORS Directions.
    Raises ValueError if the address cannot be geocoded.
    """
    url = f"{ORS_BASE}/geocode/search"
    params = {
        "api_key": api_key,
        "text": address,
        "size": 1,
    }
    try:
        resp = requests.get(url, params=params, timeout=10)
        resp.raise_for_status()
    except requests.RequestException as exc:
        raise ValueError(
            f"Geocoding request failed for '{address}': {exc}"
        ) from exc

    data = resp.json()
    features = data.get("features", [])
    if not features:
        raise ValueError(
            f"Could not geocode address '{address}'. "
            "No results returned from OpenRouteService."
        )

    # ORS returns [longitude, latitude]
    coords = features[0]["geometry"]["coordinates"]
    return coords[0], coords[1]   # (lng, lat)


# ---------------------------------------------------------------------------
# 1. get_route
# ---------------------------------------------------------------------------

def get_route(
    current_location: str,
    pickup_location: str,
    dropoff_location: str,
) -> dict:
    """
    Geocode the three addresses and fetch a driving route from ORS.

    Returns:
        {
            "distance_miles": float,
            "duration_hours": float,
            "geometry": [[lat, lng], ...],
            "waypoints": [
                {"label": "current", "lat": float, "lng": float},
                {"label": "pickup",  "lat": float, "lng": float},
                {"label": "dropoff", "lat": float, "lng": float},
            ]
        }

    Raises:
        ValueError: if any address cannot be geocoded or the ORS call fails.
    """
    api_key = _get_ors_api_key()

    # Geocode all three addresses
    locations = {}
    for label, address in [
        ("current", current_location),
        ("pickup",  pickup_location),
        ("dropoff", dropoff_location),
    ]:
        lng, lat = _geocode(address, api_key)
        locations[label] = {"label": label, "lat": lat, "lng": lng}

    # ORS Directions expects [[lng, lat], ...]
    coordinates = [
        [locations["current"]["lng"],  locations["current"]["lat"]],
        [locations["pickup"]["lng"],   locations["pickup"]["lat"]],
        [locations["dropoff"]["lng"],  locations["dropoff"]["lat"]],
    ]

    url = f"{ORS_BASE}/v2/directions/driving-car"
    headers = {
        "Authorization": api_key,
        "Content-Type": "application/json",
        "Accept": "application/json, application/geo+json",
    }
    body = {
        "coordinates": coordinates,
        "instructions": False,
        "geometry": True,
    }

    try:
        resp = requests.post(url, json=body, headers=headers, timeout=30)
        resp.raise_for_status()
    except requests.RequestException as exc:
        raise ValueError(
            f"ORS Directions API request failed: {exc}"
        ) from exc

    data = resp.json()

    try:
        route = data["routes"][0]
        summary = route["summary"]
        distance_meters = summary["distance"]
        duration_seconds = summary["duration"]

        # Decode geometry — ORS returns encoded polyline or coordinate array
        # When geometry=True and format is JSON, coordinates come as a list
        geometry_raw = route.get("geometry", {})
        if isinstance(geometry_raw, dict):
            # GeoJSON LineString — coordinates are [lng, lat]
            raw_coords = geometry_raw.get("coordinates", [])
            # Convert to [[lat, lng], ...]
            geometry = [[c[1], c[0]] for c in raw_coords]
        elif isinstance(geometry_raw, str):
            # Encoded polyline — decode it
            geometry = _decode_polyline(geometry_raw)
        else:
            geometry = []

    except (KeyError, IndexError) as exc:
        raise ValueError(
            f"Unexpected ORS Directions response structure: {exc}\n"
            f"Response: {data}"
        ) from exc

    return {
        "distance_miles": round(distance_meters / METERS_PER_MILE, 2),
        "duration_hours": round(duration_seconds / 3600, 4),
        "geometry": geometry,
        "waypoints": [
            locations["current"],
            locations["pickup"],
            locations["dropoff"],
        ],
    }


def _decode_polyline(encoded: str) -> list[list[float]]:
    """Decode a Google-style encoded polyline string into [[lat, lng], ...]."""
    coords = []
    index = 0
    lat = 0
    lng = 0
    while index < len(encoded):
        # Latitude
        result = 0
        shift = 0
        while True:
            b = ord(encoded[index]) - 63
            index += 1
            result |= (b & 0x1F) << shift
            shift += 5
            if b < 0x20:
                break
        dlat = ~(result >> 1) if (result & 1) else (result >> 1)
        lat += dlat

        # Longitude
        result = 0
        shift = 0
        while True:
            b = ord(encoded[index]) - 63
            index += 1
            result |= (b & 0x1F) << shift
            shift += 5
            if b < 0x20:
                break
        dlng = ~(result >> 1) if (result & 1) else (result >> 1)
        lng += dlng

        coords.append([lat / 1e5, lng / 1e5])
    return coords


# ---------------------------------------------------------------------------
# 2. _run_hos_loop  (shared core — used by both public schedule builders)
# ---------------------------------------------------------------------------

def _run_hos_loop(
    total_driving_hours: float,
    total_distance_miles: float,
    current_cycle_used: float,
    start_time: datetime,
    pickup_label: str,
    dropoff_label: str,
) -> list[dict]:
    """
    Core HOS scheduling engine.  Returns a list of segment dicts
    {status, start, end, location}.

    FIX (v2): The 14-hour shift window is now correctly initialised to
    account for the 1-hour pickup on-duty segment that is inserted before
    the first shift begins.  Without this, the first shift enjoyed an
    effective 15-hour window (1hr pickup + 14hr window) instead of 14 hours.

    The rest-duration constant REST_DURATION_HOURS is exactly 10.0 h and is
    never modified inside the loop, so every off-duty rest block is always
    >= 10 consecutive hours.
    """
    segments: list[dict] = []
    current_time = start_time

    # ------------------------------------------------------------------
    # Pre-compute fuel stop insertion points (in cumulative driving hours)
    # ------------------------------------------------------------------
    miles_per_driving_hour = (
        total_distance_miles / total_driving_hours
        if total_driving_hours > 0 else 55.0
    )
    fuel_stops_hours: list[float] = []
    if total_distance_miles >= FUEL_STOP_INTERVAL_MILES:
        num_fuel_stops = int(total_distance_miles / FUEL_STOP_INTERVAL_MILES)
        for i in range(1, num_fuel_stops + 1):
            stop_mile = i * FUEL_STOP_INTERVAL_MILES
            if stop_mile < total_distance_miles:
                fuel_stops_hours.append(stop_mile / miles_per_driving_hour)

    # ------------------------------------------------------------------
    # State
    # ------------------------------------------------------------------
    driving_hours_remaining = total_driving_hours
    driving_hours_elapsed = 0.0        # total driving done so far
    cycle_hours = current_cycle_used

    fuel_stop_index = 0
    next_fuel_at = (
        fuel_stops_hours[0] if fuel_stops_hours else math.inf
    )

    def _add(status: str, hours: float, location: str) -> None:
        nonlocal current_time, cycle_hours
        seg_start = current_time
        seg_end = current_time + timedelta(hours=hours)
        segments.append({
            "status": status,
            "start": seg_start,
            "end": seg_end,
            "location": location,
        })
        current_time = seg_end
        if status in ("driving", "on_duty_not_driving"):
            cycle_hours += hours

    # ------------------------------------------------------------------
    # 1. Pickup (on-duty, not driving) — 1 hour
    #    This consumes 1 hour of the 14-hour shift window on the first
    #    shift, so we pre-load hours_since_shift_start = 1.0 for shift 1.
    # ------------------------------------------------------------------
    _add("on_duty_not_driving", 1.0, pickup_label)

    # ------------------------------------------------------------------
    # 2. Main driving loop
    # ------------------------------------------------------------------
    first_shift = True          # tracks whether this is the initial shift
    while driving_hours_remaining > 0.001:
        # Start a new shift.
        # FIX: on the very first shift the 14-hr window has already had
        # 1 hour consumed by the pickup segment.  Subsequent shifts start
        # fresh (the driver completed a >=10h off-duty rest to reset).
        hours_driven_this_shift = 0.0
        hours_since_shift_start = 1.0 if first_shift else 0.0
        first_shift = False
        break_taken_this_shift = False   # track 8-hr break for this shift

        while driving_hours_remaining > 0.001:
            # How much can we drive this iteration?
            # Both limits are checked BEFORE adding any driving time so
            # neither the 11-hr nor the 14-hr cap can be exceeded.
            can_drive = min(
                MAX_DRIVING_PER_SHIFT - hours_driven_this_shift,   # 11-hr cap
                MAX_SHIFT_WINDOW - hours_since_shift_start,        # 14-hr cap
                driving_hours_remaining,
            )

            if can_drive <= 0.001:
                break  # shift limits hit — exit inner loop to rest

            # ---- Fuel stop intercept ----
            hours_until_next_fuel = next_fuel_at - driving_hours_elapsed

            if (
                fuel_stop_index < len(fuel_stops_hours)
                and hours_until_next_fuel <= can_drive
                and hours_until_next_fuel > 0.001
            ):
                # Drive exactly up to the fuel stop — clip segment there
                drive_chunk = hours_until_next_fuel
                _add("driving", drive_chunk, "en route")
                driving_hours_elapsed += drive_chunk
                driving_hours_remaining -= drive_chunk
                hours_driven_this_shift += drive_chunk
                hours_since_shift_start += drive_chunk

                # Insert fuel stop
                _add("on_duty_not_driving", FUEL_STOP_DURATION_HOURS, "fuel stop")
                hours_since_shift_start += FUEL_STOP_DURATION_HOURS

                # Advance to next fuel stop
                fuel_stop_index += 1
                next_fuel_at = (
                    fuel_stops_hours[fuel_stop_index]
                    if fuel_stop_index < len(fuel_stops_hours)
                    else math.inf
                )
                continue

            # ---- 8-hr break intercept ----
            if (
                not break_taken_this_shift
                and hours_driven_this_shift < BREAK_TRIGGER_HOURS
                and hours_driven_this_shift + can_drive > BREAK_TRIGGER_HOURS
            ):
                # Drive exactly to 8 hours, clip there, then insert break
                drive_to_break = BREAK_TRIGGER_HOURS - hours_driven_this_shift
                _add("driving", drive_to_break, "en route")
                driving_hours_elapsed += drive_to_break
                driving_hours_remaining -= drive_to_break
                hours_driven_this_shift += drive_to_break
                hours_since_shift_start += drive_to_break

                # Mandatory 30-min break (on_duty_not_driving)
                _add("on_duty_not_driving", BREAK_DURATION_HOURS, "rest area")
                hours_since_shift_start += BREAK_DURATION_HOURS
                break_taken_this_shift = True
                continue

            # ---- Normal driving chunk ----
            # can_drive is already capped by both the 11-hr and 14-hr limits
            # so this segment can never push either counter past its limit.
            _add("driving", can_drive, "en route")
            driving_hours_elapsed += can_drive
            driving_hours_remaining -= can_drive
            hours_driven_this_shift += can_drive
            hours_since_shift_start += can_drive

            # Mark break as satisfied once we've driven >= 8 cumulative hrs
            if hours_driven_this_shift >= BREAK_TRIGGER_HOURS:
                break_taken_this_shift = True

        # ---- End of shift — mandatory rest or 34-hr restart ----
        if driving_hours_remaining > 0.001:
            base_rest = RESTART_DURATION_HOURS if cycle_hours >= MAX_CYCLE_HOURS else REST_DURATION_HOURS
            min_rest_end = current_time + timedelta(hours=base_rest)

            # Check if any driving already occurred on min_rest_end.date().
            # Under FMCSA rules, each duty period must not exceed 11.0h driving.
            # In daily logs (00:00 to 24:00), starting another shift on the same
            # calendar date after completing an 11h driving shift causes that
            # calendar day's driving total to exceed 11.00 hours.
            # To guarantee both per-shift <= 11.00h AND per-calendar-day <= 11.00h:
            # if min_rest_end falls on a date where driving has already occurred,
            # we extend the rest to the next midnight (00:00:00) so the next shift
            # begins fresh on a new calendar day.
            driving_on_rest_end_date = 0.0
            day_start = datetime(min_rest_end.year, min_rest_end.month, min_rest_end.day)
            day_end = day_start + timedelta(days=1)
            for s in segments:
                if s["status"] == "driving":
                    ov_start = max(s["start"], day_start)
                    ov_end = min(s["end"], day_end)
                    if ov_end > ov_start:
                        driving_on_rest_end_date += (ov_end - ov_start).total_seconds() / 3600.0

            if driving_on_rest_end_date > 0.001:
                next_midnight = day_end
                rest_duration = (next_midnight - current_time).total_seconds() / 3600.0
            else:
                rest_duration = base_rest

            if cycle_hours >= MAX_CYCLE_HOURS:
                _add("off_duty", rest_duration, "rest (34hr restart)")
                cycle_hours = 0.0
            else:
                _add("off_duty", rest_duration, "rest")

    # ------------------------------------------------------------------
    # 3. Dropoff (on-duty, not driving) — 1 hour
    # ------------------------------------------------------------------
    _add("on_duty_not_driving", 1.0, dropoff_label)

    return segments


# ---------------------------------------------------------------------------
# 2a. build_hos_schedule  (public API — estimates mileage from hours)
# ---------------------------------------------------------------------------

def build_hos_schedule(
    total_driving_hours: float,
    current_cycle_used: float,
    start_time: datetime,
    waypoint_labels: list,
) -> list[dict]:
    """
    Simulate a trip as a chronologically ordered list of HOS duty-status segments.

    Rules implemented (FMCSA property-carrying):
    - 11-hour driving limit per shift
    - 14-hour on-duty window per shift
    - 30-minute break after 8 cumulative driving hours
    - 10-hour off-duty rest between shifts (or 34-hour restart if cycle >= 70hrs)
    - 70-hour/8-day cycle limit
    - 30-minute fuel stop every 1000 miles (distributed proportionally)

    Parameters:
        total_driving_hours:  Total driving time needed (from route duration_hours)
        current_cycle_used:   Hours already used in the current 70-hr cycle
        start_time:           When the trip begins (datetime)
        waypoint_labels:      ["current", "pickup", "dropoff"] or similar

    Returns:
        List of segment dicts:
        {"status": str, "start": datetime, "end": datetime, "location": str}
    """
    # Estimate mileage at 55 mph when the real distance is unavailable.
    total_distance_miles = total_driving_hours * 55.0

    pickup_label  = waypoint_labels[1] if len(waypoint_labels) > 1 else "pickup"
    dropoff_label = waypoint_labels[-1] if waypoint_labels else "dropoff"

    return _run_hos_loop(
        total_driving_hours=total_driving_hours,
        total_distance_miles=total_distance_miles,
        current_cycle_used=current_cycle_used,
        start_time=start_time,
        pickup_label=pickup_label,
        dropoff_label=dropoff_label,
    )


# ---------------------------------------------------------------------------
# 2b. build_hos_schedule_with_distance  (preferred — uses real mileage)
# ---------------------------------------------------------------------------

def build_hos_schedule_with_distance(
    total_driving_hours: float,
    current_cycle_used: float,
    start_time: datetime,
    waypoint_labels: list,
    total_distance_miles: float,
) -> list[dict]:
    """
    Preferred version of build_hos_schedule that accepts accurate route mileage
    for precise fuel stop placement.

    The view layer should call this version when route data is available.
    """
    pickup_label  = waypoint_labels[1] if len(waypoint_labels) > 1 else "pickup"
    dropoff_label = waypoint_labels[-1] if waypoint_labels else "dropoff"

    return _run_hos_loop(
        total_driving_hours=total_driving_hours,
        total_distance_miles=total_distance_miles,
        current_cycle_used=current_cycle_used,
        start_time=start_time,
        pickup_label=pickup_label,
        dropoff_label=dropoff_label,
    )


# ---------------------------------------------------------------------------
# 3. split_by_day
# ---------------------------------------------------------------------------

def split_by_day(segments: list[dict]) -> list[dict]:
    """
    Split segments that cross midnight, group by calendar date, and compute
    per-status totals. Totals are padded with off_duty to ensure each day
    sums to exactly 24.0 hours.

    Parameters:
        segments: list of dicts with keys: status, start (datetime), end (datetime), location

    Returns:
        [
            {
                "date": "YYYY-MM-DD",
                "segments": [{"status", "start", "end", "location"}, ...],
                "totals": {"off_duty": h, "sleeper_berth": h, "driving": h,
                           "on_duty_not_driving": h}
            },
            ...
        ]
    """
    # Step 1: split segments that cross midnight
    # FIX: use true midnight (00:00:00 of the next day) as the split point,
    # NOT 23:59:59 of the current day, which left a 1-second gap and caused
    # per-day driving totals to be inflated by up to ~0.833 hours.
    split_segments: list[dict] = []
    for seg in segments:
        start: datetime = seg["start"]
        end: datetime = seg["end"]

        if start.date() == end.date():
            # No split needed
            split_segments.append(dict(seg))
        else:
            # Split at true midnight of each day boundary
            current_start = start
            while current_start.date() < end.date():
                # True midnight = 00:00:00 of the NEXT calendar day
                next_midnight = datetime(
                    current_start.year,
                    current_start.month,
                    current_start.day,
                ) + timedelta(days=1)
                # Clamp: next_midnight must not exceed end
                chunk_end = min(next_midnight, end)
                split_segments.append({
                    "status": seg["status"],
                    "start": current_start,
                    "end": chunk_end,
                    "location": seg["location"],
                })
                # Next chunk starts at the same midnight point
                current_start = next_midnight

            # Final chunk (same date as end) — only add if there's remaining time
            if current_start < end:
                split_segments.append({
                    "status": seg["status"],
                    "start": current_start,
                    "end": end,
                    "location": seg["location"],
                })

    # Step 2: group by calendar date
    from collections import defaultdict
    days: dict[str, list[dict]] = defaultdict(list)
    for seg in split_segments:
        date_key = seg["start"].date().isoformat()
        days[date_key].append(seg)

    # Step 3: for each day compute totals and pad to 24 hours
    all_statuses = ["off_duty", "sleeper_berth", "driving", "on_duty_not_driving"]
    result = []

    for date_key in sorted(days.keys()):
        day_segs = sorted(days[date_key], key=lambda s: s["start"])

        totals = {s: 0.0 for s in all_statuses}
        for seg in day_segs:
            duration_hours = (seg["end"] - seg["start"]).total_seconds() / 3600.0
            status = seg["status"]
            if status in totals:
                totals[status] = round(totals[status] + duration_hours, 6)
            else:
                totals[status] = round(duration_hours, 6)

        # Pad with off_duty to reach 24.0 hours
        total_accounted = sum(totals.values())
        gap = round(24.0 - total_accounted, 6)
        if gap > 0.0001:
            totals["off_duty"] = round(totals.get("off_duty", 0.0) + gap, 6)

        # Round totals to 4 decimal places for cleanliness
        totals = {k: round(v, 4) for k, v in totals.items()}

        # Serialize datetimes to ISO strings for JSON compatibility
        serialized_segs = [
            {
                "status": s["status"],
                "start": s["start"].isoformat(),
                "end": s["end"].isoformat(),
                "location": s["location"],
            }
            for s in day_segs
        ]

        result.append({
            "date": date_key,
            "segments": serialized_segs,
            "totals": totals,
        })

    return result

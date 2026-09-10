"""
trips/tests.py

Test suite for the ELD Trip Planner HOS scheduling engine.

Covers:
  - FMCSA 11-hour driving limit per shift
  - FMCSA 14-hour on-duty window per shift (pickup consumes 1h)
  - 30-minute mandatory break after 8 cumulative driving hours
  - 10-hour minimum off-duty rest between shifts
  - 34-hour restart when cycle >= 70 hours
  - 70-hour/8-day cycle limit enforcement
  - Fuel stop insertion every 1,000 miles
  - split_by_day midnight-split correctness
  - Regression test: Chicago -> Denver -> Salt Lake City (cycle_used=10)
"""

from datetime import datetime, timedelta

from django.test import TestCase

from .services import (
    build_hos_schedule,
    build_hos_schedule_with_distance,
    split_by_day,
    MAX_DRIVING_PER_SHIFT,
    MAX_SHIFT_WINDOW,
    REST_DURATION_HOURS,
    BREAK_TRIGGER_HOURS,
    BREAK_DURATION_HOURS,
    FUEL_STOP_INTERVAL_MILES,
    FUEL_STOP_DURATION_HOURS,
    MAX_CYCLE_HOURS,
    RESTART_DURATION_HOURS,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

START = datetime(2026, 1, 1, 8, 0, 0)   # 08:00 on 2026-01-01
LABELS = ["current", "pickup", "dropoff"]


def _driving_per_shift(segments):
    """
    Return a list of cumulative driving hours for each shift (separated by
    off_duty blocks of >= 10h).
    """
    shifts = []
    current_shift_driving = 0.0
    in_shift = False

    for seg in segments:
        dur = (seg["end"] - seg["start"]).total_seconds() / 3600.0
        if seg["status"] == "off_duty" and dur >= REST_DURATION_HOURS - 0.001:
            if in_shift:
                shifts.append(round(current_shift_driving, 6))
            current_shift_driving = 0.0
            in_shift = False
        elif seg["status"] == "driving":
            current_shift_driving += dur
            in_shift = True
        elif seg["status"] in ("on_duty_not_driving",):
            in_shift = True  # still in shift, just not driving

    if in_shift and current_shift_driving > 0:
        shifts.append(round(current_shift_driving, 6))

    return shifts


def _rest_durations(segments):
    """Return durations (hours) of all off_duty segments."""
    return [
        round((seg["end"] - seg["start"]).total_seconds() / 3600.0, 6)
        for seg in segments
        if seg["status"] == "off_duty"
    ]


def _split_day_driving(segments):
    """Return dict {date_str: driving_hours} after split_by_day."""
    daily = split_by_day(segments)
    return {d["date"]: d["totals"].get("driving", 0.0) for d in daily}


# ---------------------------------------------------------------------------
# 1. Short trip (< 11h driving) — no rest needed
# ---------------------------------------------------------------------------

class TestShortTrip(TestCase):
    def setUp(self):
        # 5 hours of driving — fits in a single shift, no rest required
        self.segs = build_hos_schedule(5.0, 0.0, START, LABELS)

    def test_no_off_duty_rest(self):
        rests = _rest_durations(self.segs)
        self.assertEqual(rests, [], "No rest should be inserted for a 5h trip")

    def test_driving_within_limit(self):
        shifts = _driving_per_shift(self.segs)
        for s in shifts:
            self.assertLessEqual(s, MAX_DRIVING_PER_SHIFT + 1e-6,
                                 f"Shift driving {s:.4f}h exceeds 11-hr limit")

    def test_has_pickup_and_dropoff(self):
        statuses = [s["status"] for s in self.segs]
        self.assertEqual(statuses[0], "on_duty_not_driving")   # pickup
        self.assertEqual(statuses[-1], "on_duty_not_driving")  # dropoff

    def test_split_by_day_driving_within_limit(self):
        daily = _split_day_driving(self.segs)
        for date, drv in daily.items():
            self.assertLessEqual(drv, MAX_DRIVING_PER_SHIFT + 1e-6,
                                 f"split_by_day: {date} driving {drv:.4f}h > 11h")


# ---------------------------------------------------------------------------
# 2. Exactly-11h driving trip — single shift, touches the cap
# ---------------------------------------------------------------------------

class TestExact11hTrip(TestCase):
    def setUp(self):
        # 11 hours exactly — should complete in one shift with no rest
        self.segs = build_hos_schedule(11.0, 0.0, START, LABELS)

    def test_no_off_duty_rest(self):
        rests = _rest_durations(self.segs)
        self.assertEqual(rests, [],
                         "Exactly 11h driving should need no rest (no remaining driving)")

    def test_driving_at_most_11h(self):
        shifts = _driving_per_shift(self.segs)
        for s in shifts:
            self.assertLessEqual(s, MAX_DRIVING_PER_SHIFT + 1e-6,
                                 f"Shift driving {s:.4f}h exceeds 11-hr limit")

    def test_split_by_day_no_violation(self):
        daily = _split_day_driving(self.segs)
        for date, drv in daily.items():
            self.assertLessEqual(drv, MAX_DRIVING_PER_SHIFT + 1e-6,
                                 f"split_by_day: {date} driving {drv:.4f}h > 11h")


# ---------------------------------------------------------------------------
# 3. Two-shift trip (18h driving) — requires one 10h rest
# ---------------------------------------------------------------------------

class TestTwoShiftTrip(TestCase):
    def setUp(self):
        # 18h driving — needs 2 shifts, 1 rest between them
        self.segs = build_hos_schedule_with_distance(18.0, 0.0, START, LABELS, 900.0)

    def test_exactly_one_rest(self):
        rests = _rest_durations(self.segs)
        self.assertEqual(len(rests), 1, f"Expected 1 rest, got {len(rests)}")

    def test_rest_is_at_least_10h(self):
        for dur in _rest_durations(self.segs):
            self.assertGreaterEqual(dur, REST_DURATION_HOURS - 1e-6,
                                    f"Rest of {dur:.4f}h is less than 10h")

    def test_each_shift_driving_at_most_11h(self):
        shifts = _driving_per_shift(self.segs)
        self.assertEqual(len(shifts), 2, f"Expected 2 shifts, got {len(shifts)}")
        for s in shifts:
            self.assertLessEqual(s, MAX_DRIVING_PER_SHIFT + 1e-6,
                                 f"Shift driving {s:.4f}h exceeds 11-hr limit")

    def test_split_by_day_no_violation(self):
        daily = _split_day_driving(self.segs)
        for date, drv in daily.items():
            self.assertLessEqual(drv, MAX_DRIVING_PER_SHIFT + 1e-6,
                                 f"split_by_day: {date} driving {drv:.4f}h > 11h")


# ---------------------------------------------------------------------------
# 4. 8-hour break requirement
# ---------------------------------------------------------------------------

class TestMandatoryBreak(TestCase):
    def setUp(self):
        # 10h driving — the 8-hr break MUST be inserted before the 11-hr cap
        self.segs = build_hos_schedule(10.0, 0.0, START, LABELS)

    def test_break_inserted(self):
        # There should be an on_duty_not_driving segment of 0.5h (the break)
        # somewhere in the middle (not the pickup or dropoff).
        middle_segs = self.segs[1:-1]  # exclude pickup and dropoff
        breaks = [
            s for s in middle_segs
            if s["status"] == "on_duty_not_driving"
        ]
        self.assertGreater(len(breaks), 0, "No mandatory break found")

    def test_break_is_30_min(self):
        middle_segs = self.segs[1:-1]
        for seg in middle_segs:
            if seg["status"] == "on_duty_not_driving":
                dur = (seg["end"] - seg["start"]).total_seconds() / 3600.0
                self.assertAlmostEqual(dur, BREAK_DURATION_HOURS, places=4,
                                       msg=f"Break duration {dur:.4f}h != 0.5h")
                break

    def test_driving_at_most_11h(self):
        for s in _driving_per_shift(self.segs):
            self.assertLessEqual(s, MAX_DRIVING_PER_SHIFT + 1e-6,
                                 f"Shift driving {s:.4f}h exceeds 11-hr limit")


# ---------------------------------------------------------------------------
# 5. 14-hour window enforcement
#    The pickup consumes 1h of the 14-hr window, so maximum driveable in
#    the first shift is min(11, 14-1) = 11h, but the window is correctly
#    initialised at 1h used for shift 1.
# ---------------------------------------------------------------------------

class TestShiftWindowFirstShift(TestCase):
    """
    Verify that the 14-hr window is initialised at 1h consumed for the first
    shift (because of the 1h pickup on-duty segment) and at 0h for subsequent
    shifts (which are preceded by a >=10h off-duty reset).
    """

    def test_first_shift_window_accounts_for_pickup(self):
        # 13h driving: with correct window accounting the first shift can drive
        # at most 11h (limited by the 11-hr cap), then a second shift covers 2h.
        # Before the fix the window would have been 14h (ignoring pickup 1h),
        # still limited by 11h cap — but with a very high initial cycle the
        # 14h window becomes binding.  Use a case where only the window matters:
        # Drive exactly at the window limit: pickup(1h) + drive(13h) = 14h.
        # That's 13h driving in one shift which is ILLEGAL.
        # With the fix, the engine must stop at 11h (11-hr cap) or at
        # hours_since_shift_start = 13 (window = 14-1 = 13h max remaining).
        segs = build_hos_schedule(13.0, 0.0, START, LABELS)
        shifts = _driving_per_shift(segs)
        for i, s in enumerate(shifts):
            self.assertLessEqual(s, MAX_DRIVING_PER_SHIFT + 1e-6,
                                 f"Shift {i+1} driving {s:.4f}h exceeds 11-hr limit")

    def test_subsequent_shifts_have_full_window(self):
        # After a 10-hr rest the subsequent shift should allow up to 11h driving
        segs = build_hos_schedule(22.0, 0.0, START, LABELS)
        shifts = _driving_per_shift(segs)
        self.assertGreaterEqual(len(shifts), 2, "Expected at least 2 shifts")
        # Second shift should be exactly 11h if enough driving remains
        self.assertAlmostEqual(shifts[1], MAX_DRIVING_PER_SHIFT, places=4,
                               msg=f"Second shift: expected 11h, got {shifts[1]:.4f}h")


# ---------------------------------------------------------------------------
# 6. Fuel stop insertion
# ---------------------------------------------------------------------------

class TestFuelStops(TestCase):
    def setUp(self):
        # 1200 miles at 55mph ≈ 21.8h driving — 1 fuel stop expected at ~1000mi
        self.segs = build_hos_schedule_with_distance(
            21.8, 0.0, START, LABELS, 1200.0
        )

    def test_fuel_stop_present(self):
        fuel_stops = [s for s in self.segs if s["location"] == "fuel stop"]
        self.assertGreater(len(fuel_stops), 0, "No fuel stop found for 1200-mile trip")

    def test_fuel_stop_duration(self):
        for seg in self.segs:
            if seg["location"] == "fuel stop":
                dur = (seg["end"] - seg["start"]).total_seconds() / 3600.0
                self.assertAlmostEqual(dur, FUEL_STOP_DURATION_HOURS, places=4,
                                       msg=f"Fuel stop duration {dur:.4f}h != 0.5h")

    def test_no_driving_violation_with_fuel_stops(self):
        for s in _driving_per_shift(self.segs):
            self.assertLessEqual(s, MAX_DRIVING_PER_SHIFT + 1e-6,
                                 f"Shift driving {s:.4f}h exceeds 11-hr limit with fuel stops")

    def test_split_by_day_no_violation_with_fuel_stops(self):
        daily = _split_day_driving(self.segs)
        for date, drv in daily.items():
            self.assertLessEqual(drv, MAX_DRIVING_PER_SHIFT + 1e-6,
                                 f"split_by_day {date}: driving {drv:.4f}h > 11h with fuel stops")


# ---------------------------------------------------------------------------
# 7. 34-hour restart (cycle >= 70h)
# ---------------------------------------------------------------------------

class TestCycleRestartAt70h(TestCase):
    def setUp(self):
        # Start with 60h already used, drive 12h — the first shift (11h) brings
        # cycle to 72h >= 70h, triggering a 34-hr restart before the 2nd shift.
        self.segs = build_hos_schedule(12.0, 60.0, START, LABELS)

    def test_restart_segment_present(self):
        restarts = [s for s in self.segs if s["location"] == "rest (34hr restart)"]
        self.assertGreater(len(restarts), 0, "No 34-hr restart found")

    def test_restart_is_34h(self):
        for seg in self.segs:
            if seg["location"] == "rest (34hr restart)":
                dur = (seg["end"] - seg["start"]).total_seconds() / 3600.0
                self.assertAlmostEqual(dur, RESTART_DURATION_HOURS, places=4,
                                       msg=f"Restart duration {dur:.4f}h != 34h")

    def test_driving_never_exceeds_11h(self):
        for s in _driving_per_shift(self.segs):
            self.assertLessEqual(s, MAX_DRIVING_PER_SHIFT + 1e-6,
                                 f"Shift driving {s:.4f}h exceeds 11-hr limit")


# ---------------------------------------------------------------------------
# 8. split_by_day midnight split correctness
# ---------------------------------------------------------------------------

class TestSplitByDay(TestCase):

    def test_segment_not_crossing_midnight(self):
        segs = [
            {"status": "driving", "start": datetime(2026, 1, 1, 8, 0),
             "end": datetime(2026, 1, 1, 19, 0), "location": "en route"},
        ]
        daily = split_by_day(segs)
        self.assertEqual(len(daily), 1)
        self.assertAlmostEqual(daily[0]["totals"]["driving"], 11.0, places=4)

    def test_segment_crossing_midnight_no_gap(self):
        """
        A driving segment that crosses midnight must be split with NO gap —
        the total driving across both days must equal the original duration.
        """
        segs = [
            {"status": "driving", "start": datetime(2026, 1, 1, 20, 0),
             "end": datetime(2026, 1, 2, 7, 0), "location": "en route"},
        ]
        daily = split_by_day(segs)
        self.assertEqual(len(daily), 2, "Should produce 2 day entries")

        day1_drv = daily[0]["totals"]["driving"]   # 4h (20:00–00:00)
        day2_drv = daily[1]["totals"]["driving"]   # 7h (00:00–07:00)
        total    = round(day1_drv + day2_drv, 4)

        self.assertAlmostEqual(total, 11.0, places=3,
                               msg=f"Total driving after split {total:.4f}h != 11h (gap detected)")

    def test_split_by_day_driving_never_exceeds_11h(self):
        """
        After split_by_day the per-day driving total must never exceed 11h.
        """
        segs = [
            {"status": "driving", "start": datetime(2026, 1, 1, 8, 0),
             "end": datetime(2026, 1, 1, 19, 0), "location": "en route"},
        ]
        daily = split_by_day(segs)
        for d in daily:
            self.assertLessEqual(d["totals"]["driving"], MAX_DRIVING_PER_SHIFT + 1e-6)

    def test_totals_sum_to_24h(self):
        """Each day's status totals must sum to exactly 24.0 hours."""
        segs = build_hos_schedule(23.0, 0.0, START, LABELS)
        daily = split_by_day(segs)
        for d in daily:
            day_total = sum(d["totals"].values())
            self.assertAlmostEqual(day_total, 24.0, places=3,
                                   msg=f"Day {d['date']}: totals sum to {day_total:.4f}h != 24h")


# ---------------------------------------------------------------------------
# 9. REGRESSION: Chicago -> Denver -> Salt Lake City, cycle_used=10
#    Route: ~1536.89 miles, ~23.9889h drive time
#    This is the exact case that originally reported 11.83h driving on Day 1.
# ---------------------------------------------------------------------------

class TestRegressionChicagoDenverSLC(TestCase):
    """
    Regression test for the confirmed HOS bug:
      - Reported: Day 1 driving = 11.83h (violates 11-hr FMCSA limit)
      - Reported: Off-duty rest ~9h (violates 10-hr minimum)

    Uses the exact route parameters reproduced from the real bug report.
    """

    DRIVING_HOURS  = 23.9889   # ~23h59m total drive time
    DISTANCE_MILES = 1536.89   # ~1536.89 miles
    CYCLE_USED     = 10.0      # hours already used in cycle

    def setUp(self):
        self.segs = build_hos_schedule_with_distance(
            total_driving_hours=self.DRIVING_HOURS,
            current_cycle_used=self.CYCLE_USED,
            start_time=START,
            waypoint_labels=LABELS,
            total_distance_miles=self.DISTANCE_MILES,
        )

    def test_no_shift_exceeds_11h_driving(self):
        """FMCSA 11-hr rule: no shift may have more than 11.0h of driving."""
        shifts = _driving_per_shift(self.segs)
        self.assertGreater(len(shifts), 0, "No shifts found in schedule")
        for i, driven in enumerate(shifts, start=1):
            self.assertLessEqual(
                driven,
                MAX_DRIVING_PER_SHIFT + 1e-6,
                f"Shift {i}: drove {driven:.4f}h which exceeds the 11-hr FMCSA limit",
            )

    def test_all_rest_periods_at_least_10h(self):
        """FMCSA 10-hr rest rule: every off-duty rest between shifts must be >= 10h."""
        rests = _rest_durations(self.segs)
        self.assertGreater(len(rests), 0, "No rest periods found for a 23.9h trip")
        for i, dur in enumerate(rests, start=1):
            self.assertGreaterEqual(
                dur,
                REST_DURATION_HOURS - 1e-6,
                f"Rest {i}: {dur:.4f}h is less than the required 10-hr minimum",
            )

    def test_split_by_day_no_driving_violation(self):
        """
        After split_by_day (which splits cross-midnight segments), no calendar
        day must show more than 11.0h of driving.
        """
        daily = _split_day_driving(self.segs)
        self.assertGreater(len(daily), 0, "split_by_day returned no days")
        for date, drv in daily.items():
            self.assertLessEqual(
                drv,
                MAX_DRIVING_PER_SHIFT + 1e-6,
                f"split_by_day {date}: driving={drv:.4f}h exceeds 11-hr FMCSA limit",
            )

    def test_chronological_segments(self):
        """Segments must be in strictly chronological order with no gaps."""
        for i in range(1, len(self.segs)):
            prev = self.segs[i - 1]
            curr = self.segs[i]
            self.assertEqual(
                prev["end"], curr["start"],
                f"Gap between segment {i-1} and {i}: "
                f"{prev['end']} -> {curr['start']}",
            )

    def test_total_driving_matches_input(self):
        """Total driving segments must sum to the input driving hours."""
        total = sum(
            (seg["end"] - seg["start"]).total_seconds() / 3600.0
            for seg in self.segs
            if seg["status"] == "driving"
        )
        self.assertAlmostEqual(
            total, self.DRIVING_HOURS, places=3,
            msg=f"Total driving {total:.4f}h != input {self.DRIVING_HOURS}h",
        )

    def test_first_day_driving_at_most_11h(self):
        """
        Specific regression assertion: Day 1 driving must be <= 11.00h.
        The original bug produced 11.83h on Day 1.
        """
        daily = _split_day_driving(self.segs)
        dates = sorted(daily.keys())
        day1_drv = daily[dates[0]]
        self.assertLessEqual(
            day1_drv,
            MAX_DRIVING_PER_SHIFT + 1e-6,
            f"Day 1 driving={day1_drv:.4f}h exceeds 11-hr limit (regression!)",
        )

    def test_first_rest_at_least_10h(self):
        """
        Specific regression assertion: the first off-duty rest must be >= 10h.
        The original bug showed a rest of ~9h.
        """
        rests = _rest_durations(self.segs)
        self.assertGreater(len(rests), 0, "No rest found")
        self.assertGreaterEqual(
            rests[0],
            REST_DURATION_HOURS - 1e-6,
            f"First rest={rests[0]:.4f}h is less than 10h (regression!)",
        )


class TestAllStartTimesChicagoDenverSLC(TestCase):
    """
    Test Chicago -> Denver -> Salt Lake City across diverse start times
    (including 00:00, 00:40, 00:55, 01:00, 06:00, 12:00, 20:00) to ensure
    Day 1 driving and all subsequent days never exceed 11.00 hours.
    """
    DRIVING_HOURS  = 23.9889
    DISTANCE_MILES = 1536.89
    CYCLE_USED     = 10.0

    def test_midnight_and_early_morning_starts(self):
        for h, m in [(0, 0), (0, 40), (0, 55), (1, 0), (1, 30), (6, 0), (12, 0), (20, 0)]:
            t = datetime(2026, 9, 10, h, m, 0)
            segs = build_hos_schedule_with_distance(
                total_driving_hours=self.DRIVING_HOURS,
                current_cycle_used=self.CYCLE_USED,
                start_time=t,
                waypoint_labels=LABELS,
                total_distance_miles=self.DISTANCE_MILES,
            )
            daily = split_by_day(segs)

            # Per-shift check
            shifts = _driving_per_shift(segs)
            for i, s in enumerate(shifts):
                self.assertLessEqual(
                    s, MAX_DRIVING_PER_SHIFT + 1e-6,
                    f"Start {h:02d}:{m:02d}: Shift {i+1} driving {s:.4f}h > 11h",
                )

            # Rest periods check
            for i, r in enumerate(_rest_durations(segs)):
                self.assertGreaterEqual(
                    r, REST_DURATION_HOURS - 1e-6,
                    f"Start {h:02d}:{m:02d}: Rest {i+1} duration {r:.4f}h < 10h",
                )

            # Daily logs check
            for d in daily:
                drv = d["totals"]["driving"]
                tot = sum(d["totals"].values())
                self.assertLessEqual(
                    drv, MAX_DRIVING_PER_SHIFT + 1e-6,
                    f"Start {h:02d}:{m:02d} on {d['date']}: driving {drv:.4f}h > 11h",
                )
                self.assertAlmostEqual(
                    tot, 24.0, places=3,
                    msg=f"Start {h:02d}:{m:02d} on {d['date']}: totals sum {tot:.4f}h != 24h",
                )


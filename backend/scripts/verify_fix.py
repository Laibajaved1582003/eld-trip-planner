import math
from datetime import datetime, timedelta
from collections import defaultdict
import random

MAX_DRIVING_PER_SHIFT  = 11.0
MAX_SHIFT_WINDOW       = 14.0
BREAK_TRIGGER_HOURS    = 8.0
BREAK_DURATION_HOURS   = 0.5
REST_DURATION_HOURS    = 10.0
RESTART_DURATION_HOURS = 34.0
MAX_CYCLE_HOURS        = 70.0
FUEL_STOP_INTERVAL_MILES = 1000.0
FUEL_STOP_DURATION_HOURS = 0.5

def split_by_day(segments):
    split_segments = []
    for seg in segments:
        start = seg['start']
        end = seg['end']
        if start.date() == end.date():
            split_segments.append(dict(seg))
        else:
            current_start = start
            while current_start.date() < end.date():
                next_midnight = datetime(current_start.year, current_start.month, current_start.day) + timedelta(days=1)
                chunk_end = min(next_midnight, end)
                split_segments.append({
                    'status': seg['status'],
                    'start': current_start,
                    'end': chunk_end,
                    'location': seg['location'],
                })
                current_start = next_midnight
            if current_start < end:
                split_segments.append({
                    'status': seg['status'],
                    'start': current_start,
                    'end': end,
                    'location': seg['location'],
                })

    days = defaultdict(list)
    for seg in split_segments:
        date_key = seg['start'].date().isoformat()
        days[date_key].append(seg)

    all_statuses = ['off_duty', 'sleeper_berth', 'driving', 'on_duty_not_driving']
    result = []
    for date_key in sorted(days.keys()):
        day_segs = sorted(days[date_key], key=lambda s: s['start'])
        totals = {s: 0.0 for s in all_statuses}
        for seg in day_segs:
            dur = (seg['end'] - seg['start']).total_seconds() / 3600.0
            totals[seg['status']] = round(totals.get(seg['status'], 0.0) + dur, 6)
        total_accounted = sum(totals.values())
        gap = round(24.0 - total_accounted, 6)
        if gap > 0.0001:
            totals['off_duty'] = round(totals.get('off_duty', 0.0) + gap, 6)
        totals = {k: round(v, 4) for k, v in totals.items()}
        result.append({'date': date_key, 'segments': day_segs, 'totals': totals})
    return result

def run_sim(total_driving_hours, total_distance_miles, current_cycle_used, start_time):
    segments = []
    current_time = start_time
    miles_per_driving_hour = total_distance_miles / total_driving_hours if total_driving_hours > 0 else 55.0
    fuel_stops_hours = []
    if total_distance_miles >= FUEL_STOP_INTERVAL_MILES:
        num_fuel_stops = int(total_distance_miles / FUEL_STOP_INTERVAL_MILES)
        for i in range(1, num_fuel_stops + 1):
            stop_mile = i * FUEL_STOP_INTERVAL_MILES
            if stop_mile < total_distance_miles:
                fuel_stops_hours.append(stop_mile / miles_per_driving_hour)

    driving_hours_remaining = total_driving_hours
    driving_hours_elapsed = 0.0
    cycle_hours = current_cycle_used
    fuel_stop_index = 0
    next_fuel_at = fuel_stops_hours[0] if fuel_stops_hours else math.inf

    def _add(status, hours, location):
        nonlocal current_time, cycle_hours
        seg_start = current_time
        seg_end = current_time + timedelta(hours=hours)
        segments.append({
            'status': status,
            'start': seg_start,
            'end': seg_end,
            'location': location,
        })
        current_time = seg_end
        if status in ('driving', 'on_duty_not_driving'):
            cycle_hours += hours

    _add('on_duty_not_driving', 1.0, 'pickup')
    first_shift = True

    while driving_hours_remaining > 0.001:
        hours_driven_this_shift = 0.0
        hours_since_shift_start = 1.0 if first_shift else 0.0
        first_shift = False
        break_taken_this_shift = False

        while driving_hours_remaining > 0.001:
            can_drive = min(
                MAX_DRIVING_PER_SHIFT - hours_driven_this_shift,
                MAX_SHIFT_WINDOW - hours_since_shift_start,
                driving_hours_remaining,
            )
            if can_drive <= 0.001:
                break

            hours_until_next_fuel = next_fuel_at - driving_hours_elapsed
            if (
                fuel_stop_index < len(fuel_stops_hours)
                and hours_until_next_fuel <= can_drive
                and hours_until_next_fuel > 0.001
            ):
                drive_chunk = hours_until_next_fuel
                _add('driving', drive_chunk, 'en route')
                driving_hours_elapsed += drive_chunk
                driving_hours_remaining -= drive_chunk
                hours_driven_this_shift += drive_chunk
                hours_since_shift_start += drive_chunk

                _add('on_duty_not_driving', FUEL_STOP_DURATION_HOURS, 'fuel stop')
                hours_since_shift_start += FUEL_STOP_DURATION_HOURS
                fuel_stop_index += 1
                next_fuel_at = fuel_stops_hours[fuel_stop_index] if fuel_stop_index < len(fuel_stops_hours) else math.inf
                continue

            if (
                not break_taken_this_shift
                and hours_driven_this_shift < BREAK_TRIGGER_HOURS
                and hours_driven_this_shift + can_drive > BREAK_TRIGGER_HOURS
            ):
                drive_to_break = BREAK_TRIGGER_HOURS - hours_driven_this_shift
                _add('driving', drive_to_break, 'en route')
                driving_hours_elapsed += drive_to_break
                driving_hours_remaining -= drive_to_break
                hours_driven_this_shift += drive_to_break
                hours_since_shift_start += drive_to_break

                _add('on_duty_not_driving', BREAK_DURATION_HOURS, 'rest area')
                hours_since_shift_start += BREAK_DURATION_HOURS
                break_taken_this_shift = True
                continue

            _add('driving', can_drive, 'en route')
            driving_hours_elapsed += can_drive
            driving_hours_remaining -= can_drive
            hours_driven_this_shift += can_drive
            hours_since_shift_start += can_drive

            if hours_driven_this_shift >= BREAK_TRIGGER_HOURS:
                break_taken_this_shift = True

        # Rest between shifts
        if driving_hours_remaining > 0.001:
            base_rest = RESTART_DURATION_HOURS if cycle_hours >= MAX_CYCLE_HOURS else REST_DURATION_HOURS
            min_rest_end = current_time + timedelta(hours=base_rest)
            
            # Check driving already done on min_rest_end.date()
            driving_on_rest_end_date = 0.0
            day_start = datetime(min_rest_end.year, min_rest_end.month, min_rest_end.day)
            day_end = day_start + timedelta(days=1)
            for s in segments:
                if s['status'] == 'driving':
                    ov_start = max(s['start'], day_start)
                    ov_end = min(s['end'], day_end)
                    if ov_end > ov_start:
                        driving_on_rest_end_date += (ov_end - ov_start).total_seconds() / 3600.0

            if driving_on_rest_end_date > 0.001:
                # Extend rest to midnight of that day so next shift starts on fresh date
                next_midnight = day_end
                rest_duration = (next_midnight - current_time).total_seconds() / 3600.0
            else:
                rest_duration = base_rest

            if cycle_hours >= MAX_CYCLE_HOURS:
                _add('off_duty', rest_duration, 'rest (34hr restart)')
                cycle_hours = 0.0
            else:
                _add('off_duty', rest_duration, 'rest')

    _add('on_duty_not_driving', 1.0, 'dropoff')
    return segments

def test_battery():
    test_trips = [
        # (driving_hours, distance_miles, cycle_used)
        (23.9889, 1536.89, 10.0), # Chicago -> Denver -> Salt Lake City
        (5.0, 300.0, 0.0),       # Short trip
        (11.0, 650.0, 20.0),     # Exactly 1 shift
        (16.4, 900.0, 20.0),     # ~1.5 shifts
        (35.0, 2200.0, 15.0),    # ~3 shifts
        (50.0, 3000.0, 45.0),    # Trigger cycle 34hr restart
    ]
    
    total_passed = 0
    total_ran = 0
    
    for driving_h, dist_m, cycle_u in test_trips:
        for hour in [0, 1, 6, 8, 12, 18, 23]:
            for minute in [0, 30, 40, 55]:
                total_ran += 1
                t = datetime(2026, 9, 10, hour, minute, 0)
                segs = run_sim(driving_h, dist_m, cycle_u, t)
                daily = split_by_day(segs)
                
                # 1. Check shift driving
                shift_driving = 0.0
                for s in segs:
                    dur = (s['end'] - s['start']).total_seconds() / 3600.0
                    if s['status'] == 'driving':
                        shift_driving += dur
                        assert shift_driving <= 11.0001, f"Shift driving exceeded: {shift_driving}"
                    elif s['status'] == 'off_duty' and dur >= 10.0:
                        shift_driving = 0.0
                
                # 2. Check daily logs
                for d in daily:
                    drv = d['totals']['driving']
                    tot = sum(d['totals'].values())
                    assert drv <= 11.0001, f"Daily driving exceeded: {drv} on {d['date']}"
                    assert abs(tot - 24.0) < 0.01, f"Day does not sum to 24h: {tot}"
                    
                # 3. Check total driving sum
                tot_drv_all = sum(d['totals']['driving'] for d in daily)
                assert abs(tot_drv_all - driving_h) < 0.01, f"Total driving mismatch: {tot_drv_all} vs {driving_h}"
                
                total_passed += 1

    print(f"Passed all {total_passed}/{total_ran} comprehensive test configurations!")

if __name__ == '__main__':
    test_battery()

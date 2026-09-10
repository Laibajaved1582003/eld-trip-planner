import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from datetime import datetime
from trips.services import build_hos_schedule_with_distance, split_by_day

total_tests = 0
failures = []
for h in range(24):
    for m in range(0, 60, 5):
        total_tests += 1
        t = datetime(2026, 9, 10, h, m, 0)
        segs = build_hos_schedule_with_distance(
            total_driving_hours=23.9889,
            current_cycle_used=10.0,
            start_time=t,
            waypoint_labels=['current', 'pickup', 'dropoff'],
            total_distance_miles=1536.89,
        )
        daily = split_by_day(segs)
        
        # Check per-shift driving
        shift_drv = 0.0
        for s in segs:
            dur = (s['end'] - s['start']).total_seconds() / 3600.0
            if s['status'] == 'driving':
                shift_drv += dur
                if shift_drv > 11.0001:
                    failures.append(f"Shift driving > 11: {shift_drv} at {h:02d}:{m:02d}")
            elif s['status'] == 'off_duty' and dur >= 10.0:
                shift_drv = 0.0

        for d in daily:
            drv = d['totals']['driving']
            tot = sum(d['totals'].values())
            if drv > 11.0001:
                failures.append(f"Daily driving > 11: {drv} on {d['date']} for start {h:02d}:{m:02d}")
            if abs(tot - 24.0) > 0.01:
                failures.append(f"Sum != 24: {tot} on {d['date']} for start {h:02d}:{m:02d}")

print(f"Total tested: {total_tests}")
print(f"Failures: {len(failures)}")
if failures:
    for f in failures[:10]:
        print(f)
else:
    print("ALL 288 TESTS PASSED WITH 0 FAILURES!")

# Print specific trace for the user's start time around 00:55
print("\n--- Detailed output for start_time = 00:55 ---")
t0 = datetime(2026, 9, 10, 0, 55, 0)
segs0 = build_hos_schedule_with_distance(23.9889, 10.0, t0, ['current', 'pickup', 'dropoff'], 1536.89)
daily0 = split_by_day(segs0)
for d in daily0:
    print(f"Date: {d['date']} | Totals: {d['totals']}")

"""
Scratch script: test build_hos_schedule_with_distance with hardcoded numbers.
Run from backend/ directory:
    python -m scripts.test_hos
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from datetime import datetime
from trips.services import build_hos_schedule_with_distance, split_by_day

total_driving_hours = 16.4
current_cycle_used = 20.0
start_time = datetime(2024, 1, 15, 6, 0, 0)  # 6:00 AM
waypoint_labels = ["current location", "pickup", "dropoff"]
total_distance_miles = 900.0  # ~900 miles for a 16.4hr trip

print("=" * 60)
print(f"Building HOS schedule:")
print(f"  total_driving_hours  = {total_driving_hours}")
print(f"  current_cycle_used   = {current_cycle_used}")
print(f"  start_time           = {start_time}")
print(f"  total_distance_miles = {total_distance_miles}")
print("=" * 60)

segments = build_hos_schedule_with_distance(
    total_driving_hours=total_driving_hours,
    current_cycle_used=current_cycle_used,
    start_time=start_time,
    waypoint_labels=waypoint_labels,
    total_distance_miles=total_distance_miles,
)

print("\n--- RAW SEGMENTS ---")
total_driving = 0.0
for i, seg in enumerate(segments):
    duration_h = (seg["end"] - seg["start"]).total_seconds() / 3600
    if seg["status"] == "driving":
        total_driving += duration_h
    print(
        f"  {i+1:3d}. [{seg['status']:25s}] "
        f"{seg['start'].strftime('%m/%d %H:%M')} -> {seg['end'].strftime('%m/%d %H:%M')} "
        f"({duration_h:.2f}h)  @ {seg['location']}"
    )

print(f"\nTotal driving hours in segments: {total_driving:.4f} (expected: {total_driving_hours})")

print("\n--- DAILY LOGS ---")
daily = split_by_day(segments)
for day in daily:
    print(f"\n  Date: {day['date']}")
    print(f"  Totals: {day['totals']}")
    total_hours = sum(day['totals'].values())
    print(f"  Sum of totals: {total_hours:.4f} hrs (should be 24.0)")
    for seg in day["segments"]:
        dur = (datetime.fromisoformat(seg["end"]) - datetime.fromisoformat(seg["start"])).total_seconds() / 3600
        print(f"    [{seg['status']:25s}] {seg['start'][11:16]} -> {seg['end'][11:16]} ({dur:.2f}h) @ {seg['location']}")

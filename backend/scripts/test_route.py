"""
Scratch script: test get_route() with 3 real US addresses.
Run from backend/ directory:
    .\\venv\\Scripts\\python.exe -m scripts.test_route

Requires ORS_API_KEY in backend/.env
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from trips.services import get_route

print("=" * 60)
print("Testing get_route() with real US addresses")
print("=" * 60)

current  = "Chicago, IL, USA"
pickup   = "Indianapolis, IN, USA"
dropoff  = "Nashville, TN, USA"

print(f"  Current : {current}")
print(f"  Pickup  : {pickup}")
print(f"  Dropoff : {dropoff}")
print()

try:
    result = get_route(current, pickup, dropoff)
    print("SUCCESS!")
    print(f"  Distance : {result['distance_miles']} miles")
    print(f"  Duration : {result['duration_hours']} hours")
    print(f"  Geometry points: {len(result['geometry'])}")
    print(f"  Waypoints:")
    for wp in result['waypoints']:
        print(f"    [{wp['label']:10s}] lat={wp['lat']:.5f}, lng={wp['lng']:.5f}")
    if result['geometry']:
        print(f"  First geometry point: {result['geometry'][0]}")
        print(f"  Last  geometry point: {result['geometry'][-1]}")
except ValueError as e:
    print(f"ValueError: {e}")
except Exception as e:
    print(f"Unexpected error: {type(e).__name__}: {e}")

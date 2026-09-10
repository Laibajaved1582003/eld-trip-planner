"""
trips/views.py

API endpoint for ELD trip planning.
POST /api/plan-trip/
"""

from datetime import datetime

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .serializers import TripInputSerializer
from .services import get_route, build_hos_schedule_with_distance, split_by_day


class PlanTripView(APIView):
    """
    Plan a trip with HOS (Hours of Service) scheduling.

    POST /api/plan-trip/
    Body (JSON):
        {
            "current_location": "Chicago, IL",
            "pickup_location": "Indianapolis, IN",
            "dropoff_location": "Nashville, TN",
            "current_cycle_used": 20.0
        }

    Response (JSON):
        {
            "route": {
                "distance_miles": float,
                "duration_hours": float,
                "geometry": [[lat, lng], ...],
                "waypoints": [...]
            },
            "daily_logs": [
                {
                    "date": "YYYY-MM-DD",
                    "segments": [...],
                    "totals": {...}
                },
                ...
            ]
        }
    """

    def post(self, request):
        serializer = TripInputSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"error": "Invalid input.", "details": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = serializer.validated_data

        try:
            # Step 1: Get route from ORS
            route = get_route(
                current_location=data["current_location"],
                pickup_location=data["pickup_location"],
                dropoff_location=data["dropoff_location"],
            )
        except ValueError as exc:
            return Response(
                {"error": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as exc:
            return Response(
                {"error": f"Unexpected error fetching route: {exc}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            # Step 2: Build HOS schedule
            waypoint_labels = [wp["label"] for wp in route["waypoints"]]
            segments = build_hos_schedule_with_distance(
                total_driving_hours=route["duration_hours"],
                current_cycle_used=data["current_cycle_used"],
                start_time=datetime.now(),
                waypoint_labels=waypoint_labels,
                total_distance_miles=route["distance_miles"],
            )
        except Exception as exc:
            return Response(
                {"error": f"Error building HOS schedule: {exc}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            # Step 3: Split into daily logs
            daily_logs = split_by_day(segments)
        except Exception as exc:
            return Response(
                {"error": f"Error generating daily logs: {exc}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response({
            "route": route,
            "daily_logs": daily_logs,
        })

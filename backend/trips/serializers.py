"""
trips/serializers.py

Input serializer for the plan-trip endpoint.
"""

from rest_framework import serializers


class TripInputSerializer(serializers.Serializer):
    current_location = serializers.CharField(
        max_length=500,
        error_messages={
            "blank": "Current location cannot be empty.",
            "required": "Current location is required.",
            "max_length": "Current location must be 500 characters or fewer.",
        },
    )
    pickup_location = serializers.CharField(
        max_length=500,
        error_messages={
            "blank": "Pickup location cannot be empty.",
            "required": "Pickup location is required.",
            "max_length": "Pickup location must be 500 characters or fewer.",
        },
    )
    dropoff_location = serializers.CharField(
        max_length=500,
        error_messages={
            "blank": "Dropoff location cannot be empty.",
            "required": "Dropoff location is required.",
            "max_length": "Dropoff location must be 500 characters or fewer.",
        },
    )
    current_cycle_used = serializers.FloatField(
        min_value=0,
        max_value=70,
        error_messages={
            "required": "current_cycle_used is required.",
            "invalid": "current_cycle_used must be a valid number.",
            "min_value": "current_cycle_used cannot be negative.",
            "max_value": "current_cycle_used cannot exceed 70 hours (the 70-hr/8-day cycle limit).",
        },
    )

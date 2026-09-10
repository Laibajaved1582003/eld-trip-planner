"""
trips/urls.py

URL patterns for the trips app.
All routes are prefixed with "api/" by core/urls.py.
"""

from django.urls import path
from .views import PlanTripView

urlpatterns = [
    path("plan-trip/", PlanTripView.as_view(), name="plan-trip"),
]

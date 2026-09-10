# ELD Trip Planner

> A full-stack web application that automates FMCSA-compliant Hours of Service (HOS) scheduling for truck drivers. Enter origin, pickup, and dropoff locations — get a real driving route, per-day ELD log sheets, and fuel stop planning in seconds.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
  - [1. Clone the Repository](#1-clone-the-repository)
  - [2. Backend Setup](#2-backend-setup)
  - [3. Frontend Setup](#3-frontend-setup)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [HOS Rules Implemented](#hos-rules-implemented)
- [Deployment](#deployment)
- [Running Tests](#running-tests)
- [Contributing](#contributing)

---

## Overview

ELD Trip Planner solves a real-world logistics problem: given three locations (current position → pickup → dropoff), compute a compliant driving schedule that respects every FMCSA Hours of Service rule. The backend integrates with the [OpenRouteService](https://openrouteservice.org/) (ORS) API to geocode addresses and fetch accurate driving routes, then runs a simulation engine that inserts mandatory breaks, rest periods, cycle resets, and fuel stops at the correct points in the journey.

The React frontend renders the full route on an interactive Leaflet map and generates printable daily ELD log sheets — one per calendar day — with per-status hour totals that always sum to exactly 24 hours.

---

## Features

| Feature | Description |
|---|---|
| **Route Planning** | Geocodes three free-text addresses and fetches a real driving route via ORS |
| **HOS Scheduling Engine** | Simulates a full multi-day trip under FMCSA property-carrying rules |
| **Daily ELD Log Sheets** | Auto-generates one log sheet per calendar day with segment grid and hour totals |
| **Fuel Stop Insertion** | Automatically inserts 30-minute fuel stops every 1,000 miles |
| **Interactive Map** | Full-route polyline on a Leaflet map with waypoint markers |
| **Cycle Hours Awareness** | Accepts current cycle hours used to apply accurate remaining 70-hr limits |
| **34-Hour Restart** | Triggers a 34-hour off-duty restart when the 70-hr cycle limit is reached |
| **Dark / Light Mode** | Theme toggle persisted across sessions |
| **Animated UI** | Framer Motion transitions throughout the interface |

---

## Tech Stack

### Backend

| Layer | Technology |
|---|---|
| Language | Python 3.12+ |
| Framework | Django 6.1 |
| REST API | Django REST Framework 3.18 |
| Routing / Geocoding | OpenRouteService API |
| CORS | django-cors-headers |
| Configuration | python-decouple |
| Static Files | WhiteNoise |
| WSGI Server (prod) | Gunicorn |
| Database | SQLite (dev) |

### Frontend

| Layer | Technology |
|---|---|
| Language | JavaScript (ES2023+) |
| Framework | React 19 |
| Build Tool | Vite 8 |
| Routing | React Router DOM 7 |
| Map | Leaflet + React-Leaflet |
| HTTP Client | Axios |
| Animations | Framer Motion |
| Date Utilities | date-fns |
| Styling | Tailwind CSS 4 |

---

## Project Structure

```
eld-trip-planner/
├── backend/                      # Django project root
│   ├── core/                     # Django project configuration
│   │   ├── settings.py           # All project settings (env-driven)
│   │   ├── urls.py               # Root URL configuration
│   │   ├── wsgi.py
│   │   └── asgi.py
│   ├── trips/                    # Main application
│   │   ├── services.py           # HOS engine, ORS integration, log splitting
│   │   ├── views.py              # POST /api/plan-trip/ endpoint
│   │   ├── serializers.py        # Input validation
│   │   ├── urls.py               # App-level URL routing
│   │   ├── models.py
│   │   └── tests.py              # Full test suite
│   ├── manage.py
│   ├── requirements.txt
│   ├── build.sh                  # Render.com deployment build script
│   └── .env.example              # Environment variable template
│
└── frontend/                     # React + Vite application
    ├── src/
    │   ├── components/
    │   │   ├── TripForm.jsx       # Trip input form
    │   │   ├── RouteMap.jsx       # Leaflet map with route polyline
    │   │   ├── DailyLogSheet.jsx  # ELD log grid per day
    │   │   ├── DailyLogTabs.jsx   # Tab navigation across days
    │   │   ├── AnimatedScene.jsx  # Landing page animation
    │   │   ├── AnimatedNumber.jsx # Animated stat counters
    │   │   ├── ThemeToggle.jsx    # Dark/light mode switch
    │   │   └── Tooltip.jsx        # Reusable tooltip component
    │   ├── api/                   # Axios API client
    │   ├── context/               # React context (theme, etc.)
    │   ├── App.jsx                # Root component and routing
    │   ├── main.jsx               # Entry point
    │   ├── index.css              # Global styles and design tokens
    │   └── App.css
    ├── index.html
    ├── vite.config.js
    └── package.json
```

---

## Prerequisites

- **Python** 3.12 or later
- **Node.js** 18 or later (with npm)
- An **OpenRouteService API key** — get one free at [openrouteservice.org](https://openrouteservice.org/dev/#/signup)

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/<your-username>/eld-trip-planner.git
cd eld-trip-planner
```

### 2. Backend Setup

```bash
cd backend

# Create and activate a virtual environment
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

#### Configure environment variables

```bash
# Copy the example file
cp .env.example .env
```

Edit `.env` and fill in your values (see [Environment Variables](#environment-variables) below).

#### Run database migrations

```bash
python manage.py migrate
```

#### Start the development server

```bash
python manage.py runserver
```

The API will be available at `http://127.0.0.1:8000`.

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## Environment Variables

All backend configuration is controlled via a `.env` file inside the `backend/` directory. Copy `backend/.env.example` to `backend/.env` and set the following variables:

| Variable | Required | Default | Description |
|---|---|---|---|
| `SECRET_KEY` | Yes | — | Django secret key. Generate one with `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"` |
| `ORS_API_KEY` | Yes | — | OpenRouteService API key for geocoding and routing |
| `DEBUG` | No | `False` | Set to `True` in local development only |
| `ALLOWED_HOSTS` | No | `localhost,127.0.0.1` | Comma-separated list of allowed host names |
| `CORS_ALLOWED_ORIGINS` | No | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated list of allowed frontend origins |

The frontend reads one variable from `frontend/.env`:

| Variable | Description |
|---|---|
| `VITE_API_URL` | Base URL of the backend API (e.g. `http://127.0.0.1:8000`) |

---

## API Reference

### `POST /api/plan-trip/`

Plan a multi-day HOS-compliant trip.

**Request Body**

```json
{
  "current_location":  "Chicago, IL",
  "pickup_location":   "Indianapolis, IN",
  "dropoff_location":  "Nashville, TN",
  "current_cycle_used": 20.0
}
```

| Field | Type | Description |
|---|---|---|
| `current_location` | `string` | Driver's current position (free-text address) |
| `pickup_location` | `string` | Cargo pickup address |
| `dropoff_location` | `string` | Cargo dropoff address |
| `current_cycle_used` | `float` | Hours already used in the current 70-hr/8-day cycle |

**Success Response** — `200 OK`

```json
{
  "route": {
    "distance_miles": 476.52,
    "duration_hours": 7.1833,
    "geometry": [[41.85, -87.65], "..."],
    "waypoints": [
      { "label": "current", "lat": 41.85, "lng": -87.65 },
      { "label": "pickup",  "lat": 39.77, "lng": -86.16 },
      { "label": "dropoff", "lat": 36.16, "lng": -86.78 }
    ]
  },
  "daily_logs": [
    {
      "date": "2026-09-10",
      "segments": [
        {
          "status":   "on_duty_not_driving",
          "start":    "2026-09-10T07:21:00",
          "end":      "2026-09-10T08:21:00",
          "location": "pickup"
        }
      ],
      "totals": {
        "off_duty":            14.65,
        "sleeper_berth":        0.0,
        "driving":              8.18,
        "on_duty_not_driving":  1.17
      }
    }
  ]
}
```

**Error Responses**

| Status | Cause |
|---|---|
| `400 Bad Request` | Invalid input fields, unresolvable address, or ORS API failure |

---

## HOS Rules Implemented

The scheduling engine in `backend/trips/services.py` enforces the following FMCSA property-carrying rules:

| Rule | Limit |
|---|---|
| Maximum driving per shift | 11 hours |
| Maximum on-duty window per shift | 14 hours |
| Mandatory break | 30 minutes after 8 cumulative driving hours |
| Daily rest between shifts | 10 hours off-duty |
| 70-hour / 8-day cycle limit | 70 hours |
| 34-hour restart | Triggered when cycle hours >= 70 |
| Fuel stop interval | Every 1,000 miles (30 min each) |
| Pickup / Dropoff on-duty time | 1 hour each |

Daily log totals are padded with `off_duty` time so that every calendar day sums to **exactly 24.0 hours**.

---

## Deployment

The backend is configured for one-command deployment to [Render](https://render.com/).

### Render Configuration

| Setting | Value |
|---|---|
| **Build Command** | `./build.sh` |
| **Start Command** | `gunicorn core.wsgi:application` |
| **Environment** | Python 3 |

The `build.sh` script runs `pip install`, `collectstatic`, and `migrate` automatically on each deploy.

Set all required environment variables (`SECRET_KEY`, `ORS_API_KEY`, `DEBUG=False`, `ALLOWED_HOSTS`, and `CORS_ALLOWED_ORIGINS`) in the Render service dashboard.

The frontend can be deployed to [Vercel](https://vercel.com/), [Netlify](https://www.netlify.com/), or Render static site hosting. Set `VITE_API_URL` to the live backend URL before building:

```bash
cd frontend
npm run build      # output goes to dist/
```

---

## Running Tests

The backend ships with a comprehensive test suite covering the HOS engine, route service, daily log splitting, and API endpoint.

```bash
cd backend

# Activate virtual environment first
venv\Scripts\activate        # Windows
source venv/bin/activate     # macOS / Linux

# Run all tests
python manage.py test trips
```

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Make your changes with clear, focused commits
4. Ensure the test suite passes: `python manage.py test trips`
5. Open a pull request with a description of what was changed and why

---

*Built with Django, React, and OpenRouteService.*

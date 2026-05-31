# WaterWatch – CivicTech Water Complaint Platform

**WaterWatch** is a modern, responsive, full-stack CivicTech web application that empowers citizens to report water-related public utility issues (such as leakages, supply shortages, contamination, and low pressure) and provides municipal water authorities with a robust dashboard to track, prioritize, and resolve them.

---

## 🧠 Project Context & Features

The primary objective of **WaterWatch** is to increase transparency, operational efficiency, and public safety.

### Key Features
1. **Citizen Reporting Form**:
   - Leaflet-powered interactive map pin with draggable location tracking.
   - GPS-powered geolocation auto-detection.
   - Automated physical address resolution using the free OpenStreetMap Nominatim reverse-geocoder API.
   - Styled severity radio blocks (Low, Medium, High, Critical) and client-side form validations.
2. **Proximity Duplicate Detection**:
   - Advanced server-side proximity check. If a citizen attempts to report an issue of the **same category** within **500 meters** of an active issue reported in the last **48 hours**, they receive a Warning Prompt with details of the active ticket. They can choose to track the existing ticket or bypass the duplicate warning to submit a new report anyway.
3. **Interactive Issue Map**:
   - Full-screen Leaflet map colored by issue category (🔵 Blue = Leakage, 🔴 Red = Contamination, 🟡 Yellow = Shortage, ⚫ Grey = Low Pressure).
   - Marker clustering using the Leaflet.markercluster plugin.
   - Heatmap hotspots visualization toggle (via Leaflet.heat plugin).
   - Sidebar filters (status, severity, category) and live keyword searching.
   - Double-clicking any empty map spot pre-fills a report form with those exact coordinates.
   - Dynamic auto-refresh loop updating markers every 60 seconds.
4. **Complaint Status Tracker**:
   - Look up display ID (e.g. `WW-00042`) or directly link from reporting/mapping actions.
   - Beautiful stepper timeline (`Reported` ➔ `Under Review` ➔ `In Progress` ➔ `Resolved`).
   - Glowing pulses on active tasks and solid green checkmarks on completed ones.
   - Live remarks and resolution timestamps.
5. **Authority Control Terminal (Dashboard)**:
   - Dynamic aggregate cards (Total tickets, Pending, In Progress, Resolved).
   - Interactive analytical charts using **Chart.js** (Timeline history line plot, Categories distribution bar chart, Status breakdown doughnut).
   - Embedded administrative mini-map of active tickets.
   - Sortable columns, search indexes, and status update controls (PATCH routes + authority notes).
   - Mock Notification dispatch: Simulates sending email alerts to citizens upon status updates, logging a formatted notification card in the server log.
   - **Spreadsheet CSV Data Export**: Downloads currently filtered pipelines instantly into formatted CSV spreadsheets.

---

## 📁 Repository Structure

```
waterwatch/
├── backend/
│   ├── app.py                  # Flask entry point + SQLAlchemy SQLite models + all API routes
│   ├── seed.py                 # SQLite database seeder with 18 realistic Bangalore complaints
│   ├── requirements.txt        # Python backend package dependencies
│   └── waterwatch.db           # Auto-generated SQLite database file (placed inside backend/)
├── frontend/
│   ├── index.html              # Citizen Landing + Geolocation Complaint Form
│   ├── map.html                # Interactive map panel (clusters, heatmaps, search filters)
│   ├── track.html              # Stepper ticket tracker
│   ├── dashboard.html          # Control Terminal (analytics, mini-map, operational table, modals)
│   ├── manifest.json           # PWA standalone manifest
│   ├── css/
│   │   └── style.css           # Premium styling tokens, typography, animations, responsive variables
│   └── js/
│       ├── submit.js           # Form map controllers, reverse geocoders, and duplicate warning prompts
│       ├── map.js              # Full-screen maps rendering, custom markers, clusters, heatmaps
│       ├── track.js            # ID tracking lookups and progress timeline binding
│       └── dashboard.js        # Table sorting, Chart.js integrations, PATCH requests, CSV exporters
├── Procfile                    # Render production process configurations
└── README.md                   # This documentation handbook
```

---

## 🎨 Unified Design System

WaterWatch is styled using a custom, high-fidelity color scheme tailored to clean water civic services:

- **Primary Blue (`#0077B6`)**: Base brand color.
- **Alice Blue (`#F0F8FF`)**: Background and soft gradients.
- **Dark Slate (`#1A1A2E`)**: Body typography and text readability.
- **Status Badges**: Grey (Reported), Blue (Under Review), Orange (In Progress), Green (Resolved).
- **Severity Indices**: Low (Green), Medium (Orange), High (Red), Critical (Dark Red + pulsing outline).
- **Premium Font Families**: *Sora* (headings), *Inter* (body), and *JetBrains Mono* (Ticket ID numbers).

---

## 🔌 REST API Endpoint Specifications

The backend server is CORS-enabled and exposes the following endpoints:

| Method | Endpoint | Description | Query Parameters / JSON Payloads |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/complaints` | Submits a new water issue. Conducts 500m duplicate check. | JSON: `{ title, description, issue_type, severity, latitude, longitude, address, reporter_name, reporter_email, bypass_duplicate }` |
| **GET** | `/api/complaints` | Lists complaints sorted by newest first. | Query Params: `status`, `issue_type`, `severity`, `search`, `limit` (default 50), `offset` |
| **GET** | `/api/complaints/<id>` | Retrieves full details of a single ticket. | URL Variable: `id` (integer primary key) |
| **PATCH**| `/api/complaints/<id>/status`| Updates status and appends remark. Triggers mock email. | JSON: `{ status, authority_note }` |
| **GET** | `/api/stats` | Computes aggregation counts and 30-day timeline history. | *None* |
| **GET** | `/api/complaints/nearby` | Queries complaints within a coordinate radius in km. | Query Params: `latitude` (float), `longitude` (float), `radius_km` (float, default 0.5), `issue_type` (optional) |

---

## 🚀 Quick Setup Instructions

### Prerequisites
- **Python 3.11+** installed on your system.
- An internet connection to load mapping stylesheets and icons from free CDNs.

### Step 1: Initialize Backend & Install Dependencies
1. Navigate to the project root directory:
   ```bash
   cd waterwatch
   ```
2. Create and activate a Python virtual environment (optional but recommended):
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install package requirements:
   ```bash
   pip install -r backend/requirements.txt
   ```

### Step 2: Seed the Database
WaterWatch includes a seeder script that populates the database with 18 realistic complaints in Bangalore, India, distributed across the past 30 days. This allows you to demo the map, search filters, and analytics dashboard immediately.
```bash
cd backend
python seed.py
cd ..
```

### Step 3: Run the Local Servers
1. **Start Flask Backend Server**:
   ```bash
   python backend/app.py
   ```
   The API will start running locally at **`http://localhost:5000`**.
2. **Launch the Frontend**:
   Simply open `frontend/index.html` directly in your browser, or spin up a simple HTTP web server inside the root directory:
   ```bash
   # Using Python to host:
   python -m http.server 3000
   ```
   Then open **`http://localhost:3000/frontend/`** in your browser.

---

## 🛠️ Demonstration Walkthrough Guide

1. **Submit a Complaint**:
   - Go to `Home` (`index.html`).
   - Click "Detect My Location" to fetch coords and autocomplete address, or manually drag the marker on the mini-map.
   - Enter a title and description (minimum 30 characters). Select Category and Severity, and submit.
   - Note the resulting Ticket ID card (e.g. `WW-00019`).
2. **Check Proximity duplicate warning**:
   - Go to the form again, select the same category (e.g. Leakage), and drag the marker back to the exact same area.
   - Fill out details and hit submit. The system will halt submission and show a Warning Modal with details of your previous report, letting you track the active issue or bypass it.
3. **Interactive Map**:
   - Go to `Interactive Map` (`map.html`).
   - Toggle "Heatmap Overlay" to view report hotspots in real time, or toggle "Enable Clusters" to group close-range issues.
   - Use the sidebar check-filters and text search boxes to update plotting instantly.
   - Double click anywhere on the empty map grid to open a quick popup to report an issue at those specific coordinates.
4. **Status Tracker**:
   - Go to `Track Complaint` (`track.html`).
   - Enter your Ticket ID (`WW-XXXXX`) to view the custom stepper timeline.
5. **Control Dashboard**:
   - Go to `Authority Dashboard` (`dashboard.html`).
   - Inspect the live Chart.js visualizations, active mini-map, and Pipeline Table.
   - Click "Update" on a ticket row. Select a new status (e.g. `In Progress` or `Resolved`) and add an authority note, then save.
   - Observe the server log terminal to view the beautifully printed **mock dispatch email** alert.
   - Try the "Export CSV Data" button to download spreadsheet snapshots of your filtered tickets.

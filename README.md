### 🕒 Chronos: Smart Productivity Tracker
A full-stack web activity tracker that uses a Chrome Extension to log browsing telemetry and a containerized FastAPI backend to visualize productivity in real-time.

## 🚀 The Mission
Most time trackers are "naive"—they count time as long as a tab is open. Chronos is built for high-fidelity accuracy by utilizing the Chrome Idle API and Media Playback detection to ensure your "Deep Work" stats reflect reality, not just idle tabs.

## 🛠️ Tech Stack
Extension: JavaScript (Chrome APIs: Tabs, Idle, Runtime, Sessions)

Backend: Python 3.12+ (FastAPI, SQLAlchemy, Pydantic)

Infrastructure: Docker & Docker Compose

Registry: GitHub Container Registry (ghcr.io)

Database: SQLite (Persistent O(1) daily SQL filtering)

Dashboard: HTML5/CSS3 + Chart.js 4.x (Interactive Visualization)

## ✨ Key Features
Background Daemon: Runs as a containerized service with a restart: always policy. No manual terminal management required; it starts automatically with your OS.

The Midnight Split: Proprietary backend logic that automatically closes "Yesterday's" sessions at 23:59:59 and opens "Today's" at 00:00:00 for perfect daily reporting.

Intelligent Idle & Video Bypass: Automatically pauses tracking after 15 seconds of inactivity unless the active tab is playing audio/video (e.g., YouTube lectures or Spotify).

Persistent Volume Architecture: Utilizes Docker volumes to map local SQLite data (./data) into the container, ensuring your history survives updates and is never exposed to public version control.

Interactive 24-Hour Timeline: A dynamic histogram that syncs with your local timezone (IST) and allows for "drill-down" filtering by clicking domain slices in the doughnut chart.

## ⚙️ Setup & Installation
1. The Modern Way (Docker - Recommended)
The most reliable way to run Chronos. This handles all dependencies and background execution automatically.

```Bash
# Clone the repository
git clone https://github.com/idosch21/productivity-tracker.git
cd productivity-tracker
```


# Start the background service
```bash
docker compose up -d
```

2. The Development Way (Manual venv)
Use this if you need to debug the Python logic directly.

```Bash
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

## 📦 Deployment & CI/CD
This project is integrated with GitHub Container Registry (GHCR) for easy deployment to cloud providers like AWS.

Official Image: ghcr.io/idosch21/chronos-api:latest

Persistence: The database lives at ./data/chronos.db on the host machine to ensure data safety across container rebuilds.

## 🚧 Roadmap
[x] Date Filtering: Explore historical activity via calendar picker.

[x] Containerization: Full Docker & Docker Compose integration.

[x] Cloud Registry: Automated image hosting via GHCR.

[ ] Mobile Sync (WIP): Utilizing chrome.sessions to proxy iPhone Chrome tabs via the desktop extension.

[ ] Weekly Reports: Automated email summaries of productivity trends.

Created by Ido

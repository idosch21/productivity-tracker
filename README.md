🕒 Chronos: Smart Productivity Tracker
A full-stack web activity tracker that uses a Chrome Extension to log browsing telemetry and a FastAPI backend to visualize productivity in real-time.

🚀 The Mission
Most time trackers are "naive"—they count time as long as a tab is open. Chronos is built for accuracy by utilizing the Chrome Idle API and Media Playback detection to ensure your "Deep Work" stats reflect reality, not just open tabs.

🛠️ Tech Stack
Extension: JavaScript (Chrome APIs: Tabs, Idle, Storage)

Backend: Python 3.10+ (FastAPI, Pydantic, SQLAlchemy)

Database: SQLite (Relational data for precise timelines)

Dashboard: HTML5/CSS3 + Chart.js (Interactive Data Visualization)

✨ Key Features (Newly Updated!)
Intelligent Idle Detection & Video Bypass: Automatically stops the clock after 15 seconds of inactivity. However, if the active tab is playing audio or video (e.g., YouTube lectures or Netflix), Chronos knows to keep the timer running.

Historical Data Explorer: Beyond "Today's Stats," you can now use a built-in calendar picker to jump to any specific date in your history to see what you were doing.

Domain Aggregation: Automatically peels the domain name (e.g., google.com) from messy URLs for clean, readable analytics.

Session Guard: Automatically filters out "noise" data, such as local project files (file:///), Chrome settings, and the tracker's own dashboard.

⚙️ Setup & Installation
1. Backend (FastAPI)
Bash
# Clone the repository
git clone https://github.com/idosch21/productivity-tracker.git
cd productivity-tracker

# Create and activate virtual environment
python -m venv venv
.\venv\Scripts\activate  # On Windows

# Install dependencies
pip install fastapi uvicorn sqlalchemy pydantic
2. Chrome Extension
Open chrome://extensions/ in your browser.

Enable Developer Mode.

Click Load Unpacked and select the extension folder from this project.

3. Dashboard
Simply open index.html in your browser to view your live stats!

🚧 Roadmap
[x] Date Filtering: Explore history day-by-day.

[x] Audible Detection: Stay active while watching educational content.

[ ] Category Tagging: Auto-tag sites as "Productive" (GitHub, StackOverflow) or "Distraction".

[ ] Daily Goals: Set a target for "Study Time" and track your progress bar.

[ ] Dark Mode: Because every dev loves dark mode.

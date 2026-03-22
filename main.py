from pydantic import BaseModel
from fastapi import FastAPI,Query
from sqlalchemy import create_engine,Column,Integer,String
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime,time,timedelta , timezone 
from sqlalchemy import DateTime,func,Float,Date
from datetime import date as date_obj


##We tell the program where to create our database file. 
##'sqlite:///./data/tracker.db' means: Create a simple file named tracker.db in "data" folder.
DATABASE_URL = "sqlite:///./data/tracker.db"

## The 'Engine' is the physical connection between Python and the database file.
engine = create_engine(DATABASE_URL)

## 'SessionLocal' is like a factory. Every time we need to save or read data, 
## we use this factory to create a new "Session" (a temporary connection).
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

## 'Base' is a template that all our database models will follow.
Base = declarative_base()

## This is the 'Activity' schema. It defines what a data packet should look like 
## when it travels from the extension to the server.
class Activity(BaseModel):
    url:str
    domain:str
    timestamp:datetime = None
    time_spent : float = 0.0
    
    class Config:
        from_attributes = True
    
## This is the 'DBActivity' model. It defines the actual "Table" in our database.
## It tells the database to create columns for an ID, URL, Domain, Time and total duration per session.
class DBActivity(Base):
    __tablename__ = "activities"
    id = Column(Integer, primary_key=True, index=True)# Unique ID for every row
    url = Column(String)
    domain = Column(String)
    # This automatically records the exact second the entry is saved to the DB.
    time_start = Column(DateTime,default=lambda: datetime.now())
    time_end = Column(DateTime,nullable=True)
    date = Column(Date, default=lambda: datetime.now().date())
    duration_seconds = Column(Float,default = 0.0)


## This line actually goes into the folder and physically creates the 
## 'tracker.db' file if it doesn't exist yet.
Base.metadata.create_all(bind=engine)
    
## We initialize the FastAPI application.    
app = FastAPI()

## 'CORS' is like a security guard. 
## By default, browsers block extensions from talking to servers.
## This block "Allows" the extension to send data to this Python script safely.
app.add_middleware(
   CORSMiddleware,
   allow_origins=["*"], # Allows the extension to talk to the server
   allow_methods=["*"], # Allows all types of requests (POST, GET, etc.)
   allow_headers=["*"],
)

def get_now():
    return datetime.now()
 
##This is the "Data Entry" endpoint.
##Every time the extension detects a change, it "POSTs" the data of the session to be saved in our database.
@app.post("/log")
def root(data:Activity):
    ##We open a way to our database.
    db = SessionLocal()
    now = get_now()
    
    try:
        #we query for the last activity that is in the data base.
        last_activity = db.query(DBActivity).filter(DBActivity.time_end == None).first()
        
        if last_activity:
            
            if last_activity.time_start.date() < now.date():
                #This section detects if the session is happening during midnight, so it knows to close the session
                #at 23:59:59 and reopen another one at 00:00:00 so our data is more accurate.
                yesterday_midnight =datetime.combine(last_activity.time_start.date(),time.max)
                last_activity.time_end = yesterday_midnight
                last_activity.duration_seconds = (yesterday_midnight-last_activity.time_start).total_seconds()
                db.commit()
                
                today_midnight = datetime.combine(now.date(),time.min)
                new_today_entry = DBActivity(url = last_activity.url,domain = last_activity.domain,time_start = today_midnight,time_end= None,date = now.date())
                db.add(new_today_entry)
                db.commit()
                print(f"Midnight split handled for {last_activity.domain}")
                return {"status": "midnight_split_handled"}
            
            if last_activity.domain == data.domain:
                return {"status": "continue session","domain": data.domain}
            last_activity.time_end = now
            
            duration = (last_activity.time_end - last_activity.time_start).total_seconds()
            last_activity.duration_seconds = duration
            db.commit()
        if data.domain != "IDLE":
            #if the domain is not IDLE then we add the data to our database.
            new_entry = DBActivity(url = data.url,domain = data.domain,time_start = now,time_end = None,date = now.date())
            db.add(new_entry)
            db.commit()
            db.refresh(new_entry)
            print(f"new session started: {data.domain}")
        else:
            print("system is IDLE. No new session started")
        return {"status": "saved", "time": now}
    except Exception as e:
            db.rollback()
            print(f"Database Error: {e}")    
    finally:
        db.close()
    
    
##This is the "History" endpoint, which gets us all the data since the database was created.
@app.get("/summary/all")
def get_history():
    with SessionLocal() as db:
        summary = {}
        ignored_domains = ["127.0.0.1", "newtab", "extensions","IDLE","System/New Tab","chrome-extension://","file://","localhost"]
        results = db.query(DBActivity.domain,func.sum(DBActivity.duration_seconds).label("total_seconds")).filter(DBActivity.domain.notin_(ignored_domains)).group_by(DBActivity.domain).all()


        for domain, total_seconds in results:
            if total_seconds <=0:
                continue
            is_ignored = any(ign in domain for ign in ignored_domains)
            if not is_ignored:
                summary[domain] = total_seconds
        
    return summary


##This function gets total amount of seconds a site was active,
##and breaks it into hour,minutes,seconds instead of just seeing seconds
##for better understanding of how long a site was active.
def format_time(total_seconds):
    total_seconds = int(total_seconds)
    hours = total_seconds //3600
    
    remaining_seconds = total_seconds % 3600
    minutes = remaining_seconds // 60
    
    seconds = remaining_seconds %60
    
    parts = []
    if hours >0:
        parts.append(f"{hours}h")
    if minutes > 0 or hours > 0:
        parts.append(f"{minutes}m")
    parts.append(f"{seconds}s")
    
        
    return " ".join(parts)

##This is the "Today's Report" endpoint.
##When we refresh the dashboard, the browser calls this function to get the latest stats.
@app.get("/summary/today")
def get_today_data():
    ##We open a way to our database.
    db = SessionLocal()
    try:
        now = get_now()
        current_date = now.date()
        
        
        ##We calculate when is "today"(I defined it to be midnight of the current day)
        ##So that we only get data from 00:00 to 23:59.
        today_start = datetime.combine(now.date(),datetime.min.time())
        
        
        ##We query from the database for all the entries that are in the database filtered by when they were created.
        ##We want only the entires that were created after 00:00.
        ##we want the entires to be in the order they were created at so we can calculate the duration between them correctly.
        today_data = db.query(DBActivity).filter(DBActivity.time_start >=today_start).order_by(DBActivity.time_start).all()
        
        ##Today is ongoing, so end_limit is 'now'
        ##We send the entires we received from the database and get the times for each domain.
        return calculate_summary_from_entries(today_data,end_limit=now)
    finally:
            db.close()
    
@app.get("/timeline")#needs to fix
def get_timeline(target_date :str =Query(None),domain:str=None):
    with SessionLocal() as db:
        
        
        now = get_now()
        
        if target_date:
            try:
                selected_date = datetime.strptime(target_date, '%Y-%m-%d').date()
            except ValueError:
                return {"error": "Invalid date format. Use YYYY-MM-DD"}
        else:
            selected_date = now.date()
            
            
        query = db.query(DBActivity).filter(DBActivity.date == selected_date)
        if domain:
            query = query.filter(DBActivity.domain.contains(domain))
        data = query.order_by(DBActivity.time_start).all()
        
        print(f"DEBUG: Timeline requested for {domain or 'Total'}. Found {len(data)} rows.")
        if not data: 
            return {"events": []}
        
        # Define the 'End Limit' for active sessions
        # If we are looking at TODAY, an open tab ends at 'now'.
        # If we are looking at the PAST, an open tab technically ended at midnight 
        # of that day (to avoid leaking data into the next day).
        if selected_date == now.date():
            end_limit = now
        else:
            # End of the selected day (23:59:59)
            end_limit = datetime.combine(selected_date, datetime.max.time())
            
        # Debug: Check your terminal! If this is 0, the DB isn't finding rows.
        print(f"DEBUG: Found {len(data)} rows for timeline today.")
        
        
        # DATA CLEANING & INTERVAL CREATION
        # We convert DB rows into simple (start, end) tuples.
        # This is where we handle the "Live" session (end = now).
        ignored = ["127.0.0.1", "newtab", "extensions", "IDLE", "System/New Tab", "localhost"]
        intervals = []
        for entry in data:
            if entry.domain and not any(ign in entry.domain for ign in ignored):
                # If a session is currently active (time_end is None), 
                # we 'clip' its end to exactly 'now'.
                end_time = entry.time_end if entry.time_end else end_limit
                intervals.append((entry.time_start,end_time))
        
        if not intervals:
            return {"events":[]}
        # THE GREEDY MERGE ALGORITHM
        # First, we sort by start time.
        intervals.sort()
        
        merged = [intervals[0]]
        for current_start , current_end in intervals[1:]:
            prev_start , prev_end =merged[-1]
            # If the current activity started BEFORE the previous one ended, 
            # they overlap.
            if current_start <= prev_end:
                # We merge them by extending the end time to the latest one.
                merged[-1] = (prev_start, max(prev_end,current_end))
            else:
                # No overlap? This is a new "block" of activity.
                merged.append((current_start,current_end))
                
        # SINGLE-PASS BUCKET DISTRIBUTION 
        # We have 24 buckets (one for each hour).
        hourly_seconds = [0.0] * 24
        
        for m_start,m_end in merged:
            # We only check the hours this specific interval actually touches.
            # Example: An interval from 10:45 to 11:15 only touches hours 10 and 11.
            start_hour = m_start.hour
            end_hour = m_end.hour
            
            for h in range(start_hour,end_hour +1):
                # We define the 'box' for this specific hour (e.g., 10:00:00 to 11:00:00).
                h_start = m_start.replace(hour=h,minute = 0,second = 0,microsecond = 0)
                h_end = h_start +timedelta(hours=1)
                
                # We find the intersection: The part of the activity inside this hour.
                # Intersection = [max(starts), min(ends)]
                overlap_start = max(m_start,h_start)
                overlap_end = min(m_end,h_end)
                
                if overlap_start < overlap_end:
                    # Add those specific seconds to the correct hourly bucket.
                    hourly_seconds[h] += (overlap_end - overlap_start).total_seconds()
        
        # Chart.js expects a list of objects. We map our 24 buckets to the UI.            
        day_base = datetime.combine(selected_date,datetime.min.time())
        events = [{
            "timestamp": (day_base + timedelta(hours = i)).strftime('%Y-%m-%dT%H:%M:%S'),
            "duration":min(sec,3600),
            "domain": domain if domain else "Total Activity"}
                for i,sec in enumerate(hourly_seconds)]
           
        return {"events": events}                                                           

@app.get("/summary/date/{date_str}")
def get_specific_date_data(date_str:str):
    db = SessionLocal()
    
    try:
        ##Parse the string (e.g., "2026-03-11") into a date object
        target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        today = datetime.now().date()
        
        ##Query only for that specific window
        data = db.query(DBActivity).filter(DBActivity.date == target_date).all()
        if target_date == today:
            end_limit = get_now()
        else:
            end_limit = datetime.combine(target_date,datetime.max.time())
        return calculate_summary_from_entries(data, end_limit=end_limit)
    except ValueError:
        return {"error": "Invalid date format. Use YYYY-MM-DD"}
    finally:
        db.close()
    

##Here we calculate the time each domain was active, and return the output as
##an easy to view time format.(hours, minutes, seconds)
def calculate_summary_from_entries(data,end_limit=None):
    
    if not data:
        return {} # Return empty if no data, prevents crashing
        
    if end_limit is None:
        end_limit = get_now()
    
    raw_summary = {}
    
    ##We create a list of "junk" data that we don't want to show on our charts.
    ##This includes when the computer was IDLE or on a blank New Tab.
    ignored_domains = ["127.0.0.1", "newtab", "extensions","IDLE","System/New Tab","chrome-extension://","file://","localhost"]

    ##data contains the data of the entries we have in our database,
    ##meaning that for each entry if it reached the backend, it passed the processing of the forntend,
    #meaning that the domain and timestamp are valid and we can start calculating for each domain
    ##its total time.
    
    for entry in data:
        domain = entry.domain
        if domain in ignored_domains:
            continue
        if any(ignored in domain for ignored in ignored_domains):
            continue
        if entry.time_end is None:
            duration = (end_limit-entry.time_start).total_seconds()
        else:
            duration = entry.duration_seconds
        
        duration = 0 if duration < 0 else duration
        
        if domain not in raw_summary:
            raw_summary[domain] = 0.0
        raw_summary[domain] += duration
        
    #display_summary = {}
    #for domain,seconds in raw_summary.items():
    #    if seconds > 0:
    #        display_summary[domain] =format_time(seconds)
    return raw_summary

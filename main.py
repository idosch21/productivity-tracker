from pydantic import BaseModel
from fastapi import FastAPI
from sqlalchemy import create_engine,Column,Integer,String
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime,time,timedelta
from sqlalchemy import DateTime


##We tell the program where to create our database file. 
##'sqlite:///./tracker.db' means: "Create a simple file named tracker.db in this folder."
DATABASE_URL = "sqlite:///./tracker.db"

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
## It tells the database to create columns for an ID, URL, Domain, and Time.
class DBActivity(Base):
    __tablename__ = "activities"
    id = Column(Integer, primary_key=True, index=True)# Unique ID for every row
    url = Column(String)
    domain = Column(String)
    # This automatically records the exact second the entry is saved to the DB.
    timestamp = Column(DateTime, default=datetime.utcnow)


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
 
##This is the "Data Entry" endpoint.
##Every time the extension detects a change, it "POSTs" the data here to be saved.
@app.post("/log")
def root(data:Activity):
    ##We open a way to our database.
    db = SessionLocal()
    
    ##We prepare a new row for our database table using the URL and Domain 
    ##that the extension just sent us.
    new_entry = DBActivity(url=data.url, domain=data.domain)
    
    ##If the extension sends the word "IDLE" 
    ##as the URL, we make sure the domain is also recorded as "IDLE".
    domain_name = "IDLE" if data.url =="IDLE"else data.domain
    
    ##We tell the database to add this new row to the table.
    db.add(new_entry)
    db.commit()
    ##We refresh the object so we can see the exact time the database 
    ##assigned to this entry (the timestamp).
    db.refresh(new_entry)
    db.close()
    
    print(f"saved to DB: {data.domain}")
    return {"status":"saved","time": new_entry.timestamp}

##This is the "History" endpoint, which gets us all the data since the database was created.
@app.get("/summary/all")
def get_history():
    ##We open a way to our database.
    db = SessionLocal()
    ##We query for all the entries in the database ordered by the time they were created
    ##so we can calculate them in "calculate_summary_from_entries".
    history = db.query(DBActivity).order_by(DBActivity.timestamp).all()
    db.close()
    
    ##We send the entires we received from the database and get the times for each domain.
    return calculate_summary_from_entries(history) 

##This function gets total amount of seconds a site was active,
##and breaks it into hour,minutes,seconds instead of just seeing seconds
##for better understanding of how long a site was active.
def format_time(total_seconds):
    total_seconds = int(total_seconds)
    hours = total_seconds //3600
    
    remaining_seconds = total_seconds % 3600
    minutes = remaining_seconds // 60
    
    seconds = remaining_seconds %60
        
    return f"{hours}h {minutes}m {seconds}s"

##This is the "Today's Report" endpoint.
##When you refresh your dashboard, the browser calls this function to get the latest st ats.
@app.get("/summary/today")
def get_today_data():
    ##We open a way to our database.
    db = SessionLocal()
    
    ##We calculate when is "today"(I defined it to be midnight of the current day)
    ##So that we only get data from 00:00 to 23:59.
    today_start = datetime.combine(datetime.utcnow().date(), datetime.min.time())
    ##We query from the database for all the entries that are in the database filtered by when they were created.
    ##We want only the entires that were created after 00:00.
    ##we want the entires to be in the order they were created at so we can calculate the duration between them correctly.
    today_data = db.query(DBActivity).filter(DBActivity.timestamp >=today_start).order_by(DBActivity.timestamp).all()
    db.close()
    ##Today is ongoing, so end_limit is 'now'
    ##We send the entires we received from the database and get the times for each domain.
    return calculate_summary_from_entries(today_data,end_limit=datetime.utcnow())
    
@app.get("/summary/date/{date_str}")
def get_spesific_date_data(date_str:str):
    db = SessionLocal()
    
    try:
        ##Parse the string (e.g., "2026-03-11") into a date object
        target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        
        ##Define the window: Start of the day and End of the day
        start_of_day = datetime.combine(target_date, datetime.min.time())
        end_of_day = datetime.combine(target_date, datetime.max.time())
        
        ##Query only for that specific window
        data = db.query(DBActivity).filter(DBActivity.timestamp >= start_of_day, DBActivity.timestamp <=end_of_day).order_by(DBActivity.timestamp).all()
        return calculate_summary_from_entries(data,end_limit=end_of_day)
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
        end_limit = datetime.utcnow()
    raw_summary = {}
    
    ##We create a list of "junk" data that we don't want to show on our charts.
    ##This includes when the computer was IDLE or on a blank New Tab.
    ignored_domains = ["127.0.0.1", "newtab", "extensions","IDLE","System/New Tab","chrome-extension://","file://","localhost"]

    ##data contains the data of the entries we have in our database,
    ##meaning that for each entry if it reached the backend, it passed the processing of the forntend,
    #meaning that the domain and timestamp are valid and we can start calculating for each domain
    ##its total time.
    
    for i in range(len(data)):##We calculate the duration by looking at the 'Next' entry's time.
        
        current_entry = data[i]
        if i < len(data) - 1:
            ##Duration = (Time of next website) - (Time of this website)
            next_entry = data[i+1]
            duration_seconds = (next_entry.timestamp - current_entry.timestamp).total_seconds()
        else:
            ##If this is the last entry, we calculate from its start until "Right Now".
            duration_seconds = (end_limit - current_entry.timestamp).total_seconds()
            ##We convert that time difference into raw seconds.
            
        if duration_seconds > 120 or duration_seconds > 14400:
            duration_seconds = 60  # Give a standard 1-min credit
        
        if duration_seconds < 0:
            duration_seconds = 0
        
        domain = current_entry.domain
                
        ##If the website is in our "junk" list, we skip it.
        ##We do this AFTER calculating the time, so the 'IDLE' time 
        ##doesn't accidentally get added to the website you visited before it.
        if any(junk in domain for junk in ignored_domains):
            continue
        ##If this is the first time we've seen this domain today, start at 0.
        if domain not in raw_summary:
            raw_summary[domain] = 0.0
        ##Add the seconds we just calculated to that domain's total.
        raw_summary[domain] += duration_seconds

    # Format the results
    display_summary = {}
    
    for domain,seconds in raw_summary.items():
        if (seconds > 0):
            display_summary[domain] = format_time(seconds)

    return display_summary
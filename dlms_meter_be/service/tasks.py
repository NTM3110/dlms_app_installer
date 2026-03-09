from celery import Celery
from celery.schedules import crontab
from datetime import datetime, timedelta
import os

# Initialize Celery app
# We use typical defaults (Redis or filesystem broker can be used, for local simple setup let's use an easy SQLite/Redis broker if available, or just memory if testing).
# Using basic setup for Celery. You will need redis running on localhost:6379, just like energy_app uses.
redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/1")
celery_app = Celery(
    "dlms_tasks",
    broker=redis_url,
    backend=redis_url
)

# Get data directory from environment or default to local 'data'
APP_DATA_DIR = os.environ.get("APP_DATA_DIR", "data")
if not os.path.exists(APP_DATA_DIR):
    os.makedirs(APP_DATA_DIR, exist_ok=True)

celery_app.conf.update(
    timezone="UTC",
    enable_utc=True,
    beat_schedule_filename=os.path.join(APP_DATA_DIR, "celerybeat-schedule")
)

@celery_app.on_after_configure.connect
def setup_periodic_tasks(sender, **kwargs):
    # We will trigger the schedule checker every minute. 
    # It will check the database to see if the auto_read_schedule time has been reached.
    sender.add_periodic_task(crontab(minute="*"), check_auto_read_schedule.s(), name='check-autocfg-every-minute')

@celery_app.task
def check_auto_read_schedule():
    from app.db import SessionLocal
    from app.models import AutoReadSchedule, MeterConfig
    from service.data_service import get_periodic_profile_data
    
    db = SessionLocal()
    try:
        schedule = db.query(AutoReadSchedule).first()
        if not schedule:
            return "No auto-read schedule configured."
            
        now = datetime.now().time()
        print(f"Current time: {now}")
        print(f"Scheduled time: {schedule.read_time}")
        
        # Check if current time is roughly matching the scheduled time (within the same minute)
        if now.hour == schedule.read_time.hour and now.minute == schedule.read_time.minute:
            # Time matched! Now fetch the previous day's profile for all meters
            print("Time matched! Fetching profile data for all meters...")
            target_date = (datetime.now() - timedelta(days=1)).date()
            meters = db.query(MeterConfig).all()
            
            success_count = 0
            for meter in meters:
                try:
                    # Calling get_periodic_profile_data will trigger the DLMS read and save to CSV
                    get_periodic_profile_data(db, target_date, meter.outstation)
                    success_count += 1
                except Exception as e:
                    print(f"Failed to auto-read for meter {meter.outstation}: {e}")
                    
            return f"Auto-read completed for {success_count}/{len(meters)} meters for date {target_date}"
            
    finally:
        db.close()

import os
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from datetime import date
from typing import List, Optional
from app.db import get_db
from service.data_service import (
    get_periodic_profile_data,
    get_instantaneous_data,
    get_csv_filename,
    generate_missing_data_report,
)

router = APIRouter(tags=["data"])

@router.get("/data/profile")
def read_profile(
    outstation: str = Query(..., alias="measurement_point", description="The outstation configured for the meter"),
    target_date: date = Query(..., description="The date to fetch the profile data for"),
    start_time: str = Query("00:00", description="Start time in HH:MM format (30-min resolution)"),
    end_time: str = Query("23:30", description="End time in HH:MM format (30-min resolution)"),
    csv_save_path: Optional[str] = Query(None, description="Custom directory path to read/save CSV files"),
    export_csv: bool = Query(False, description="Whether to export the profile data as a CSV file to download"),
    db: Session = Depends(get_db)
):
    try:
        result = get_periodic_profile_data(
            db,
            target_date,
            outstation,
            start_time=start_time,
            end_time=end_time,
            custom_data_dir=csv_save_path or None,
        )
        if export_csv:
            filepath = get_csv_filename(target_date, outstation, db, csv_save_path or None)
            if os.path.exists(filepath):
                return FileResponse(filepath, media_type="text/csv", filename=os.path.basename(filepath))
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/data/instantaneous")
def read_instantaneous(
    outstation: str = Query(..., alias="measurement_point", description="The outstation configured for the meter"),
    db: Session = Depends(get_db)
):
    try:
        result = get_instantaneous_data(db, outstation)
        return {"data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/data/missing-report")
def read_missing_report(
    measurement_points: List[str] = Query(..., description="One or more outstation IDs to check"),
    target_date: date = Query(..., description="The date to check for missing data"),
    start_time: str = Query("00:00", description="Start time in HH:MM format (30-min resolution)"),
    end_time: str = Query("23:30", description="End time in HH:MM format (30-min resolution)"),
    csv_path: Optional[str] = Query(None, description="Custom directory path where CSV files are stored"),
    db: Session = Depends(get_db)
):
    try:
        report = generate_missing_data_report(
            db,
            outstations=measurement_points,
            target_date=target_date,
            start_time=start_time,
            end_time=end_time,
            custom_data_dir=csv_path or None,
        )
        return {"report": report}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

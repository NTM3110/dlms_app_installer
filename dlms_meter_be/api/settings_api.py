from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from datetime import time
import app.models as models
from app.db import get_db

router = APIRouter(tags=["settings"])

class SerialSettingBase(BaseModel):
    name: str
    port: str
    baud_rate: int
    data_bits: int
    stop_bits: int
    parity: str

class SystemSettingBase(BaseModel):
    key: str
    value: str

class SystemSettingResponse(SystemSettingBase):
    id: int
    class Config:
        from_attributes = True

class SerialSettingResponse(SerialSettingBase):
    id: int
    class Config:
        from_attributes = True

class MeterConfigBase(BaseModel):
    outstation: str
    meter_name: str
    serial_id: int
    client_address: int = 16
    meter_hdlc_id: int
    logical_server_address: int = 1
    sn_referencing: str

class MeterConfigResponse(MeterConfigBase):
    id: int
    class Config:
        from_attributes = True

class AutoReadScheduleBase(BaseModel):
    read_time: time

class AutoReadScheduleResponse(AutoReadScheduleBase):
    id: int
    class Config:
        from_attributes = True

from gurux_serial.GXSerial import GXSerial

import sys

# Serial Setting
@router.get("/serial/ports", response_model=List[str])
def get_available_serial_ports():
    try:
        import serial.tools.list_ports
        ports = [port.device for port in serial.tools.list_ports.comports()]
        return ports
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/serial", response_model=List[SerialSettingResponse])
def get_serial_setting(db: Session = Depends(get_db)):
    return db.query(models.SerialSetting).all()

@router.post("/serial", response_model=SerialSettingResponse)
def create_serial_setting(setting: SerialSettingBase, db: Session = Depends(get_db)):
    db_setting = db.query(models.SerialSetting).filter(models.SerialSetting.name == setting.name).first()
    if db_setting:
        raise HTTPException(status_code=400, detail="Serial setting name already exists")
    new_setting = models.SerialSetting(**setting.dict())
    db.add(new_setting)
    db.commit()
    db.refresh(new_setting)
    return new_setting

@router.put("/serial/{id}", response_model=SerialSettingResponse)
def update_serial_setting(id: int, setting: SerialSettingBase, db: Session = Depends(get_db)):
    db_setting = db.query(models.SerialSetting).filter(models.SerialSetting.id == id).first()
    if not db_setting:
        raise HTTPException(status_code=404, detail="Serial setting not found")
    
    for key, value in setting.dict().items():
        setattr(db_setting, key, value)
    db.commit()
    db.refresh(db_setting)
    return db_setting

@router.delete("/serial/{id}")
def delete_serial_setting(id: int, db: Session = Depends(get_db)):
    db_setting = db.query(models.SerialSetting).filter(models.SerialSetting.id == id).first()
    if not db_setting:
        raise HTTPException(status_code=404, detail="Serial setting not found")
    
    if db_setting.meters:
         raise HTTPException(status_code=400, detail="Cannot delete serial setting used by meters")
         
    db.delete(db_setting)
    db.commit()
    return {"message": "Deleted successfully"}

# Meter Configs
@router.get("/meters", response_model=List[MeterConfigResponse])
def get_meter_configs(db: Session = Depends(get_db)):
    return db.query(models.MeterConfig).all()

@router.post("/meters", response_model=MeterConfigResponse)
def create_meter_config(meter: MeterConfigBase, db: Session = Depends(get_db)):
    db_serial = db.query(models.SerialSetting).filter(models.SerialSetting.id == meter.serial_id).first()
    if not db_serial:
        raise HTTPException(status_code=400, detail="Serial setting not found")

    db_meter = db.query(models.MeterConfig).filter(models.MeterConfig.outstation == meter.outstation).first()
    if db_meter:
        raise HTTPException(status_code=400, detail="Outstation already exists")
    new_meter = models.MeterConfig(**meter.dict())
    db.add(new_meter)
    db.commit()
    db.refresh(new_meter)
    return new_meter

@router.put("/meters/{id}", response_model=MeterConfigResponse)
def update_meter_config(id: int, meter: MeterConfigBase, db: Session = Depends(get_db)):
    db_meter = db.query(models.MeterConfig).filter(models.MeterConfig.id == id).first()
    if not db_meter:
        raise HTTPException(status_code=404, detail="Meter config not found")
        
    db_serial = db.query(models.SerialSetting).filter(models.SerialSetting.id == meter.serial_id).first()
    if not db_serial:
        raise HTTPException(status_code=400, detail="Serial setting not found")

    for key, value in meter.dict().items():
        setattr(db_meter, key, value)
    db.commit()
    db.refresh(db_meter)
    return db_meter

@router.delete("/meters/{id}")
def delete_meter_config(id: int, db: Session = Depends(get_db)):
    db_meter = db.query(models.MeterConfig).filter(models.MeterConfig.id == id).first()
    if not db_meter:
        raise HTTPException(status_code=404, detail="Meter config not found")
    db.delete(db_meter)
    db.commit()
    return {"message": "Deleted successfully"}

# Auto Read Schedule
@router.get("/schedule", response_model=AutoReadScheduleResponse)
def get_auto_read_schedule(db: Session = Depends(get_db)):
    db_schedule = db.query(models.AutoReadSchedule).first()
    if not db_schedule:
        # Create default
        db_schedule = models.AutoReadSchedule(read_time=time(0, 30))
        db.add(db_schedule)
        db.commit()
        db.refresh(db_schedule)
    return db_schedule

@router.put("/schedule", response_model=AutoReadScheduleResponse)
def update_auto_read_schedule(schedule: AutoReadScheduleBase, db: Session = Depends(get_db)):
    db_schedule = db.query(models.AutoReadSchedule).first()
    if not db_schedule:
        db_schedule = models.AutoReadSchedule(read_time=schedule.read_time)
        db.add(db_schedule)
    else:
        db_schedule.read_time = schedule.read_time
    db.commit()
    db.refresh(db_schedule)
    return db_schedule

import shutil
import os

@router.get("/settings/csv-path")
def get_csv_path(db: Session = Depends(get_db)):
    setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == "csv_storage_path").first()
    if not setting:
        from service.data_service import DATA_DIR
        return {"path": os.path.abspath(DATA_DIR)}
    return {"path": os.path.abspath(setting.value)}

@router.post("/settings/csv-path")
def update_csv_path(new_path: str, db: Session = Depends(get_db)):
    from service.data_service import DATA_DIR
    
    # Get current path
    setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == "csv_storage_path").first()
    old_path = setting.value if setting else DATA_DIR
    old_path = os.path.abspath(old_path)
    new_path = os.path.abspath(new_path)
    
    if old_path == new_path:
        return {"message": "Path is the same", "path": new_path}
    
    # Ensure new path exists
    if not os.path.exists(new_path):
        try:
            os.makedirs(new_path, exist_ok=True)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Could not create directory: {str(e)}")
            
    # Migrate files
    files_to_move = [f for f in os.listdir(old_path) if f.endswith(".csv")]
    moved_files = []
    
    try:
        for f in files_to_move:
            src = os.path.join(old_path, f)
            dst = os.path.join(new_path, f)
            shutil.copy2(src, dst) # Use copy2 to preserve metadata
            moved_files.append((src, dst))
            
        # Update database
        if not setting:
            setting = models.SystemSetting(key="csv_storage_path", value=new_path)
            db.add(setting)
        else:
            setting.value = new_path
        db.commit()
        
        # After successful commit, delete old files
        for src, dst in moved_files:
             try:
                 os.remove(src)
             except:
                 pass # Non-critical if we can't delete old files
                 
        return {"message": "Path updated and files migrated", "path": new_path}
        
    except Exception as e:
        # Rollback: delete copied files in new path
        for src, dst in moved_files:
            if os.path.exists(dst):
                try:
                    os.remove(dst)
                except:
                    pass
        raise HTTPException(status_code=500, detail=f"Migration failed: {str(e)}")

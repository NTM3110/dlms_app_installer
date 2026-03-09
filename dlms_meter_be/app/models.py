from sqlalchemy import Column, Integer, String, Time, ForeignKey
from sqlalchemy.orm import relationship
from .db import Base

class SerialSetting(Base):
    __tablename__ = "serial_setting"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    port = Column(String, default="COM1")
    baud_rate = Column(Integer, default=9600)
    data_bits = Column(Integer, default=8)
    stop_bits = Column(Integer, default=1)
    parity = Column(String, default="None") # "None", "Even", "Odd", "Mark", "Space"

    meters = relationship("MeterConfig", back_populates="serial")

class MeterConfig(Base):
    __tablename__ = "meter_config"

    id = Column(Integer, primary_key=True, index=True)
    outstation = Column(String, unique=True, index=True)
    meter_name = Column(String)
    serial_id = Column(Integer, ForeignKey('serial_setting.id'))
    client_address = Column(Integer, default=16)
    meter_hdlc_id = Column(Integer, default=1)
    logical_server_address = Column(Integer, default=1)
    sn_referencing = Column(String, default="ln") # 'sn' or 'ln'

    serial = relationship("SerialSetting", back_populates="meters")

class AutoReadSchedule(Base):
    __tablename__ = "auto_read_schedule"

    id = Column(Integer, primary_key=True, index=True)
    read_time = Column(Time, nullable=False) # Automatically read at this time for the previous day

class SystemSetting(Base):
    __tablename__ = "system_setting"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True)
    value = Column(String)

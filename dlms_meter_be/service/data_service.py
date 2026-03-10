import os
import csv
import datetime
import logging
from sqlalchemy.orm import Session
from app.models import MeterConfig, SerialSetting, SystemSetting
from service.dlms_service import read_profile_data, read_instantaneous_data

logger = logging.getLogger(__name__)

# Get data directory from environment or default
APP_DATA_DIR = os.environ.get("APP_DATA_DIR", ".")
DATA_DIR = os.path.join(APP_DATA_DIR, "data")
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR, exist_ok=True)

def _resolve_data_dir(db: Session = None, custom_data_dir: str = None) -> str:
    """Return the effective data directory, creating it if necessary."""
    if custom_data_dir and custom_data_dir.strip():
        d = custom_data_dir.strip()
    elif db:
        # Check database for custom path
        setting = db.query(SystemSetting).filter(SystemSetting.key == "csv_storage_path").first()
        if setting and setting.value:
            d = setting.value
        else:
            d = DATA_DIR
    else:
        d = DATA_DIR

    if not os.path.exists(d):
        try:
            os.makedirs(d, exist_ok=True)
        except Exception as e:
            logger.error(f"Failed to create directory {d}: {e}")
            return DATA_DIR # Fallback
    return d

def _time_str_to_interval_idx(time_str: str) -> int:
    """Convert 'HH:MM' string to 0-based 30-min interval index (0-47)."""
    try:
        h, m = map(int, time_str.split(':'))
        m = 0 if m < 30 else 30
        return h * 2 + (m // 30)
    except Exception:
        return 0

def _interval_idx_to_time_str(idx: int) -> str:
    """Convert 0-based interval index to 'HH:MM' string."""
    h = idx // 2
    m = 30 if idx % 2 else 0
    return f"{h:02d}:{m:02d}"

def get_csv_filename(target_date: datetime.date, outstation: str, db: Session = None, custom_data_dir: str = None):
    # format: ddmm{y}{outstation}.csv
    # where y is year - 2020
    data_dir = _resolve_data_dir(db, custom_data_dir)
    day = target_date.strftime("%d")
    month = target_date.strftime("%m")
    year_diff = target_date.year - 2020
    filename = f"{day}{month}{year_diff}{outstation}.csv"
    return os.path.join(data_dir, filename)

import re

def parse_meter_datetime(dt_str):
    if not isinstance(dt_str, str):
        return None
    m = re.search(r"(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{1,2}):(\d{1,2})", dt_str)
    if m:
        return datetime.datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)),
                                 int(m.group(4)), int(m.group(5)), int(m.group(6)))
    m = re.search(r"(\d{1,2})/(\d{1,2})/(\d{4})[ T](\d{1,2}):(\d{1,2}):(\d{1,2})", dt_str)
    if m:
        return datetime.datetime(int(m.group(3)), int(m.group(2)), int(m.group(1)),
                                 int(m.group(4)), int(m.group(5)), int(m.group(6)))
    return None

def get_interval_index(dt: datetime.datetime):
    return dt.hour * 2 + (dt.minute // 30)

def format_profile_data(headers: list, data: list, target_date: datetime.date):
    col_mapping = {
        "1.1.2.8.0.255": "kwhgiao",
        "1.1.1.8.0.255": "kwhnhan",
        "1.1.4.8.0.255": "kvarhgiao",
        "1.1.3.8.0.255": "kvarhnhan"
    }
    
    target_date_str = target_date.strftime("%d-%m-%y") if target_date else "00-00-00"
    
    series = {
        "kwhgiao": ["" for _ in range(48)],
        "kwhnhan": ["" for _ in range(48)],
        "kvarhgiao": ["" for _ in range(48)],
        "kvarhnhan": ["" for _ in range(48)]
    }
    
    col_indices = {}
    for idx, h in enumerate(headers):
        ln = h.get("logical_name")
        if ln in col_mapping:
            col_indices[ln] = idx
            
    max_interval_idx_read = -1
    seen_intervals = set()
    for row in data:
        if not row: continue
        dt = parse_meter_datetime(row[0])
        if not dt or dt.date() != target_date:
            continue
            
        idx = get_interval_index(dt)
        if 0 <= idx < 48:
            if idx > max_interval_idx_read:
                max_interval_idx_read = idx
            if idx in seen_intervals:
                logger.debug(f"Duplicate interval at index {idx} ({dt}), overwriting with latest value.")
            seen_intervals.add(idx)
            for ln, key in col_mapping.items():
                if ln in col_indices:
                    col_idx = col_indices[ln]
                    val = row[col_idx] if col_idx < len(row) else ""
                    if val is not None and str(val).strip() != "":
                        series[key][idx] = val
                        
    # For any intervals up to the latest one we successfully read,
    # if they are still "", it means the meter physically had no data (e.g., power outage).
    # We mark them as "NaN" so the `is_csv_complete` logic doesn't mistake them for 
    # intervals we simply haven't tried to fetch yet.
    if max_interval_idx_read >= 0:
        for key in series:
            for i in range(max_interval_idx_read + 1):
                if series[key][i] == "":
                    series[key][i] = "NaN"
                
    formatted_rows = []
    for key in ["kwhgiao", "kwhnhan", "kvarhgiao", "kvarhnhan"]:
        formatted_rows.append([target_date_str, key] + series[key])
        
    return formatted_rows

def merge_profile_data(csv_rows, new_rows):
    if not csv_rows:
        return new_rows
    
    csv_dict = {row[1]: row for row in csv_rows if len(row) >= 50}
    merged_rows = []
    
    for nrow in new_rows:
        if len(nrow) < 50:
            merged_rows.append(nrow)
            continue
            
        key = nrow[1]
        orow = csv_dict.get(key)
        if not orow:
            merged_rows.append(nrow)
            continue
            
        merged = [nrow[0], key]
        for i in range(48):
            v_new = nrow[2+i]
            v_old = orow[2+i]
            # Only overwrite if v_new is a real measured value (not empty and not NaN placeholder)
            if str(v_new).strip() not in ("", "NaN"):
                merged.append(v_new)
            else:
                merged.append(v_old)
        merged_rows.append(merged)
        
    return merged_rows

def is_csv_complete(csv_rows, target_date: datetime.date):
    if not csv_rows or len(csv_rows) < 4:
        return False
        
    now = datetime.datetime.now()
    if target_date < now.date():
        expected_intervals = 48
    else:
        # +1: the interval that STARTED at the current half-hour mark already has meter data.
        # Without +1, at exactly 14:00 the code would only check slots 0-27 and miss index 28.
        current_slot = now.hour * 2 + (now.minute // 30)
        expected_intervals = min(current_slot + 1, 49)

    if expected_intervals <= 0:
        return True
        
    expected_keys = {"kwhgiao", "kwhnhan", "kvarhgiao", "kvarhnhan"}
    complete_keys = set()
    
    for row in csv_rows:
        if len(row) >= min(expected_intervals, 48) + 2 and row[1] in expected_keys:
            # Check up to `expected_intervals` out of the 48 data columns (index 2 to 49)
            is_row_complete = True
            for i in range(min(expected_intervals, 48)):
                val = str(row[2+i]).strip()
                # Treat 'NaN' (or similar markers) as deliberately read but empty, rather than just "".
                # If it's literally "", it means we never populated that column at all.
                if val == "":
                    is_row_complete = False
                    logger.info(f"Row {row[1]} is not complete at interval {i}")
                    break
            
            if is_row_complete:
                complete_keys.add(row[1])
            
    # The file is only complete if all 4 parameters have their expected intervals filled
    return len(complete_keys) == 4

def save_profile_to_csv(filepath: str, formatted_rows: list):
    with open(filepath, mode="w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        for row in formatted_rows:
            writer.writerow(row)

def read_profile_from_csv(filepath: str):
    if not os.path.exists(filepath):
        return None
    rows = []
    with open(filepath, mode="r", encoding="utf-8") as file:
        reader = csv.reader(file)
        for row in reader:
            rows.append(row)
    return rows if rows else None

def get_periodic_profile_data(
    db: Session,
    target_date: datetime.date,
    outstation: str,
    start_time: str = "00:00",
    end_time: str = "23:30",
    custom_data_dir: str = None
):
    meter = db.query(MeterConfig).filter(MeterConfig.outstation == outstation).first()
    print("Meter:", meter.outstation if meter else None)
    if not meter:
        raise Exception(f"Meter with outstation '{outstation}' not found.")
        
    serial = db.query(SerialSetting).filter(SerialSetting.id == meter.serial_id).first()
    if not serial:
        raise Exception("SerialSetting not configured.")

    filepath = get_csv_filename(target_date, outstation, db, custom_data_dir)
    csv_rows = read_profile_from_csv(filepath)
    
    need_update = not is_csv_complete(csv_rows, target_date)
    
    if need_update:
        meter_data = read_profile_data(serial, meter, target_date)
        if "headers" in meter_data and "data" in meter_data:
            formatted_rows = format_profile_data(meter_data["headers"], meter_data["data"], target_date)
            final_rows = merge_profile_data(csv_rows, formatted_rows)
            save_profile_to_csv(filepath, final_rows)
            csv_rows = final_rows

    if csv_rows is None:
        return {"source": "none", "data": {"data": []}}

    # Filter interval columns to the requested time range
    start_idx = _time_str_to_interval_idx(start_time)
    end_idx = _time_str_to_interval_idx(end_time)
    filtered_rows = []
    for row in csv_rows:
        if len(row) >= 2:
            # col0=date, col1=variable, col2..=intervals
            intervals = row[2:]
            sliced = intervals[start_idx: end_idx + 1]
            filtered_rows.append(list(row[:2]) + sliced)
        else:
            filtered_rows.append(row)

    source = "meter_merged" if need_update else "csv"
    return {"source": source, "data": {"data": filtered_rows}}

def get_instantaneous_data(db: Session, outstation: str):
    meter = db.query(MeterConfig).filter(MeterConfig.outstation == outstation).first()
    if not meter:
        raise Exception(f"Meter with outstation '{outstation}' not found.")
        
    serial = db.query(SerialSetting).filter(SerialSetting.id == meter.serial_id).first()
    if not serial:
        raise Exception("SerialSetting not configured.")
        
    data = read_instantaneous_data(serial, meter)
    return data


def generate_missing_data_report(
    db: Session,
    outstations: list,
    target_date: datetime.date,
    start_time: str = "00:00",
    end_time: str = "23:30",
    custom_data_dir: str = None
):
    """
    For each outstation, read its CSV for target_date and find 30-min intervals
    within [start_time, end_time] that are missing (empty string).
    - If target_date is TODAY, future intervals (beyond current 30-min slot) are excluded.
    - If no CSV file exists, no_file=True is returned so FE can recommend reading profile.
    - Consecutive missing slots are collapsed into gap ranges.
    Returns: list of {meter, date, no_file, missing_gaps: [{from, to}]}
    """
    start_idx = _time_str_to_interval_idx(start_time)
    end_idx = _time_str_to_interval_idx(end_time)

    # Clip end_idx to current time when target_date is today
    now = datetime.datetime.now()
    if target_date == now.date():
        current_slot = now.hour * 2 + (now.minute // 30)
        # Only consider slots that have already started (current slot is available)
        effective_end_idx = min(end_idx, current_slot)
    else:
        effective_end_idx = end_idx

    report = []

    for outstation in outstations:
        filepath = get_csv_filename(target_date, outstation, db, custom_data_dir)
        csv_rows = read_profile_from_csv(filepath)

        if not csv_rows:
            # No CSV file at all for this date — flag separately so FE can recommend reading profile
            report.append({
                "meter": outstation,
                "date": target_date.strftime("%d-%m-%Y"),
                "no_file": True,
                "missing_gaps": [{
                    "from": _interval_idx_to_time_str(start_idx),
                    "to": _interval_idx_to_time_str(effective_end_idx)
                }] if effective_end_idx >= start_idx else []
            })
            continue

        # Collect missing interval indices across all 4 variable rows
        # An interval is "missing" if ALL variable rows have an empty value for it
        all_vars_empty = {}
        for row in csv_rows:
            if len(row) < 3:
                continue
            for i in range(start_idx, effective_end_idx + 1):
                col = i + 2  # offset: col0=date, col1=var, col2..=intervals
                val = str(row[col]).strip() if col < len(row) else ""
                is_empty = val in ("", "NaN")
                if i not in all_vars_empty:
                    all_vars_empty[i] = is_empty
                else:
                    # Only mark as missing if ALL variable rows are empty at this slot
                    all_vars_empty[i] = all_vars_empty[i] and is_empty

        # Collapse consecutive missing slots into ranges
        missing_gaps = []
        gap_start = None
        for i in range(start_idx, effective_end_idx + 1):
            if all_vars_empty.get(i, True):
                if gap_start is None:
                    gap_start = i
            else:
                if gap_start is not None:
                    missing_gaps.append({
                        "from": _interval_idx_to_time_str(gap_start),
                        "to": _interval_idx_to_time_str(i - 1)
                    })
                    gap_start = None
        if gap_start is not None:
            missing_gaps.append({
                "from": _interval_idx_to_time_str(gap_start),
                "to": _interval_idx_to_time_str(effective_end_idx)
            })

        report.append({
            "meter": outstation,
            "date": target_date.strftime("%d-%m-%Y"),
            "no_file": False,
            "missing_gaps": missing_gaps
        })

    return report

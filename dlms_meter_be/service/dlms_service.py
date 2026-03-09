import sys
import os
import datetime
import traceback


# ─── Unit display mapping ──────────────────────────────────────────────────────
def get_unit_display(unit_name, logical_name=""):
    unit_map = {
        "ACTIVE_ENERGY":    "Wh",
        "REACTIVE_ENERGY":  "varh",
        "AMBIENT_ENERGY":   "VAh",
        "APPARENT_ENERGY":  "VAh",
        "VOLTAGE":          "V",
        "CURRENT":          "A",
        "FREQUENCY":        "Hz",
        "ACTIVE_POWER":     "kW",
        "REACTIVE_POWER":   "kvar",
        "APPARENT_POWER":   "kVA",
        "PHASE_ANGLE_DEGREE": "°",
        "MINUTE":           "min",
        "ACTIVE":           "imp/Wh",
        "REACTIVE":         "imp/varh",
    }
    mapped = unit_map.get(unit_name, unit_name)
    if not mapped or mapped == "NO_UNIT":
        mapped = "hex" if "96.240.12" in logical_name else ""
    return mapped


# ─── Value decoders ───────────────────────────────────────────────────────────
def try_decode_hex_value(hex_str: str) -> str:
    """Try to decode a hex string as DLMS DateTime (12 bytes) or ASCII text."""
    try:
        raw = bytes.fromhex(hex_str)
    except Exception:
        return hex_str

    # DLMS DateTime: 12 bytes  [year(2), month, day, weekday, hour, min, sec, hundredths, deviation(2), status]
    if len(raw) == 12:
        year = (raw[0] << 8) | raw[1]
        month, day, _weekday, hour, minute, second = raw[2], raw[3], raw[4], raw[5], raw[6], raw[7]
        if 1990 <= year <= 2100 and 1 <= month <= 12 and 1 <= day <= 31:
            return f"{year:04d}-{month:02d}-{day:02d} {hour:02d}:{minute:02d}:{second:02d}"

    # DLMS Date: 5 bytes  [year(2), month, day, weekday]
    if len(raw) == 5:
        year = (raw[0] << 8) | raw[1]
        month, day = raw[2], raw[3]
        if 1990 <= year <= 2100 and 1 <= month <= 12 and 1 <= day <= 31:
            return f"{year:04d}-{month:02d}-{day:02d}"

    # ASCII text (strip null padding)
    try:
        text = raw.rstrip(b'\x00').decode('ascii')
        if text and all(c.isprintable() for c in text):
            return text
    except Exception:
        pass

    return hex_str


def format_register_value(val) -> str:
    """Format the already-scaled value returned by gurux reader.read()."""
    if val is None:
        return ""
    # Gurux may return a value wrapper object
    if hasattr(val, 'value'):
        val = val.value

    if isinstance(val, (bytes, bytearray)):
        hex_str = val.hex().upper()
        return try_decode_hex_value(hex_str)

    if isinstance(val, str):
        # Might already be a hex string from earlier path
        if all(c in '0123456789ABCDEFabcdef' for c in val) and len(val) % 2 == 0 and len(val) >= 8:
            decoded = try_decode_hex_value(val)
            if decoded != val:
                return decoded
        return val

    if isinstance(val, float):
        if val == int(val):
            return str(int(val))
        return f"{val:.4f}".rstrip('0').rstrip('.')

    return str(val)


from gurux_dlms.enums import ObjectType
from gurux_dlms.objects.GXDLMSObjectCollection import GXDLMSObjectCollection
from gurux_dlms.objects.GXDLMSRegister import GXDLMSRegister
from gurux_dlms.objects.GXDLMSExtendedRegister import GXDLMSExtendedRegister
from gurux_dlms.objects.GXDLMSDemandRegister import GXDLMSDemandRegister
from driver.GXSettings import GXSettings
from driver.GXDLMSReader import GXDLMSReader
from app.models import MeterConfig, SerialSetting

# Define CACHE_FILE with support for PyInstaller bundles
def get_cache_file():
    # When running as a PyInstaller bundle, sys._MEIPASS is the path to the bundle's root
    base_path = getattr(sys, '_MEIPASS', os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    # Cache file is located in the 'driver' directory
    return os.path.join(base_path, "driver", "meter_cache.xml")

CACHE_FILE = get_cache_file()


def setup_settings_and_reader(serial_setting: SerialSetting, meter_config: MeterConfig):
    settings = GXSettings()

    parity_map = {"None": "None", "Even": "Even", "Odd": "Odd", "Mark": "Mark", "Space": "Space"}
    parity_str = parity_map.get(serial_setting.parity, "None")

    port_str = f"{serial_setting.port}:{serial_setting.baud_rate}:{serial_setting.data_bits}{parity_str}{serial_setting.stop_bits}"
    print("Port string:", port_str, ", Meter:", meter_config.client_address, meter_config.meter_hdlc_id, meter_config.logical_server_address, meter_config.sn_referencing)

    args = [
        "", "-S", port_str,
        "-c", str(meter_config.client_address),
        "-s", str(meter_config.meter_hdlc_id),
        "-l", str(meter_config.logical_server_address),
        "-r", meter_config.sn_referencing,
        "-o", CACHE_FILE
    ]

    settings.getParameters(args)
    if os.path.exists(CACHE_FILE):
        settings.client.objects.extend(GXDLMSObjectCollection.load(CACHE_FILE))

    reader = GXDLMSReader(settings.client, settings.media, settings.trace, settings.invocationCounter)
    return settings, reader


def read_instantaneous_data(serial_setting: SerialSetting, meter_config: MeterConfig):
    settings, reader = setup_settings_and_reader(serial_setting, meter_config)
    results = []

    try:
        settings.media.open()
        reader.initializeConnection()

        reference_codes = [
            "0-0:42.0.0", "0-0:97.97.0", "0-0:1.0.0", "1-0:0.0.0",
            "1-0:0.0.1", "1-0:0.0.2", "1-0:0.0.3", "0-0:96.1.0",
            "0-0:96.1.1", "1-1:2.8.0", "1-1:3.8.0", "1-1:4.8.0",
            "1-1:1.8.0", "1-1:9.8.0", "1-1:1.8.1", "1-1:1.8.2",
            "1-1:1.8.3", "1-1:2.8.1", "1-1:2.8.2", "1-1:2.8.3",
            "1-1:1.9.0", "1-1:9.9.0", "1-1:2.5.0", "1-1:3.5.0",
            "1-1:4.5.0", "1-1:1.5.0", "1-1:9.5.0", "1-1:1.6.0",
            "1-1:2.6.0", "1-1:1.6.1", "1-1:2.6.1", "1-1:1.6.2",
            "1-1:2.6.2", "1-1:1.6.3", "1-1:2.6.3", "1-1:1.6.4",
            "1-1:2.6.4", "1-1:1.2.0", "1-1:2.2.0", "1-1:1.2.1",
            "1-1:2.2.1", "1-1:1.2.2", "1-1:2.2.2", "1-1:1.2.3",
            "1-1:2.2.3", "1-1:1.2.4", "1-1:2.2.4", "1-1:32.7.0",
            "1-1:52.7.0", "1-1:72.7.0", "1-4:32.7.0", "1-4:52.7.0",
            "1-4:72.7.0", "1-1:31.7.0", "1-1:51.7.0", "1-1:71.7.0",
            "1-4:31.7.0", "1-4:51.7.0", "1-4:71.7.0", "1-1:91.7.0",
            "1-1:14.7.0", "1-4:16.7.0", "1-4:36.7.0", "1-4:56.7.0",
            "1-4:76.7.0", "1-4:131.7.0", "1-4:151.7.0", "1-4:171.7.0",
            "1-4:191.7.0", "1-1:13.7.0", "1-1:33.7.0", "1-1:53.7.0",
            "1-1:73.7.0", "1-1:81.7.0", "1-1:81.7.1", "1-1:81.7.2",
            "1-1:81.7.4", "1-1:81.7.5", "1-1:81.7.6", "0-0:96.7.1",
            "0-0:96.7.2", "0-0:96.7.3", "1-0:0.1.0", "1-0:0.1.2",
            "0-0:96.8.0", "0-0:96.2.0", "0-0:96.2.1", "0-1:96.2.5",
            "0-0:96.2.2", "0-0:96.2.7", "0-0:96.3.1", "0-0:96.3.2",
            "0-0:96.4.0", "0-0:96.5.0", "0-0:96.6.0", "0-0:96.6.3",
            "1-0:0.2.0", "1-0:0.2.1", "1-0:0.2.2", "1-0:0.2.7",
            "0-0:96.90", "1-0:0.2.4", "0-0:96.99.8", "0-0:96.90.2",
            "0-0:96.90.1", "1-1:0.3.0", "1-1:0.3.1", "1-1:0.4.0",
            "1-1:0.4.1", "1-1:0.4.2", "1-1:0.4.3"
        ]

        for obis in reference_codes:
            standard_obis = obis.replace('-', '.').replace(':', '.')
            if standard_obis.count('.') == 4:
                standard_obis += '.255'

            obj = settings.client.objects.findByLN(ObjectType.NONE, standard_obis)
            if obj is None:
                continue

            is_register = isinstance(obj, (GXDLMSRegister, GXDLMSExtendedRegister, GXDLMSDemandRegister))

            # For registers, read attr 3 (scaler+unit) first to populate obj.unit
            if is_register:
                try:
                    reader.read(obj, 3)
                except Exception:
                    pass

            # Choose value attribute index
            attr_index = (3 if isinstance(obj, GXDLMSDemandRegister)
                          and "last average" in (obj.description or "").lower()
                          else 2)

            try:
                # gurux reader.read() returns the ALREADY-SCALED value for registers.
                # Do NOT multiply by obj.scaler again — that would double-scale.
                raw_val = reader.read(obj, attr_index)

                # Get display unit string
                unit_str = ""
                if is_register and hasattr(obj, 'unit') and obj.unit and obj.unit.value != 0:
                    unit_str = get_unit_display(obj.unit.name, standard_obis)

                # Format the value (decode bytes/hex → ASCII or DLMS datetime where appropriate)
                display_val = format_register_value(raw_val)

                results.append({
                    "obis": standard_obis,
                    "description": obj.description if obj.description else "Unknown",
                    "value": display_val,
                    "unit": unit_str
                })

            except Exception as e:
                results.append({"obis": standard_obis, "error": str(e)})

    except Exception as e:
        raise Exception(f"Communication error: {e}")
    finally:
        try:
            reader.close()
        except Exception:
            pass

    return results


def read_profile_data(serial_setting: SerialSetting, meter_config: MeterConfig, target_date: datetime.date):
    settings, reader = setup_settings_and_reader(serial_setting, meter_config)
    results = {"headers": [], "data": []}

    try:
        settings.media.open()
        reader.initializeConnection()

        obis_code = "1.0.99.1.0.255"
        profile = settings.client.objects.findByLN(ObjectType.PROFILE_GENERIC, obis_code)

        if profile is None:
            raise Exception("Could not find Profile Generic in cache!")

        start_time = datetime.datetime.combine(target_date, datetime.time(0, 0, 0))
        end_time   = datetime.datetime.combine(target_date, datetime.time(23, 59, 59))

        print(f"Reading {profile.name} from {start_time} to {end_time}...")
        reader.read(profile, 3)

        col_units = []
        for i, capture_object in enumerate(profile.captureObjects):
            dlms_obj = capture_object[0]
            is_register = isinstance(dlms_obj, (GXDLMSRegister, GXDLMSExtendedRegister, GXDLMSDemandRegister))
            if is_register:
                try:
                    reader.read(dlms_obj, 3)
                except Exception:
                    pass

            unit_str = ""
            if is_register and hasattr(dlms_obj, 'unit') and dlms_obj.unit and dlms_obj.unit.value != 0:
                unit_str = get_unit_display(dlms_obj.unit.name, dlms_obj.logicalName)

            col_units.append(unit_str)

            results["headers"].append({
                "index": i,
                "logical_name": dlms_obj.logicalName,
                "unit": unit_str,
                "description": dlms_obj.description if dlms_obj.description else "Unknown object"
            })

        rows = reader.readRowsByRange(profile, start_time, end_time)
        print(f"Received {len(rows)} rows.")

        for row in rows:
            formatted_row = []
            for col_idx, cell in enumerate(row):
                if col_idx == 0:
                    # Timestamp column — format_register_value handles datetime objects
                    formatted_row.append(format_register_value(cell))
                else:
                    # Data columns — gurux returns already-scaled values; just format them
                    fv = format_register_value(cell)
                    try:
                        num = float(fv)
                        formatted_row.append(int(num) if num == int(num) else num)
                    except (ValueError, TypeError):
                        formatted_row.append(fv)
            results["data"].append(formatted_row)

    except Exception as e:
        raise Exception(f"Profile error: {e}")
    finally:
        try:
            reader.close()
        except Exception:
            pass

    return results

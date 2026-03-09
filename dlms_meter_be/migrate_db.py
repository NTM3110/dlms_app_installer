import sqlite3
import os

DB_FILE = "meter_db.db"

def migrate():
    if not os.path.exists(DB_FILE):
        print(f"Database {DB_FILE} does not exist. No migration needed.")
        return

    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # 1. Back up existing data
    cursor.execute("SELECT * FROM serial_setting")
    old_serial = cursor.fetchone()
    
    cursor.execute("SELECT measurement_point, client_address, server_address, logical_server_address, sn_referencing, hdlc_frame_size FROM meter_config")
    old_meters = cursor.fetchall()
    
    # Drop and recreate schema
    cursor.execute("DROP TABLE IF EXISTS meter_config")
    cursor.execute("DROP TABLE IF EXISTS serial_setting")
    
    cursor.execute("""
    CREATE TABLE serial_setting (
        id INTEGER NOT NULL, 
        name VARCHAR, 
        port VARCHAR, 
        baud_rate INTEGER, 
        data_bits INTEGER, 
        stop_bits INTEGER, 
        parity VARCHAR, 
        PRIMARY KEY (id)
    )
    """)
    cursor.execute("CREATE UNIQUE INDEX ix_serial_setting_name ON serial_setting (name)")
    cursor.execute("CREATE INDEX ix_serial_setting_id ON serial_setting (id)")

    cursor.execute("""
    CREATE TABLE meter_config (
        id INTEGER NOT NULL, 
        measurement_point VARCHAR, 
        serial_id INTEGER, 
        client_address INTEGER, 
        server_address INTEGER, 
        logical_server_address INTEGER, 
        sn_referencing VARCHAR, 
        hdlc_frame_size INTEGER, 
        PRIMARY KEY (id), 
        FOREIGN KEY(serial_id) REFERENCES serial_setting (id)
    )
    """)
    cursor.execute("CREATE UNIQUE INDEX ix_meter_config_measurement_point ON meter_config (measurement_point)")
    cursor.execute("CREATE INDEX ix_meter_config_id ON meter_config (id)")

    # Restore data
    serial_id_map = 1
    if old_serial:
        # Construct setting
        # Before id=1, port=old[1], baud=old[2]... Wait, the structure was:
        # id(0), port(1), baud_rate(2), data_bits(3), stop_bits(4), parity(5)
        # We need name now. We'll set name=old[1] (the port) or "Default".
        cursor.execute("INSERT INTO serial_setting (id, name, port, baud_rate, data_bits, stop_bits, parity) VALUES (?, ?, ?, ?, ?, ?, ?)", 
                       (1, "Main Port", old_serial[1], old_serial[2], old_serial[3], old_serial[4], old_serial[5]))
        serial_id_map = 1
    else:
        cursor.execute("INSERT INTO serial_setting (id, name, port, baud_rate, data_bits, stop_bits, parity) VALUES (1, 'Main Port', 'COM1', 9600, 8, 1, 'None')")
        serial_id_map = 1
        
    if old_meters:
        for m in old_meters:
            cursor.execute("INSERT INTO meter_config (measurement_point, serial_id, client_address, server_address, logical_server_address, sn_referencing, hdlc_frame_size) VALUES (?, ?, ?, ?, ?, ?, ?)",
                           (m[0], serial_id_map, m[1], m[2], m[3], m[4], m[5]))

    conn.commit()
    conn.close()
    print("Database migrated successfully. Old settings were moved to the new multiple serials schema.")

if __name__ == "__main__":
    migrate()

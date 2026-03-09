# Recompile DLMS Meter App Executable

This plan outlines the steps to rebuild the application, incorporating recent changes to the UI and data directory logic.

## Proposed Changes

### 1. Fix PowerShell Execution Policy
If you get a security error when running `npm`, run this command in your terminal (PowerShell) as Administrator:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```
**Alternatively**, use `npm.cmd` instead of `npm`.

### 2. Frontend (Angular)
The frontend needs to be rebuilt to include the updated "Meter ID" label.
1. Clean the backend's static directory (from the project root):
   ```powershell
   Remove-Item -Recurse -Force "dlms_meter_be\static\*"
   ```
2. Build the frontend:
   ```powershell
   cd dlms_meter_fe
   npm run build  # or npm.cmd run build
   ```
3. Copy the files to the backend directory:
   ```powershell
   Xcopy /E /I /Y "dist\dlms-meter-fe\browser\*" "..\dlms_meter_be\static\"
   ```

### 3. Backend (Python/PyInstaller)
The backend executable needs to be recompiled using the existing [build.spec](file:///c:/Users/mdmt3/Documents/ATEnergy/MaxiMeter/dlms_installer/dlms_meter_be/build.spec) file.
1. Navigate to the backend directory:
   ```powershell
   cd ..\dlms_meter_be
   ```
2. Activate the virtual environment (Important! This contains PyInstaller):
   ```powershell
   .\venv\Scripts\activate
   ```
3. Clean existing `build` and `dist` folders:
   ```powershell
   Remove-Item -Recurse -Force build, dist
   ```
4. Run PyInstaller:
   ```powershell
   pyinstaller build.spec
   ```
   *Note: If `pyinstaller` still isn't recognized after activating, try: `.\venv\Scripts\pyinstaller.exe build.spec`*

### 4. Build Windows Installer (Inno Setup)
Once the `run.exe` is successfully created in `dlms_meter_be\dist\run\`, you can build the final installer.

#### Option A: Command Line (Fastest)
Run this command from the project root:
```powershell
& "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" installer.iss
```
*Note: If your Inno Setup is installed in a different path, adjust the string accordingly.*

#### Option B: GUI
1. Open **Inno Setup Compiler**.
2. Open `installer.iss`.
3. Press `Ctrl + F9`.

The final installer `DLMS_Meter_Setup_v1.0.0.exe` will be generated in the root directory.

## Verification Plan

### Manual Verification
1. Run the newly generated `run.exe serve` from `dlms_meter_be/dist/run/`.
2. Open `http://localhost:8000` in a browser.
3. **Verify UI**: Check if the "Meter HDLC Address" column now says "Meter ID".
4. **Verify Data Path**: Check if `%LOCALAPPDATA%\DLMSMeterApp\data` is created and used for CSV storage.
5. **Setup Test**: Install the application using the new `DLMS_Meter_Setup_v1.0.0.exe` and ensure it runs correctly from the Start Menu.

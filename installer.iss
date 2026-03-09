[Setup]
AppName=DLMS Meter App
AppVersion=1.0.0
DefaultDirName={pf}\DLMS Meter App
DefaultGroupName=DLMS Meter App
UninstallDisplayIcon={app}\dlms_meter_be\dist\run\run.exe
Compression=lzma2
SolidCompression=yes
OutputDir=.
OutputBaseFilename=DLMS_Meter_Setup_v1.0.0
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
; This ensures a clean uninstall naming
UninstallFilesDir={app}\uninstall

[Files]
Source: "docker-compose.yml"; DestDir: "{app}"; Flags: ignoreversion
Source: "start_app.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "dlms_meter_be\dist\run\*"; DestDir: "{app}\dlms_meter_be\dist\run"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\Start DLMS Meter App"; Filename: "{app}\start_app.bat"; WorkingDir: "{app}"
Name: "{group}\Uninstall DLMS Meter App"; Filename: "{uninstallexe}"
Name: "{commondesktop}\Start DLMS Meter App"; Filename: "{app}\start_app.bat"; WorkingDir: "{app}"
Name: "{commonstartup}\Start DLMS Meter App"; Filename: "{app}\start_app.bat"; WorkingDir: "{app}"

[Run]
Filename: "{app}\start_app.bat"; Description: "Start DLMS Meter App Now"; Flags: postinstall shellexec runascurrentuser skipifsilent

[UninstallRun]
; Stop Docker services before uninstalling
Filename: "docker-compose"; Parameters: "down"; WorkingDir: "{app}"; Flags: runhidden
; Kill the backend process if it's still running
Filename: "taskkill"; Parameters: "/F /IM run.exe /T"; Flags: runhidden

[UninstallDelete]
; Clean up the installation directory
Type: filesandordirs; Name: "{app}"
; Clean up the AppData folder (where the CSVs were moved)
Type: filesandordirs; Name: "{localappdata}\DLMSMeterApp"

[Code]
function CheckDockerInstalled(): Boolean;
var
  ResultCode: Integer;
begin
  if Exec('cmd.exe', '/c docker --version', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    Result := (ResultCode = 0);
  end
  else
  begin
    Result := False;
  end;
end;

function InitializeSetup(): Boolean;
var
  ErrorCode: Integer;
begin
  Result := True;
  if not CheckDockerInstalled() then
  begin
    MsgBox('CRITICAL REQUIREMENT: Docker Desktop was not found on this system.' + #13#10 + #13#10 +
           'This application relies on Docker to run its database services.' + #13#10 + #13#10 +
           'Please install Docker Desktop from https://www.docker.com/products/docker-desktop/ ' +
           'and ensure it is running before attempting to install this app.', mbError, MB_OK);
    
    // Open the download page for the user
    ShellExec('open', 'https://www.docker.com/products/docker-desktop/', '', '', SW_SHOWNORMAL, ewNoWait, ErrorCode);
    
    // RETURN FALSE TO CANCEL INSTALLATION
    Result := False;
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usPostUninstall then
  begin
    if MsgBox('Do you want to delete all collected meter data and settings (CSV files)?', mbConfirmation, MB_YESNO) = IDYES then
    begin
      DelTree(ExpandConstant('{localappdata}\DLMSMeterApp'), True, True, True);
    end;
  end;
end;

#define AppName "LabPulse"
#define AppVersion "0.1.0"
#define SourceDir GetEnv("LABPULSE_INSTALLER_SOURCE")

[Setup]
AppId={{A6F3FDC9-0D83-4E7B-9E3E-1D5C0E78B1A1}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher=LabPulse
DefaultDirName={autopf}\LabPulse
DefaultGroupName=LabPulse
UninstallDisplayIcon={app}\runtime\node.exe
OutputDir=output
OutputBaseFilename=LabPulse-Setup
Compression=lzma2
SolidCompression=yes
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64compatible
DisableProgramGroupPage=yes
WizardStyle=modern

[Files]
Source: "{#SourceDir}\runtime\node.exe"; DestDir: "{app}\runtime"; Flags: ignoreversion
Source: "{#SourceDir}\postgresql\*"; DestDir: "{app}\postgresql"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#SourceDir}\server\*"; DestDir: "{app}\server"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#SourceDir}\web\*"; DestDir: "{app}\web"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#SourceDir}\installer\install.ps1"; DestDir: "{app}\installer"; Flags: ignoreversion
Source: "{#SourceDir}\installer\run-local-stack.ps1"; DestDir: "{app}\installer"; Flags: ignoreversion
Source: "{#SourceDir}\installer\backup-local.ps1"; DestDir: "{app}\installer"; Flags: ignoreversion
Source: "{#SourceDir}\installer\restore-local.ps1"; DestDir: "{app}\installer"; Flags: ignoreversion
Source: "{#SourceDir}\installer\backup.ps1"; DestDir: "{app}\installer"; Flags: ignoreversion
Source: "{#SourceDir}\installer\postgres-connection.ps1"; DestDir: "{app}\installer"; Flags: ignoreversion
Source: "{#SourceDir}\installer\restore.ps1"; DestDir: "{app}\installer"; Flags: ignoreversion
Source: "{#SourceDir}\installer\uninstall.ps1"; DestDir: "{app}\installer"; Flags: ignoreversion

[Dirs]
Name: "{commonappdata}\LabPulse\data"
Name: "{commonappdata}\LabPulse\config"
Name: "{commonappdata}\LabPulse\logs"
Name: "{commonappdata}\LabPulse\backups"

[Icons]
Name: "{autodesktop}\LabPulse"; Filename: "{sys}\cmd.exe"; Parameters: "/c start """" ""http://localhost:3710"""""; WorkingDir: "{app}"; Comment: "Open LabPulse"
Name: "{group}\LabPulse"; Filename: "{sys}\cmd.exe"; Parameters: "/c start """" ""http://localhost:3710"""""; WorkingDir: "{app}"; Comment: "Open LabPulse"
Name: "{group}\LabPulse - Backup now"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoLogo -NoProfile -STA -WindowStyle Hidden -ExecutionPolicy Bypass -File ""{app}\installer\backup-local.ps1"" -InstallDir ""{app}"" -DataDir ""{commonappdata}\LabPulse"" -Interactive"; WorkingDir: "{app}"; Comment: "Create a LabPulse backup now"
Name: "{group}\LabPulse - Restore backup"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoLogo -NoProfile -STA -WindowStyle Hidden -ExecutionPolicy Bypass -File ""{app}\installer\restore-local.ps1"" -InstallDir ""{app}"" -DataDir ""{commonappdata}\LabPulse"""; WorkingDir: "{app}"; Comment: "Restore a LabPulse backup"

[Run]
Filename: "powershell.exe"; Parameters: "-NoLogo -NoProfile -STA -WindowStyle Hidden -ExecutionPolicy Bypass -File ""{app}\installer\install.ps1"" -InstallDir ""{app}"" -DataDir ""{commonappdata}\LabPulse"""; Flags: waituntilterminated runascurrentuser runhidden

[UninstallRun]
Filename: "powershell.exe"; Parameters: "-NoLogo -NoProfile -ExecutionPolicy Bypass -File ""{app}\installer\uninstall.ps1"""; Flags: runhidden waituntilterminated; RunOnceId: "LabPulseUninstall"

[UninstallDelete]
Type: filesandordirs; Name: "{app}\installer"
Type: filesandordirs; Name: "{app}\server"
Type: filesandordirs; Name: "{app}\web"
Type: filesandordirs; Name: "{app}\runtime"
Type: filesandordirs; Name: "{app}\postgresql"

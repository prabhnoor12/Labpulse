$ErrorActionPreference = 'Stop'
$taskName = 'LabPulse Local Stack'
$backupTaskName = 'LabPulse Daily Backup'
try { Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue } catch { }
try { Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue } catch { }
try { Stop-ScheduledTask -TaskName $backupTaskName -ErrorAction SilentlyContinue } catch { }
try { Unregister-ScheduledTask -TaskName $backupTaskName -Confirm:$false -ErrorAction SilentlyContinue } catch { }
Write-Host 'LabPulse services stopped. The database and backups remain in C:\ProgramData\LabPulse for recovery.'

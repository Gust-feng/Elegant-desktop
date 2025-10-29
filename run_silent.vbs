Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "auto_update_schedule.bat", 0, True
Set WshShell = Nothing

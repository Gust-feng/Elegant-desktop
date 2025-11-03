Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' 获取VBS脚本所在目录
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
batPath = scriptDir & "\auto_update_schedule.bat"

' 静默运行BAT脚本
WshShell.Run """" & batPath & """", 0, True

Set fso = Nothing
Set WshShell = Nothing

@echo off
chcp 65001 >nul
echo ====================================
echo Windows 任务计划程序设置脚本
echo ====================================
echo.
echo 此脚本将创建3个定时任务:
echo 1. 课表更新-工作日中午 (周一至周五 11:50)
echo 2. 课表更新-工作日晚上 (周一至周五 19:50)
echo 3. 课表更新-周末晚上 (周六、周日 19:50)
echo.
echo ⚠️ 请确保以管理员身份运行此脚本！
echo.
pause

:: 设置路径
set "work_dir=%~dp0"
set "work_dir=%work_dir:~0,-1%"

echo.
echo 工作目录: %work_dir%
echo.
echo 检查 XML 配置文件是否存在...
if not exist "%work_dir%\task_weekday_noon.xml" (
    echo ❌ 错误: 找不到 task_weekday_noon.xml
    pause
    exit /b 1
)
if not exist "%work_dir%\task_weekday_evening.xml" (
    echo ❌ 错误: 找不到 task_weekday_evening.xml
    pause
    exit /b 1
)
if not exist "%work_dir%\task_weekend_evening.xml" (
    echo ❌ 错误: 找不到 task_weekend_evening.xml
    pause
    exit /b 1
)
echo ✅ 所有配置文件存在
echo.

echo.
echo [1/3] 创建任务: 课表更新-工作日中午...
schtasks /create /tn "课表更新-工作日中午" /xml "%work_dir%\task_weekday_noon.xml" /f
if %errorlevel% equ 0 (
    echo ✅ 任务创建成功
) else (
    echo ❌ 任务创建失败 (错误码: %errorlevel%)
)

echo.
echo [2/3] 创建任务: 课表更新-工作日晚上...
schtasks /create /tn "课表更新-工作日晚上" /xml "%work_dir%\task_weekday_evening.xml" /f
if %errorlevel% equ 0 (
    echo ✅ 任务创建成功
) else (
    echo ❌ 任务创建失败 (错误码: %errorlevel%)
)

echo.
echo [3/3] 创建任务: 课表更新-周末晚上...
schtasks /create /tn "课表更新-周末晚上" /xml "%work_dir%\task_weekend_evening.xml" /f
if %errorlevel% equ 0 (
    echo ✅ 任务创建成功
) else (
    echo ❌ 任务创建失败 (错误码: %errorlevel%)
)

echo.
echo ====================================
echo 任务创建完成！
echo ====================================
echo.
echo 查看已创建的任务:
schtasks /query /tn "课表更新-工作日中午" /fo list
echo.
schtasks /query /tn "课表更新-工作日晚上" /fo list
echo.
schtasks /query /tn "课表更新-周末晚上" /fo list
echo.
pause

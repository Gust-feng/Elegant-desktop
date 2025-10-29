@echo off
chcp 65001 >nul
echo ====================================
echo Windows 任务计划程序删除脚本
echo ====================================
echo.
echo 此脚本将删除3个定时任务:
echo 1. 课表更新-工作日中午
echo 2. 课表更新-工作日晚上
echo 3. 课表更新-周末晚上
echo.
pause

echo.
echo [1/3] 删除任务: 课表更新-工作日中午...
schtasks /delete /tn "课表更新-工作日中午" /f
if %errorlevel% equ 0 (
    echo ✅ 任务删除成功
) else (
    echo ⚠️ 任务不存在或删除失败
)

echo.
echo [2/3] 删除任务: 课表更新-工作日晚上...
schtasks /delete /tn "课表更新-工作日晚上" /f
if %errorlevel% equ 0 (
    echo ✅ 任务删除成功
) else (
    echo ⚠️ 任务不存在或删除失败
)

echo.
echo [3/3] 删除任务: 课表更新-周末晚上...
schtasks /delete /tn "课表更新-周末晚上" /f
if %errorlevel% equ 0 (
    echo ✅ 任务删除成功
) else (
    echo ⚠️ 任务不存在或删除失败
)

echo.
echo ====================================
echo 任务删除完成！
echo ====================================
echo.
pause

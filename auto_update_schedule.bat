@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

REM ==================== 自动更新课表脚本 ====================
REM 用途: 自动执行课表爬虫，获取最新课表数据
REM 作者: AI Assistant
REM 日期: 2025-10-29
REM ========================================================

REM 设置工作目录为脚本所在目录
cd /d "%~dp0"

REM 创建日志目录
if not exist "logs" mkdir logs

REM 设置日志文件（按年月命名，避免日期格式问题）
for /f "tokens=1-3 delims=/ " %%a in ("%date%") do (
    set log_date=%%a-%%b
)
set "log_file=logs\schedule_update_%log_date%.log"

REM 记录开始时间
echo ================================================== >> "%log_file%"
echo [%date% %time%] 🚀 开始自动更新课表 >> "%log_file%"
echo ================================================== >> "%log_file%"
echo 运行用户: %USERNAME% >> "%log_file%"
whoami >> "%log_file%" 2>&1
echo 当前目录: %CD% >> "%log_file%"

REM 激活虚拟环境并执行Python脚本
echo [%date% %time%] 激活虚拟环境... >> "%log_file%"
if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
    echo [%date% %time%] ✅ 虚拟环境已激活 >> "%log_file%"
) else (
    echo [%date% %time%] ⚠️ 虚拟环境不存在，使用系统Python >> "%log_file%"
)

echo [%date% %time%] 执行课表爬虫... >> "%log_file%"
python run_crawler.py >> "%log_file%" 2>&1

REM 检查执行结果
if %errorlevel% equ 0 (
    echo [%date% %time%] ✅ 课表更新成功 >> "%log_file%"
) else (
    echo [%date% %time%] ❌ 课表更新失败，错误码: %errorlevel% >> "%log_file%"
)

REM 停用虚拟环境
if exist "venv\Scripts\deactivate.bat" (
    call venv\Scripts\deactivate.bat
    echo [%date% %time%] 虚拟环境已停用 >> "%log_file%"
)

echo ================================================== >> "%log_file%"
echo. >> "%log_file%"

REM 清理旧日志（保留最近30天）
forfiles /p "logs" /m *.log /d -30 /c "cmd /c del @path" 2>nul

endlocal
exit /b 0

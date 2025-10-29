@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

REM ==================== 自动更新课表脚本 ====================
REM 用途: 自动执行课表爬虫，获取最新课表数据
REM 作者: AI Assistant
REM 日期: 2025-10-29
REM ========================================================

REM 设置工作目录为脚本所在目录
set "work_dir=%~dp0"
cd /d "%work_dir%"

REM 创建日志目录（相对当前目录）
if not exist "logs" mkdir logs

REM 设置日志文件（按月份）
set "log_file=logs\schedule_update_%date:~0,7%.log"

REM 记录开始时间
echo ================================================== >> "%log_file%"
echo [%date% %time%] 🚀 开始自动更新课表 >> "%log_file%"
echo ================================================== >> "%log_file%"

REM 选择可用的 Python 启动器（优先虚拟环境，其次 python，再次 py）
set "PY_CMD="
if exist "venv\Scripts\python.exe" set "PY_CMD=venv\Scripts\python.exe"
if not defined PY_CMD (
    where python >nul 2>&1 && set "PY_CMD=python"
)
if not defined PY_CMD (
    where py >nul 2>&1 && set "PY_CMD=py -3"
)
if not defined PY_CMD (
    echo [%date% %time%] ❌ 未找到 Python，请安装或配置 PATH >> "%log_file%"
    goto :END
)

REM 如存在虚拟环境，尝试激活（可选）
if exist "venv\Scripts\activate.bat" (
    echo [%date% %time%] 激活虚拟环境... >> "%log_file%"
    call venv\Scripts\activate.bat >> "%log_file%" 2>&1
    echo [%date% %time%] ✅ 虚拟环境已激活 >> "%log_file%"
) else (
    echo [%date% %time%] ⚠️ 未检测到 venv，将使用 %PY_CMD% >> "%log_file%"
)

echo [%date% %time%] 执行课表爬虫... >> "%log_file%"
%PY_CMD% 课表爬虫.py >> "%log_file%" 2>&1

REM 检查执行结果
if %errorlevel% equ 0 (
    echo [%date% %time%] ✅ 课表更新成功 >> "%log_file%"
) else (
    echo [%date% %time%] ❌ 课表更新失败，错误码: %errorlevel% >> "%log_file%"
)

REM 停用虚拟环境（如果有）
if exist "venv\Scripts\deactivate.bat" (
    call venv\Scripts\deactivate.bat >> "%log_file%" 2>&1
    echo [%date% %time%] 虚拟环境已停用 >> "%log_file%"
)

echo ================================================== >> "%log_file%"
echo. >> "%log_file%"

REM 清理旧日志（保留最近30天）
forfiles /p "logs" /m *.log /d -30 /c "cmd /c del @path" 2>nul

:END
endlocal
exit /b 0

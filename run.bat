@echo off
cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo.
  echo =============================================
  echo  ❌ 未检测到 Node.js
  echo.
  echo  请先安装 Node.js（包含 npm）：
  echo    https://nodejs.org （下载 LTS 版本）
  echo.
  echo  安装后重新双击本文件即可。
  echo =============================================
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo 📦 正在安装依赖（仅首次需要）...
  call npm install
  if %errorlevel% neq 0 (
    echo.
    echo ⚠️  npm install 失败。可能是网络问题。
    echo    建议尝试镜像源：
    echo      npm install --registry=https://registry.npmmirror.com
    echo.
    pause
    exit /b 1
  )
)

echo 🚀 启动 Everything Flow...
npx vite --open
pause

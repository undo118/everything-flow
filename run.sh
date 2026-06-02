#!/usr/bin/env bash
set -o pipefail
cd "$(dirname "$0")"

# ---- Self-check: Node.js ----
if ! command -v node &>/dev/null; then
  echo ""
  echo "============================================="
  echo " ❌ 未检测到 Node.js"
  echo ""
  echo " 请先安装 Node.js（包含 npm）："
  echo "   https://nodejs.org （下载 LTS 版本）"
  echo ""
  echo " 安装后重新双击本文件即可。"
  echo "============================================="
  echo ""
  read -rp "按回车退出..."
  exit 1
fi

# ---- Self-check: npm install ----
if [ ! -d "node_modules" ]; then
  echo "📦 正在安装依赖（仅首次需要）..."
  if ! npm install; then
    echo ""
    echo "⚠️  npm install 失败。可能是网络问题。"
    echo "   建议尝试镜像源："
    echo "     npm install --registry=https://registry.npmmirror.com"
    echo ""
    read -rp "按回车退出..."
    exit 1
  fi
fi

# ---- Start dev server with port retry ----
PORT=3000
MAX_RETRIES=3
for ((i=1; i<=MAX_RETRIES; i++)); do
  echo "🚀 启动 Everything Flow (端口 $PORT)..."

  # Run vite in background so we can timeout-check
  npx vite --port "$PORT" --open &
  VITE_PID=$!

  # Wait up to 30s for the server to be ready
  for ((j=0; j<30; j++)); do
    sleep 1
    if ! kill -0 "$VITE_PID" 2>/dev/null; then
      # Process exited
      break
    fi
    if curl -s "http://localhost:$PORT" >/dev/null 2>&1; then
      # Server is up
      wait "$VITE_PID"
      exit 0
    fi
  done

  # If we get here, either process died or timed out
  kill "$VITE_PID" 2>/dev/null || true
  wait "$VITE_PID" 2>/dev/null || true

  if [ "$i" -lt "$MAX_RETRIES" ]; then
    echo "⚠️  端口 $PORT 启动失败，尝试端口 $((PORT+1))..."
    PORT=$((PORT+1))
  else
    echo "❌ 启动失败，已重试 $MAX_RETRIES 次。"
    echo "   请检查是否有其他进程占用端口。"
    read -rp "按回车退出..."
    exit 1
  fi
done

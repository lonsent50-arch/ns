#!/bin/bash
cd "$(dirname "$0")"

echo "=============================================="
echo "  Novel Studio Desktop"
echo "=============================================="
echo ""

echo "[1/3] 检查依赖..."
pip3 install -r requirements.txt 2>/dev/null

echo ""
echo "[2/3] 清理旧进程..."
lsof -ti:5050 | xargs kill -9 2>/dev/null && echo "  已清理旧进程" || echo "  端口未被占用"

echo ""
echo "[3/3] 启动桌面应用..."
python3 main.py

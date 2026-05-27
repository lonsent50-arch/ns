#!/bin/bash
# Novel Studio 启动脚本

echo "=============================================="
echo "  Novel Studio - 专业小说写作工具"
echo "=============================================="
echo ""

cd "$(dirname "$0")"

# 检查依赖
echo "[1/3] 检查 Python 依赖..."
pip3 install flask flask-cors python-docx reportlab markdown 2>/dev/null || \
  python3 -m pip install flask flask-cors python-docx reportlab markdown 2>/dev/null

echo ""
echo "[2/3] 清理旧进程..."
# 杀掉占用5050端口的旧进程
lsof -ti:5050 | xargs kill -9 2>/dev/null && echo "  已清理旧进程" || echo "  端口未被占用"

echo ""
echo "[3/3] 启动服务器..."
echo "  浏览器将自动打开 http://127.0.0.1:5050"
echo "  按 Ctrl+C 停止服务器"
echo ""

# 启动 Flask
python3 app.py &

# 等待服务器启动
sleep 2

# 打开浏览器
open http://127.0.0.1:5050/ 2>/dev/null || \
  xdg-open http://127.0.0.1:5050/ 2>/dev/null || \
  echo "请手动打开浏览器访问: http://127.0.0.1:5050"

# 等待（前台运行以便 Ctrl+C 停止）
wait

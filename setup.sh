#!/bin/bash
# Novel Studio - 一键部署脚本
# 使用：bash setup.sh
set -e

echo "====================================="
echo "  Novel Studio - 产品部署脚本"
echo "====================================="
echo ""

NOVEL_ROOT="$(cd "$(dirname "$0")" && pwd)"

# ---- 1. 检查 Python ----
echo "[1/3] 检查 Python 环境..."
if ! command -v python3 &> /dev/null; then
    echo "❌ 未找到 python3，请先安装 Python 3.9+"
    exit 1
fi
echo "  ✓ Python: $(python3 --version)"

# ---- 2. 安装 Python 依赖 ----
echo "[2/3] 安装 Python 依赖..."
pip3 install flask flask-cors markdown python-docx reportlab waitress 2>&1 | tail -1
echo "  ✓ 依赖安装完成"

# ---- 3. 初始化数据库并启动 ----
echo "[3/3] 初始化数据库..."
cd "$NOVEL_ROOT"
python3 -c "
from app import init_license_db
init_license_db()
print('  ✓ 数据库初始化完成')
"

echo ""
echo "====================================="
echo "  启动 Novel Studio 服务（端口 80）..."
echo "====================================="

# 停止旧进程
pkill -f server.py 2>/dev/null || true
sleep 1

nohup python3 server.py > /tmp/novel-studio.log 2>&1 &
sleep 2
echo "  ✓ 服务已启动 (PID: $!)"
echo "  🌐 访问地址: http://localhost"
echo "  📋 日志: /tmp/novel-studio.log"
echo ""
echo "  停止服务: pkill -f server.py"
echo "====================================="

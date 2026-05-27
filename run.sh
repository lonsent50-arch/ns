#!/bin/bash
# Novel Studio 全自主运营脚本
# 功能：端口清理 → 启动服务 → 公网隧道 → 健康监控 → 崩溃自愈

set -e
cd "$(dirname "$0")"
PORT=${PORT:-5050}
HOST=${HOST:-0.0.0.0}
LOG_DIR="./logs"
mkdir -p "$LOG_DIR"

# 颜色输出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "$(date '+%H:%M:%S') ${BLUE}[NS]${NC} $1"; }
ok()  { echo -e "$(date '+%H:%M:%S') ${GREEN}[NS]${NC} $1"; }
err() { echo -e "$(date '+%H:%M:%S') ${RED}[NS]${NC} $1"; }

# ── 清理旧进程 ──
cleanup() {
    log "清理 $PORT 端口旧进程..."
    lsof -ti:$PORT 2>/dev/null | xargs kill -9 2>/dev/null || true
    sleep 1
}

# ── 健康检查 ──
health_check() {
    curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/" 2>/dev/null | grep -q 200
}

# ── 启动 Flask 服务 ──
start_server() {
    log "启动 Novel Studio 服务 (端口 $PORT)..."
    python3 server.py >> "$LOG_DIR/server.log" 2>&1 &
    SERVER_PID=$!
    echo $SERVER_PID > "$LOG_DIR/server.pid"

    # 等待服务就绪
    for i in $(seq 1 30); do
        if health_check; then
            ok "服务已就绪 (PID: $SERVER_PID)"
            return 0
        fi
        sleep 0.5
    done
    err "服务启动超时！"
    return 1
}

# ── 启动公网隧道 ──
TUNNEL_PID=""
start_tunnel() {
    log "创建公网隧道..."
    # 优先使用 cloudflared（标准HTTPS 443端口，无安全警告）
    if command -v cloudflared &>/dev/null; then
        cloudflared tunnel --url http://127.0.0.1:$PORT > "$LOG_DIR/tunnel.log" 2>&1 &
        TUNNEL_PID=$!
        echo $TUNNEL_PID > "$LOG_DIR/tunnel.pid"
        sleep 6
        TUNNEL_URL=$(grep -o 'https://[^ ]*\.trycloudflare\.com' "$LOG_DIR/tunnel.log" | tail -1 || echo "")
        if [ -n "$TUNNEL_URL" ]; then
            ok "公网地址: $TUNNEL_URL"
            echo "$TUNNEL_URL" > "$LOG_DIR/public-url.txt"
        fi
    # 降级到 bore
    elif command -v bore &>/dev/null; then
        bore local $PORT --to bore.pub > "$LOG_DIR/tunnel.log" 2>&1 &
        TUNNEL_PID=$!
        echo $TUNNEL_PID > "$LOG_DIR/tunnel.pid"
        sleep 3
        TUNNEL_URL=$(grep -o 'bore.pub:[0-9]*' "$LOG_DIR/tunnel.log" | tail -1 || echo "")
        if [ -n "$TUNNEL_URL" ]; then
            ok "公网地址: $TUNNEL_URL"
            echo "$TUNNEL_URL" > "$LOG_DIR/public-url.txt"
        fi
    # 降级到 localtunnel
    elif command -v npx &>/dev/null; then
        npx --yes localtunnel --port $PORT >> "$LOG_DIR/tunnel.log" 2>&1 &
        TUNNEL_PID=$!
        echo $TUNNEL_PID > "$LOG_DIR/tunnel.pid"
        sleep 6
        TUNNEL_URL=$(grep -o 'https://[^ ]*\.loca\.lt' "$LOG_DIR/tunnel.log" | tail -1 || echo "")
        if [ -n "$TUNNEL_URL" ]; then
            ok "公网地址: $TUNNEL_URL"
            echo "$TUNNEL_URL" > "$LOG_DIR/public-url.txt"
        fi
    else
        log "未找到隧道工具，仅本地运行"
    fi
}

# ── 监控循环 ──
monitor_loop() {
    log "进入监控模式 (每 30 秒检查一次)..."
    local failures=0

    while true; do
        sleep 30

        # 检查 Flask 服务
        if ! health_check; then
            failures=$((failures + 1))
            err "健康检查失败 ($failures/3)"

            if [ $failures -ge 3 ]; then
                err "连续 3 次失败，重启服务..."

                # 杀掉旧进程
                kill $SERVER_PID 2>/dev/null || true
                cleanup

                # 重启
                if start_server; then
                    failures=0
                    ok "服务已恢复"
                    # 记录恢复时间
                    echo "$(date -Iseconds) recovered after crash" >> "$LOG_DIR/incidents.log"
                else
                    err "服务重启失败！"
                    echo "$(date -Iseconds) restart failed" >> "$LOG_DIR/incidents.log"
                fi
            fi
        else
            [ $failures -gt 0 ] && ok "健康检查恢复"
            failures=0
        fi

        # 检查隧道
        if [ -n "$TUNNEL_PID" ] && ! kill -0 $TUNNEL_PID 2>/dev/null; then
            err "隧道已断开，重新创建..."
            start_tunnel
        fi

        # 每小时记录一次统计 + 日志轮转
        if [ $(( $(date +%s) % 3600 )) -lt 30 ]; then
            STATS=$(curl -s "http://127.0.0.1:$PORT/api/site/stats" 2>/dev/null || echo '{}')
            echo "$(date -Iseconds) $STATS" >> "$LOG_DIR/stats-history.log"

            # 日志轮转：超过 1MB 就压缩归档
            for f in server.log tunnel.log; do
                if [ -f "$LOG_DIR/$f" ] && [ $(stat -f%z "$LOG_DIR/$f" 2>/dev/null || echo 0) -gt 1048576 ]; then
                    mv "$LOG_DIR/$f" "$LOG_DIR/${f}.$(date +%Y%m%d).old"
                    gzip -f "$LOG_DIR/${f}.$(date +%Y%m%d).old" 2>/dev/null || true
                fi
            done
        fi
    done
}

# ── 主流程 ──
main() {
    echo ""
    echo -e "${BLUE}╔══════════════════════════════════╗${NC}"
    echo -e "${BLUE}║   Novel Studio 全自主运营       ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════╝${NC}"
    echo ""

    cleanup
    start_server || exit 1
    start_tunnel

    # 显示访问信息
    echo ""
    ok "══ 运行中 ══"
    ok "本地:    http://127.0.0.1:$PORT"
    ok "落地页:  http://127.0.0.1:$PORT/landing"
    ok "SEO:     http://127.0.0.1:$PORT/ai-novel-writing"
    ok "管理后台: http://127.0.0.1:$PORT/admin"
    ok "客服:    右下角 💬"
    ok "按 Ctrl+C 停止"
    echo ""

    # 捕获退出信号
    trap 'log "正在停止..."; kill $SERVER_PID $TUNNEL_PID 2>/dev/null; ok "已停止"; exit 0' INT TERM

    monitor_loop
}

main

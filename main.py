#!/usr/bin/env python3
"""Novel Studio Desktop — 菜单栏常驻桌面应用"""

import os
import sys
import socket
import threading
import subprocess
import time
import atexit
import signal

os.chdir(os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

try:
    import rumps
except ImportError:
    print("错误: 请先安装 rumps")
    print("  pip3 install --break-system-packages rumps")
    sys.exit(1)

from werkzeug.serving import make_server
from app import app


def find_available_port(start=5050, max_attempts=10):
    for port in range(start, start + max_attempts):
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        result = sock.connect_ex(('127.0.0.1', port))
        sock.close()
        if result != 0:
            return port
    raise RuntimeError(f"端口 {start}-{start+max_attempts-1} 全部被占用")


def start_flask_server(host='127.0.0.1', port=5050):
    server = make_server(host, port, app, threaded=True)
    server.timeout = 0.5
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server


def wait_for_server(port, timeout=3):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.connect(('127.0.0.1', port))
            s.close()
            return True
        except ConnectionRefusedError:
            time.sleep(0.05)
    return False


WEBVIEW_SCRIPT_TEMPLATE = '''
import webview
import sys

url = "http://127.0.0.1:{port}"
w = webview.create_window(
    title="Novel Studio",
    url=url,
    width=1280,
    height=820,
    min_size=(900, 600),
    resizable=True,
)
webview.start(debug=False)
'''


class NovelStudioApp(rumps.App):

    def __init__(self, port, server):
        super().__init__("NS", title="Novel Studio")
        self.port = port
        self.server = server
        self.webview_proc = None

    @rumps.clicked("打开 Novel Studio")
    def show_window(self, _):
        if self.webview_proc is not None and self.webview_proc.poll() is None:
            return

        script = WEBVIEW_SCRIPT_TEMPLATE.format(port=self.port)
        self.webview_proc = subprocess.Popen(
            [sys.executable, '-c', script],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

    @rumps.clicked("退出 Novel Studio")
    def quit_app(self, _):
        if self.webview_proc and self.webview_proc.poll() is None:
            self.webview_proc.terminate()
        self.server.shutdown()
        rumps.quit_application()


def cleanup(server, webview_proc):
    """确保退出时释放端口"""
    if webview_proc and webview_proc.poll() is None:
        webview_proc.terminate()
    try:
        server.shutdown()
    except Exception:
        pass


def main():
    port = find_available_port()

    print(f'[Novel Studio] 后台服务: http://127.0.0.1:{port}')
    server = start_flask_server(port=port)

    if not wait_for_server(port):
        print("[Novel Studio] 错误: 服务启动失败")
        sys.exit(1)

    app_wrapper = NovelStudioApp(port=port, server=server)

    # 注册退出清理
    atexit.register(cleanup, server, app_wrapper.webview_proc)
    signal.signal(signal.SIGTERM, lambda *a: sys.exit(0))
    signal.signal(signal.SIGINT, lambda *a: sys.exit(0))

    # 启动时自动打开窗口
    app_wrapper.show_window(None)

    print("[Novel Studio] 菜单栏已就绪 (关闭窗口后仍在后台运行)")
    app_wrapper.run()

    server.shutdown()
    print("[Novel Studio] 已退出")


if __name__ == '__main__':
    main()

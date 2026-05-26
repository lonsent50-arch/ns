"""绝对最小化测试 — 仅用Python标准库，零依赖"""
import os
import sys
import json
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.environ.get('PORT', 5050))

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        body = json.dumps({'status': 'ok', 'port': PORT, 'path': self.path})
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body.encode())

    def log_message(self, fmt, *args):
        print(f"[REQ] {args}", flush=True)

print(f"Binding to 0.0.0.0:{PORT}", flush=True)
server = HTTPServer(('0.0.0.0', PORT), Handler)
print(f"Listening on port {PORT}", flush=True)
server.serve_forever()

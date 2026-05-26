#!/usr/bin/env python3
"""Novel Studio — 生产服务器入口（使用 waitress）"""
import os
import sys

os.chdir(os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from waitress import serve
from app import app

port = int(os.environ.get('PORT', 80))
host = os.environ.get('HOST', '0.0.0.0')

print(f'[Novel Studio] 生产服务器启动: http://{host}:{port}')
serve(app, host=host, port=port, threads=8)

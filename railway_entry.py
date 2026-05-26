"""Railway 最小启动测试"""
import os
print("=== START ===", flush=True)

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    print("dotenv not available, skipping", flush=True)

from flask import Flask, jsonify
app = Flask(__name__)

@app.route('/api/health')
def health():
    return jsonify({'status': 'ok'})

@app.route('/')
def home():
    return 'Hello from Railway!'

port = int(os.environ.get('PORT', 5050))
print(f"Listening on port {port}", flush=True)
app.run(host='0.0.0.0', port=port)

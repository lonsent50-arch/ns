"""Railway 入口脚本 — 带详细错误诊断"""
import sys
import traceback
import os

print("=== Railway 启动诊断 ===", flush=True)
print(f"Python: {sys.version}", flush=True)
print(f"PORT env: {os.environ.get('PORT', 'NOT SET')}", flush=True)
print(f"DEEPSEEK_API_KEY: {'SET' if os.environ.get('DEEPSEEK_API_KEY') else 'MISSING'}", flush=True)
print(f"SUPABASE_URL: {'SET' if os.environ.get('SUPABASE_URL') else 'MISSING'}", flush=True)

try:
    from dotenv import load_dotenv
    print("python-dotenv: OK", flush=True)
except ImportError as e:
    print(f"python-dotenv: MISSING - {e}", flush=True)
    traceback.print_exc()

try:
    import flask
    print(f"flask: {flask.__version__}", flush=True)
except ImportError as e:
    print(f"flask: MISSING - {e}", flush=True)

try:
    import supabase
    print(f"supabase: OK", flush=True)
except ImportError as e:
    print(f"supabase: MISSING - {e}", flush=True)

try:
    print("Starting app import...", flush=True)
    from app import app
    print("App imported OK", flush=True)
except Exception as e:
    print(f"APP IMPORT FAILED: {e}", flush=True)
    traceback.print_exc()
    sys.exit(1)

port = int(os.environ.get('PORT', 5050))
print(f"Starting on port {port}", flush=True)
app.run(host='0.0.0.0', port=port, debug=False)

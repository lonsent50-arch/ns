#!/bin/bash
set -e
echo "=== Novel Studio ==="
echo "PORT=${PORT}"
cd /app
export PORT=${PORT:-5050}
exec gunicorn app:app --bind "0.0.0.0:${PORT}" --workers 4 --timeout 120

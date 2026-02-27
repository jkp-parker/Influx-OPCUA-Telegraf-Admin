#!/bin/bash
set -e

# Start nginx in the background
nginx -g "daemon off;" &

# Start the FastAPI backend in the foreground
exec uvicorn main:app --host 127.0.0.1 --port 8000

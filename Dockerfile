# ── Stage 1: build the React frontend ────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /app
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --frozen-lockfile 2>/dev/null || npm install

COPY frontend/ .
RUN npm run build

# ── Stage 2: combined backend + frontend ─────────────────────────────────────
FROM python:3.11-slim

WORKDIR /app

# Install nginx and build deps for Python packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ libffi-dev libssl-dev nginx \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Backend source
COPY backend/ .

# Frontend static files
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

# Nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN rm -f /etc/nginx/sites-enabled/default

# Startup script
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

VOLUME ["/app/data"]

ENV DATABASE_URL=sqlite:////app/data/opcua_admin.db

EXPOSE 9077

CMD ["/app/start.sh"]

# FluxForge

A Docker web app for configuring OPC UA data ingestion into InfluxDB via Telegraf.

> This is a **management portal only** — it connects to your existing Telegraf and InfluxDB instances and helps you configure them. It does not run its own.

## Quick Start

```bash
git clone https://github.com/jkp-parker/FluxForge.git
cd FluxForge
docker compose up -d --build
```

Open **http://localhost:9077**. The first run walks you through a setup wizard.

## What It Does

- Store OPC UA device connection details and test connectivity
- Browse live OPC UA node trees and select tags to monitor
- Assign read rates (scan classes) to each tag
- Generate a valid `telegraf.conf` ready to deploy to your Telegraf instance
- Manage multiple InfluxDB targets (different orgs, buckets, or instances)

## Architecture

Single container running a **FastAPI** backend and **React** frontend behind **nginx**. Configuration is stored in a **SQLite** database on a persistent Docker volume.

## Typical Workflow

1. **Add a device** — endpoint URL and credentials
2. **Browse or scan tags** — interactive tree or batch scan
3. **Select tags** — assign scan classes and measurement names
4. **Generate config** — download `telegraf.conf` from the Telegraf Config page
5. **Deploy** — copy to your Telegraf host and reload

## Development

```bash
# Backend
cd backend && pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend && npm install
npm run dev    # http://localhost:5173, proxies /api → :8000
```

## License

Apache 2.0 — see [LICENSE](LICENSE).

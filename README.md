# FluxForge

A Docker web app for configuring and deploying OPC UA data ingestion into InfluxDB via Telegraf.

## Quick Start

```bash
git clone https://github.com/jkp-parker/FluxForge.git
cd FluxForge
docker compose up -d --build
```

Open **http://localhost:9077**. The first run walks you through a setup wizard.

## What It Does

- Store OPC UA device connection details and test connectivity (with OPC UA security policy support)
- Browse live OPC UA node trees and select tags to monitor
- Subscribe to entire branches with node include rules for automatic tag discovery
- Assign read rates (scan classes) to each tag
- Manage multiple InfluxDB targets (v1 and v2) with per-device assignment
- Generate Telegraf configs split across multiple instances for horizontal scaling
- Deploy and manage Telegraf containers directly from the UI via Docker (local socket or remote host)

## Architecture

Single container running a **FastAPI** backend and **React** frontend behind **nginx**. Configuration is stored in a **SQLite** database persisted via bind mount at `./data`.

### Docker Deployment (Optional)

FluxForge can deploy Telegraf containers on your behalf. To enable this:

- **Local Docker host** — the Docker socket is mounted by default (`/var/run/docker.sock`)
- **Remote Docker host** — configure a TCP connection (e.g. `tcp://192.168.1.100:2376`) with optional TLS in the Deployment settings page

Set `TELEGRAF_CONFIG_HOST_PATH` in your environment or in the Deployment settings to tell Telegraf containers where to find their config files on the Docker host.

## Typical Workflow

1. **Add a device** — endpoint URL, credentials, and security policy
2. **Browse or scan tags** — interactive tree or batch scan
3. **Select tags** — assign scan classes and measurement names
4. **Assign to Telegraf instances** — group devices across one or more Telegraf instances for scaling
5. **Generate configs** — view per-instance configs on the Telegraf Config page
6. **Deploy** — use the Deployment page to launch Telegraf containers, or download configs for manual deployment

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `sqlite:////app/data/opcua_admin.db` | SQLAlchemy database URL |
| `TELEGRAF_CONFIG_HOST_PATH` | `./data/telegraf-configs` | Host-side path to generated Telegraf configs (used for container bind mounts) |

## Volumes

| Container Path | Purpose |
|---|---|
| `/app/data` | SQLite database and generated Telegraf config files |
| `/var/run/docker.sock` | Docker socket for local container management (optional) |

## Development

```bash
# Backend
cd backend && pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend && npm install
npm run dev    # http://localhost:5173, proxies /api -> :8000
```

## License

Apache 2.0 — see [LICENSE](LICENSE).

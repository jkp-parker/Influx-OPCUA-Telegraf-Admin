# FluxForge — Sample Stack

This directory contains a ready-to-run environment that wires together
the supporting infrastructure for the FluxForge admin portal:

| Service | Image | Purpose |
|---|---|---|
| **influxdb** | `influxdb:3-core` | InfluxDB 3 Core — time-series engine (SQL + InfluxQL, token auth) |
| **influxdb-explorer** | `influxdata/influxdb3-ui:1.6.2` | Web UI for querying and managing InfluxDB 3 |
| **telegraf** | `telegraf:1.30` | Reads OPC UA nodes and writes to InfluxDB |
| **grafana** | `grafana/grafana:10.4.2` | Dashboards and visualisation (InfluxDB datasource pre-provisioned) |
| **backend** | *(built locally)* | FastAPI admin portal API |
| **frontend** | *(built locally)* | React admin portal UI |

> **InfluxDB 3 vs 2 — key differences:**
> - Port changed from `8086` → `8181`
> - No organisations or username/password — auth is **token-only**
> - Buckets are now called **databases**
> - Flux query language is **not supported** — use InfluxQL or SQL
> - Databases must be created explicitly (handled by `influxdb-init` on first start)

---

## Quick Start

```bash
# From the repository root
cd sample
docker compose up --build
```

Once all containers are healthy:

| URL | What you get |
|---|---|
| `http://localhost:9077` | Admin Portal |
| `http://localhost:3000` | Grafana |
| `http://localhost:8181` | InfluxDB 3 API |
| `http://localhost:8888` | InfluxDB Explorer |

---

## Testing with an OPC UA Source

This sample stack does **not** include a built-in OPC UA simulator. If you would like to test the full end-to-end functionality (device browsing, tag scanning, Telegraf data flow), I recommend spinning up the **Inductive Automation Ignition** container sample project, which provides a full-featured OPC UA server:

> **Ignition by Inductive Automation** — https://hub.docker.com/r/inductiveautomation/ignition

Once Ignition is running, add it as a device in the Admin Portal using its OPC UA endpoint URL.

---

## Demo Credentials

### InfluxDB

| What | Value |
|---|---|
| Admin token | `apiv3_opcua-demo-admin-token-local-dev-only-00000000` |
| Database | `opcua` |

InfluxDB 3 does not have username/password accounts. All access (Telegraf,
Grafana, Explorer, Admin Portal) uses the admin token above.

> **Security note:** Change the token in `docker-compose.yml`,
> `telegraf/telegraf.conf`, `grafana/provisioning/datasources/influxdb.yml`,
> `influxdb-explorer/config/config.json`, and `SESSION_SECRET_KEY` before
> exposing this stack outside of localhost.

### Grafana

| Account | Username | Password | Role |
|---|---|---|---|
| Admin | `admin` | `grafanapassword` | Full admin |
| Anonymous | *(no login)* | *(no login)* | Viewer (read-only) |

Anonymous viewer access is enabled by default so dashboards can be browsed
without logging in. Sign-up is disabled.

---

## InfluxDB Explorer

The Explorer is a browser-based query and admin UI for InfluxDB 3. It is
pre-configured via `influxdb-explorer/config/config.json` to connect to the
local InfluxDB instance.

Open `http://localhost:8888` and use the admin token
`apiv3_opcua-demo-admin-token-local-dev-only-00000000` to log in.

---

## Grafana — InfluxDB Datasource

The InfluxDB datasource is automatically provisioned at startup using the
configuration in `grafana/provisioning/datasources/influxdb.yml`. It uses
**InfluxQL** (Flux is not supported in InfluxDB 3) pointed at
`http://influxdb:8181`.

To create your first dashboard:
1. Open `http://localhost:3000` and log in as `admin` / `grafanapassword`
2. Go to **Dashboards → New → New Dashboard**
3. Add a panel and select **InfluxDB — opcua** as the datasource
4. Write an InfluxQL query against your data

---

## Connecting the Admin Portal

The first time you open `http://localhost:9077` you will see the Setup wizard.
Enter the InfluxDB details above. After saving you can:

1. **Add a Device** — enter the OPC UA endpoint URL for your device or simulator
2. **Browse / Scan** nodes to discover available tags
3. **Enable tags** you want to monitor and assign them to a scan class
4. **View the generated `telegraf.conf`** on the Telegraf Config page
5. **Apply it** by replacing `telegraf/telegraf.conf` and restarting Telegraf:
   ```bash
   docker compose restart telegraf
   ```

---

## Stopping the Stack

```bash
docker compose down          # stop and remove containers
docker compose down -v       # also delete persisted data volumes
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Your OPC UA Device / Simulator                          │
│  (e.g. Ignition, physical PLC, etc.)                     │
└────────────────────┬─────────────────────────────────────┘
                     │ OPC UA
                     ▼
┌──────────────────────────────────────────────────────────┐
│  telegraf                                                │
│  • inputs.opcua  →  reads nodes at configured intervals  │
│  • outputs.influxdb_v2  →  writes to influxdb:8181       │
└────────────────────┬─────────────────────────────────────┘
                     │ HTTP (port 8181)
                     ▼
┌──────────────────────────────────────────────────────────┐
│  influxdb  (port 8181)                                   │
│  InfluxDB 3 Core  •  database: opcua  •  token auth      │
└──────┬─────────────────────────────────┬─────────────────┘
       │ InfluxQL (HTTP)                 │ HTTP API
       ▼                                 ▼
┌──────────────────────────┐  ┌──────────────────────────────┐
│  grafana  (port 3000)    │  │  influxdb-explorer (port 8888)│
│  InfluxDB datasource     │  │  Query & admin UI             │
│  auto-provisioned        │  │  pre-configured via           │
│  accounts: admin /       │  │  config/config.json           │
│  anonymous viewer        │  │                              │
└──────────────────────────┘  └──────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  Admin Portal                                            │
│  frontend (port 9077)  ←→  backend (port 8000)           │
│  • Manage devices, scan classes, InfluxDB targets        │
│  • Generate & download telegraf.conf                     │
└──────────────────────────────────────────────────────────┘
```

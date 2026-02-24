# OPC UA Telegraf Admin — Sample Stack

This directory contains a ready-to-run demo environment that wires together
every component of the OPC UA → Telegraf → InfluxDB → Grafana pipeline:

| Service | Image | Purpose |
|---|---|---|
| **opc-ua-sim** | `iotechsys/opc-ua-sim:1.2` | Simulated OPC UA server with waveform and data-type nodes |
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
| `opc.tcp://localhost:49947` | OPC UA endpoint |

---

## Demo Credentials

### InfluxDB

| What | Value |
|---|---|
| Admin token | `my-super-secret-admin-token` |
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
`my-super-secret-admin-token` to log in.

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
4. Write an InfluxQL query, for example:
   ```sql
   SELECT mean("Counter"), mean("Sinusoid"), mean("Random")
   FROM "opc_sim_telemetry"
   WHERE $timeFilter
   GROUP BY time($__interval)
   ```

---

## Connecting the Admin Portal

The first time you open `http://localhost:9077` you will see the Setup wizard.
Enter the InfluxDB details above. After saving you can:

1. **Add a Device** — use endpoint `opc.tcp://opc-ua-sim:49947`
2. **Browse / Scan** nodes to discover available tags
3. **Enable tags** you want to monitor and assign them to a scan class
4. **View the generated `telegraf.conf`** on the Telegraf Config page
5. **Apply it** by replacing `telegraf/telegraf.conf` and restarting Telegraf:
   ```bash
   docker compose restart telegraf
   ```

---

## Pre-configured Telegraf Nodes

The included `telegraf/telegraf.conf` subscribes to nodes defined by the
IoTech simulator's bundled `simulation.lua` script. The script creates two
namespaces:

- **Namespace 2 (`Static`)** — read/write scalar nodes for each OPC UA data type
- **Namespace 3 (`Simulation`)** — read-only dynamic waveform nodes

**Fast scan (1 s) — measurement `opc_sim_telemetry`**

| Node ID | Description |
|---|---|
| `ns=3;s=Counter` | Monotonically incrementing counter (Double) |
| `ns=3;s=Random` | Random value (Double) |
| `ns=3;s=Sawtooth` | Sawtooth waveform (Double) |
| `ns=3;s=Sinusoid` | Sinusoidal waveform (Double) |
| `ns=3;s=Square` | Square waveform (Double) |
| `ns=3;s=Triangle` | Triangle waveform (Double) |

**Slow scan (10 s) — measurement `opc_sim_static`**

| Node ID | Description |
|---|---|
| `ns=2;s=Int32` | Static Int32 scalar (read/write) |
| `ns=2;s=Float` | Static Float scalar (read/write) |
| `ns=2;s=Double` | Static Double scalar (read/write) |

Additional static nodes available in namespace 2: `Bool`, `Byte`, `SByte`,
`Int16`, `UInt16`, `UInt32`, `Int64`, `UInt64`, `String`, `DateTime`, and
array variants of each. Browse them via the Admin Portal.

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
│  opc-ua-sim  (port 49947)                                │
│  IoTech OPC UA Simulator  (iotechsys/opc-ua-sim:1.2)     │
│  • Waveform nodes: Counter, Random, Sawtooth, …          │
│  • Static data-type nodes: Bool, Int32, Double, …        │
└────────────────────┬─────────────────────────────────────┘
                     │ OPC UA (port 49947)
                     ▼
┌──────────────────────────────────────────────────────────┐
│  telegraf                                                │
│  • inputs.opcua  →  reads nodes every 1 s / 10 s        │
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

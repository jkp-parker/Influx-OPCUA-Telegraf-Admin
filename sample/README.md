# OPC UA Telegraf Admin — Sample Stack

This directory contains a ready-to-run demo environment that wires together
every component of the OPC UA → Telegraf → InfluxDB pipeline:

| Service | Image | Purpose |
|---|---|---|
| **opc-plc** | `mcr.microsoft.com/iotedge/opc-plc` | Simulated OPC UA server with industrial data |
| **influxdb** | `influxdb:2.7` | Time-series database |
| **telegraf** | `telegraf:1.30` | Reads OPC UA nodes and writes to InfluxDB |
| **backend** | *(built locally)* | FastAPI admin portal API |
| **frontend** | *(built locally)* | React admin portal UI |

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
| `http://localhost:8086` | InfluxDB UI |
| `opc.tcp://localhost:50000` | OPC UA endpoint |
| `http://localhost:8080/pn.json` | OPC PLC node listing |

---

## Default Credentials

**InfluxDB**
- Username: `admin`
- Password: `influxpassword`
- Token: `my-super-secret-admin-token`
- Org: `opcua-demo`
- Bucket: `opcua`

> Change these in `docker-compose.yml` before using in any non-local environment.

---

## Connecting the Admin Portal

The first time you open `http://localhost:9077` you will see the Setup wizard.
Enter the InfluxDB details above. After saving you can:

1. **Add a Device** — use endpoint `opc.tcp://opc-plc:50000`
2. **Browse / Scan** nodes to discover available tags
3. **Enable tags** you want to monitor and assign them to a scan class
4. **View the generated `telegraf.conf`** on the Telegraf Config page
5. **Apply it** by replacing `telegraf/telegraf.conf` and restarting Telegraf:
   ```bash
   docker compose restart telegraf
   ```

---

## Pre-configured Telegraf Nodes

The included `telegraf/telegraf.conf` subscribes to the following OPC PLC
simulator nodes out of the box:

**Fast scan (1 s) — measurement `opc_plc_telemetry`**

| Node ID | Description |
|---|---|
| `ns=2;s=AlternatingBoolean` | Toggles true/false every second |
| `ns=2;s=RandomSignedInt32` | Random signed 32-bit integer |
| `ns=2;s=RandomUnsignedInt32` | Random unsigned 32-bit integer |
| `ns=2;s=SpikeData` | Occasional spike anomalies |
| `ns=2;s=DipData` | Occasional dip anomalies |
| `ns=2;s=StepUp` | Monotonically increasing counter |

**Slow scan (10 s) — measurement `opc_plc_trends`**

| Node ID | Description |
|---|---|
| `ns=2;s=NegativeTrendData` | Slowly decreasing value |
| `ns=2;s=PositiveTrendData` | Slowly increasing value |
| `ns=2;s=RandomUnsignedInt32` | Sampled at lower frequency |

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
│  opc-plc  (port 50000)                                   │
│  Microsoft OPC UA PLC Simulator                          │
│  • Random / trend / spike / anomaly nodes                │
└────────────────────┬─────────────────────────────────────┘
                     │ OPC UA (port 50000)
                     ▼
┌──────────────────────────────────────────────────────────┐
│  telegraf                                                │
│  • inputs.opcua  →  reads nodes every 1 s / 10 s        │
│  • outputs.influxdb_v2  →  writes to influxdb:8086       │
└────────────────────┬─────────────────────────────────────┘
                     │ HTTP (port 8086)
                     ▼
┌──────────────────────────────────────────────────────────┐
│  influxdb  (port 8086)                                   │
│  InfluxDB 2.7  •  org: opcua-demo  •  bucket: opcua      │
└─────────────────────────────────────────────────────────-┘

┌──────────────────────────────────────────────────────────┐
│  Admin Portal                                            │
│  frontend (port 9077)  ←→  backend (port 8000)           │
│  • Manage devices, scan classes, InfluxDB targets        │
│  • Generate & download telegraf.conf                     │
└──────────────────────────────────────────────────────────┘
```

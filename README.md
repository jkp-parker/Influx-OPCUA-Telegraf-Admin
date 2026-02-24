# Influx-OPCUA-Telegraf-Admin

A self-contained Docker web application for **configuring and managing the ingestion of OPC UA data into InfluxDB via Telegraf**.

> **Important:** This container is a *management portal only*. It does **not** include or run its own Telegraf or InfluxDB instances. It connects to your existing, externally-hosted Telegraf and InfluxDB services and helps you configure and generate the correct Telegraf configuration for them.

---

## Overview

This portal sits alongside your existing data infrastructure and acts as the control plane for your OPC UA → Telegraf → InfluxDB pipeline:

```
┌─────────────────────────────────────────────────────────────────┐
│                   Your Existing Infrastructure                  │
│                                                                 │
│  ┌──────────────┐    ┌─────────────┐    ┌──────────────────┐   │
│  │ OPC UA PLC/  │───▶│  Telegraf   │───▶│    InfluxDB      │   │
│  │   Devices    │    │  (external) │    │   (external)     │   │
│  └──────────────┘    └──────┬──────┘    └──────────────────┘   │
│                             │                                   │
│                    telegraf.conf (managed by this portal)       │
└─────────────────────────────────────────────────────────────────┘
                             ▲
                             │ generates & manages config
                    ┌────────┴────────┐
                    │  This Container │
                    │  (Admin Portal) │
                    │                 │
                    │ FastAPI backend │
                    │ React frontend  │
                    │ SQLite config   │
                    └─────────────────┘
```

**What this portal does:**
- Stores your OPC UA device connection details
- Lets you browse the live OPC UA node tree and select tags to monitor
- Assigns read rates (scan classes) to each tag
- Generates a valid `telegraf.conf` file you can deploy to your Telegraf instance
- Tests connectivity to your OPC UA devices and InfluxDB
- Tracks which InfluxDB bucket each device writes to

**What this portal does NOT do:**
- Run Telegraf (you manage that separately — on-host, as a Docker service, or on another machine)
- Run InfluxDB (you manage that separately)
- Perform the actual OPC UA reads at runtime (Telegraf handles that once configured)
- Push config to Telegraf automatically — you download the generated file and deploy it yourself

---

## Architecture

| Component | Technology | Purpose |
|---|---|---|
| Web frontend | React 18 + Vite + Tailwind CSS | Browser UI |
| API backend | Python 3.11 / FastAPI | REST API, OPC UA browsing, config generation |
| Database | SQLite (persisted Docker volume) | Stores device, tag, and scan class config |
| OPC UA client | `asyncua` | Browses live node trees for tag discovery |
| InfluxDB client | `influxdb-client` | Tests connections and lists available buckets |
| Config generator | Built-in Python | Renders `telegraf.conf` from stored config |

---

## Quick Start

### Prerequisites

- Docker and Docker Compose installed on your host
- Network access from the Docker host to your OPC UA devices (for tag browsing)
- An existing **InfluxDB v2** instance with an API token that has read/write access
- An existing **Telegraf** instance where you will deploy the generated config

### Run

```bash
git clone https://github.com/jkp-parker/Influx-OPCUA-Telegraf-Admin.git
cd Influx-OPCUA-Telegraf-Admin
docker compose up -d --build
```

Open **http://localhost:9077** in your browser. The first run redirects you through the setup wizard.

---

## First-Run Setup Wizard

When the portal starts with no configuration it automatically redirects to a setup wizard:

| Step | What you enter |
|---|---|
| 1 — Welcome | Name your portal |
| 2 — InfluxDB Connection | URL, API token, organisation, and default bucket of your external InfluxDB |
| 3 — Telegraf Settings | Config file path on your Telegraf host, and the command used to reload Telegraf |
| 4 — Finish | Confirm and launch the portal |

All of these settings can be updated at any time from the **Administration** page.

---

## Pages & Features

### Dashboard
The landing page gives a real-time overview of your pipeline configuration:

- **Stat cards:** Total devices, active tags, scan classes, InfluxDB targets
- **Tags by scan class:** Bar chart showing how many tags are assigned to each read rate
- **InfluxDB targets panel:** All configured InfluxDB destinations with their device counts
- **Device table:** Quick view of all devices with endpoint URLs and active tag counts

### OPC UA Devices
Manage your OPC UA data sources:

- Add, edit, and delete device connections (name, endpoint URL, username/password, security policy)
- Assign each device to a specific InfluxDB target, or fall back to the system-level default
- **Test Connection** — verifies the OPC UA endpoint is reachable from the portal container
- Click a device name to open the tag browser

### Device Detail & Tag Browser
The core workflow — selecting which tags to monitor on a device:

**Browse Tree tab**
- Lazy-loads the OPC UA node tree directly from the live device
- Expand folders to navigate the namespace hierarchy
- Click **Add** on any variable node to save it immediately

**Scan Results tab**
- Click **Scan All Tags** to perform a deep recursive traversal of the entire node tree
- Runs as a background job with a live progress indicator
- Results appear as a sortable, filterable flat table showing name, path, namespace, identifier, and data type

**Filtering & sorting:**
- Free-text search across tag name, full path, and OPC UA identifier
- Filter by namespace index
- Filter by data type
- Sort any column ascending or descending

**Selecting tags:**
- Checkbox-select individual rows or select all filtered results at once
- Assign a scan class to the entire selection in one step
- Click **Add to Saved Tags** to persist the selection

**Saved Tags tab**
- All tags you have chosen to monitor from this device
- Inline editing: change the InfluxDB measurement name and scan class per tag
- Enable/disable individual tags without removing them
- Remove tags you no longer need

### Scan Classes
Define the read-rate groups that control Telegraf's polling interval:

- Create named scan classes with a custom interval in milliseconds
- Quick-add presets: VeryFast (50 ms), Fast (100 ms), Normal (1 s), Slow (10 s)
- Shows how many tags are assigned to each class
- Deleting a scan class unassigns its tags (they remain saved, just unscheduled)

In the generated config, tags with the same scan class on the same device are grouped into a single `[[inputs.opcua]]` block with the corresponding `interval`, so Telegraf polls them at the correct rate.

### InfluxDB Targets
Configure one or more InfluxDB connections:

- Add multiple connections — useful when different devices should write to different InfluxDB organisations, buckets, or instances
- **Test** — validates the API token and checks InfluxDB is reachable
- **Buckets** — queries the live InfluxDB instance and lists all available buckets
- Mark one connection as the default for new devices
- Each device can override the system default with any configured target

### Telegraf Configuration
Generates a ready-to-deploy `telegraf.conf` from your stored configuration:

- Live preview of the full configuration file
- **Regenerate** to refresh after making changes elsewhere
- **Copy to clipboard** for quick pasting
- **Download** saves `telegraf.conf` to your local machine

The generated config includes:
- One `[[outputs.influxdb_v2]]` block per unique InfluxDB target in use
- One `[[inputs.opcua]]` block per device per scan class, so different read rates work correctly
- All tag node IDs, namespaces, identifier types, and measurement name overrides

### Administration
System-wide settings, always accessible from the sidebar:

- Portal display name
- Default InfluxDB URL, API token, org, and bucket
- Telegraf config file path and reload command

---

## Workflow: Onboarding a New Device

1. **Add the device** — Devices page → Add Device (endpoint URL, credentials if required)
2. **Test the connection** — click the Wi-Fi icon to confirm the portal can reach it
3. **Browse or scan tags** — click the device name → Browse Tree (interactive) or Scan All Tags (batch)
4. **Select tags** — checkbox-select in Scan Results, assign a scan class, click Add to Saved Tags
5. **Fine-tune** — Saved Tags tab: adjust measurement names and scan class per tag
6. **Generate config** — Telegraf Config page → Download `telegraf.conf`
7. **Deploy** — copy the file to your Telegraf host and reload Telegraf

---

## Deploying the Generated Config to Telegraf

This portal generates the configuration but does **not** push it automatically. Choose an approach that fits your setup:

**Option A — Manual download and copy**
Download from the Telegraf Config page, then copy to your Telegraf host:
```bash
scp telegraf.conf user@telegraf-host:/etc/telegraf/telegraf.conf
ssh user@telegraf-host "systemctl reload telegraf"
```

**Option B — Mount the Telegraf config directory**
Uncomment the volume mount in `docker-compose.yml` under the `backend` service:
```yaml
volumes:
  - /etc/telegraf:/etc/telegraf
```
Then configure the Administration page to write directly to `/etc/telegraf/telegraf.conf`.
Set the reload command to `systemctl reload telegraf` (or whichever command applies to your setup).

**Option C — Telegraf as a Docker sidecar**
Add a Telegraf service to your own `docker-compose.yml` that mounts a shared volume and points at the same config path. Use `docker restart telegraf` as the reload command.

---

## Configuration Reference

All configuration is persisted in a SQLite database stored in the `opcua_data` Docker volume. No `.env` file is required — all settings are managed through the web UI.

| Setting | Where | Description |
|---|---|---|
| InfluxDB URL | Administration | URL of your external InfluxDB v2 instance |
| InfluxDB API Token | Administration | Token with read/write bucket access |
| InfluxDB Organisation | Administration | InfluxDB org name |
| Default Bucket | Administration | Bucket used when no device-specific target is assigned |
| Telegraf config path | Administration | Filesystem path of the `telegraf.conf` to generate |
| Telegraf reload command | Administration | Shell command to reload Telegraf (e.g. `systemctl reload telegraf`) |

---

## Development

Run backend and frontend separately with hot-reload:

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev          # starts on http://localhost:5173, proxies /api → :8000
```

---

## Ports

| Port | Service |
|---|---|
| `9077` | Web UI (nginx, production build) |
| `8000` | FastAPI REST API (also exposed for debugging) |

To restrict the backend to internal traffic only, remove the `ports` entry for `backend` in `docker-compose.yml` and access it only through the nginx proxy.

---

## License

Apache License 2.0 — see [LICENSE](LICENSE).

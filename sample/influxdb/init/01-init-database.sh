#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# InfluxDB 3 database initialisation script
#
# Runs in a dedicated influxdb-init container AFTER InfluxDB is healthy.
# Uses the influxdb3 CLI (available in the influxdb:3-core image) to create
# the "opcua" database on first start.
#
# Environment variables expected (set in docker-compose.yml):
#   INFLUX_HOST     — e.g. http://influxdb:8181
#   INFLUX_TOKEN    — admin token (apiv3_ prefixed, matches admin-token.json)
#   INFLUX_DATABASE — database name to create, e.g. opcua
# ─────────────────────────────────────────────────────────────────────────────
set -e

INFLUX_HOST="${INFLUX_HOST:-http://influxdb:8181}"
INFLUX_TOKEN="${INFLUX_TOKEN}"
DATABASE="${INFLUX_DATABASE:-opcua}"

echo "[influxdb-init] Creating database '${DATABASE}' on ${INFLUX_HOST}..."

influxdb3 create database "${DATABASE}" \
  --host "${INFLUX_HOST}" \
  --token "${INFLUX_TOKEN}"

echo "[influxdb-init] Done — database '${DATABASE}' ready."

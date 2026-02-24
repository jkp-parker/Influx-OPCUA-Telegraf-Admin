#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# InfluxDB demo-user creation script
#
# Runs in a dedicated influxdb-init container AFTER InfluxDB is healthy,
# so it always connects to the live server on port 8086.
#
# Environment variables expected (set in docker-compose.yml):
#   INFLUX_HOST   — e.g. http://influxdb:8086
#   INFLUX_TOKEN  — admin token
#   INFLUX_ORG    — org name, e.g. opcua-demo
#
# Creates:
#   username : demo
#   password : demopassword
#   role     : Member of the org (read access by default)
# ─────────────────────────────────────────────────────────────────────────────
set -e

INFLUX_URL="${INFLUX_HOST:-http://influxdb:8086}"
ADMIN_TOKEN="${INFLUX_TOKEN}"
ORG="${INFLUX_ORG:-opcua-demo}"

echo "[influxdb-init] Creating demo user..."

# 1 — Create the user
USER_RESPONSE=$(curl -sf -X POST "${INFLUX_URL}/api/v2/users" \
  -H "Authorization: Token ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"name": "demo"}')

USER_ID=$(echo "${USER_RESPONSE}" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")

# 2 — Set the password
curl -sf -X POST "${INFLUX_URL}/api/v2/users/${USER_ID}/password" \
  -H "Authorization: Token ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"password": "demopassword"}'

# 3 — Resolve the org ID
ORG_ID=$(curl -sf "${INFLUX_URL}/api/v2/orgs?org=${ORG}" \
  -H "Authorization: Token ${ADMIN_TOKEN}" \
  | python3 -c "import sys, json; print(json.load(sys.stdin)['orgs'][0]['id'])")

# 4 — Add demo user as an org member
curl -sf -X POST "${INFLUX_URL}/api/v2/orgs/${ORG_ID}/members" \
  -H "Authorization: Token ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"id\": \"${USER_ID}\"}"

echo "[influxdb-init] Done — demo / demopassword added to org '${ORG}'"

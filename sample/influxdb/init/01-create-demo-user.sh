#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# InfluxDB initialisation script — creates a demo read-only user
#
# This script is executed automatically by the InfluxDB Docker image after
# the first-time DOCKER_INFLUXDB_INIT_* setup completes.
# It runs inside the container; curl and python3 are available.
#
# Creates:
#   username : demo
#   password : demopassword
#   role     : Member of the opcua-demo organisation (read-only by default)
# ─────────────────────────────────────────────────────────────────────────────
set -e

INFLUX_URL="http://localhost:8086"
ADMIN_TOKEN="${DOCKER_INFLUXDB_INIT_ADMIN_TOKEN}"
ORG="${DOCKER_INFLUXDB_INIT_ORG}"

echo "[init] Creating demo InfluxDB user..."

# 1 — Create the user account
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

# 3 — Resolve the organisation ID
ORG_RESPONSE=$(curl -sf "${INFLUX_URL}/api/v2/orgs?org=${ORG}" \
  -H "Authorization: Token ${ADMIN_TOKEN}")

ORG_ID=$(echo "${ORG_RESPONSE}" | python3 -c "import sys, json; print(json.load(sys.stdin)['orgs'][0]['id'])")

# 4 — Add the user as a member of the org
curl -sf -X POST "${INFLUX_URL}/api/v2/orgs/${ORG_ID}/members" \
  -H "Authorization: Token ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"id\": \"${USER_ID}\"}"

echo "[init] Demo user created: demo / demopassword (member of ${ORG})"

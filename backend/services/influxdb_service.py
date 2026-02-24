from typing import List, Dict


def test_connection(url: str, token: str, org: str) -> dict:
    try:
        from influxdb_client import InfluxDBClient
        client = InfluxDBClient(url=url, token=token, org=org, timeout=5000)
        health = client.health()
        client.close()
        if health.status == "pass":
            return {"success": True, "message": f"Connected to InfluxDB at {url}"}
        return {"success": False, "message": f"Health check returned: {health.status}"}
    except ImportError:
        return {"success": False, "message": "influxdb-client library not installed"}
    except Exception as e:
        return {"success": False, "message": str(e)}


def list_buckets(url: str, token: str, org: str) -> List[str]:
    try:
        from influxdb_client import InfluxDBClient
        client = InfluxDBClient(url=url, token=token, org=org, timeout=5000)
        buckets_api = client.buckets_api()
        buckets = buckets_api.find_buckets().buckets
        client.close()
        return [b.name for b in buckets if not b.name.startswith("_")]
    except Exception as e:
        raise RuntimeError(f"Failed to list buckets: {e}")

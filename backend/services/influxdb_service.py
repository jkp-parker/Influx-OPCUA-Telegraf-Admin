from typing import List, Dict
import ssl
import urllib.request
import json
import logging

logger = logging.getLogger(__name__)


def _make_ssl_context(url: str):
    if url.lower().startswith("https://"):
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        return ctx
    return None


def _should_skip_verify(url: str) -> bool:
    return url.lower().startswith("https://")


def test_connection(url: str, token: str, org: str, version: int = 2) -> dict:
    url = url.rstrip("/")

    if version == 3:
        return _test_raw(url, token)

    # v1/v2: try raw first, then fall back to influxdb-client
    raw = _test_raw(url, token)
    if raw["success"]:
        return raw
    return _test_v2_client(url, token, org)


def _test_raw(url: str, token: str) -> dict:
    ctx = _make_ssl_context(url)
    headers = {}
    if token:
        headers["Authorization"] = f"Token {token}"

    for path in ["/ping", "/health"]:
        try:
            req = urllib.request.Request(f"{url}{path}", headers=headers)
            kwargs = {"context": ctx} if ctx else {}
            resp = urllib.request.urlopen(req, timeout=5, **kwargs)
            body = resp.read().decode("utf-8", errors="replace")

            try:
                data = json.loads(body)
                ver = data.get("version", "")
                if ver:
                    return {"success": True, "message": f"Connected to InfluxDB {ver} at {url}"}
            except (json.JSONDecodeError, ValueError):
                pass

            return {"success": True, "message": f"Connected to InfluxDB at {url}"}
        except urllib.error.HTTPError as e:
            if e.code == 401:
                return {"success": False, "message": "Connected to InfluxDB but authentication failed. Check your token."}
            continue
        except Exception:
            continue

    return {"success": False, "message": f"Cannot reach InfluxDB at {url}. Check the URL and network connectivity."}


def _test_v2_client(url: str, token: str, org: str) -> dict:
    try:
        from influxdb_client import InfluxDBClient
        skip_verify = _should_skip_verify(url)
        client = InfluxDBClient(
            url=url, token=token, org=org,
            timeout=5000, verify_ssl=not skip_verify,
        )
        try:
            health = client.health()
            if health.status == "pass":
                client.close()
                return {"success": True, "message": f"Connected to InfluxDB at {url}"}
        except Exception:
            pass

        try:
            buckets_api = client.buckets_api()
            buckets = buckets_api.find_buckets()
            client.close()
            count = len(buckets.buckets) if buckets and buckets.buckets else 0
            return {"success": True, "message": f"Connected to InfluxDB at {url} ({count} buckets)"}
        except Exception as e:
            client.close()
            err = str(e)
            if "unauthorized" in err.lower() or "401" in err:
                return {"success": False, "message": "Connected to InfluxDB but authentication failed. Check your token and org."}
            raise
    except ImportError:
        return {"success": False, "message": "influxdb-client library not installed"}
    except Exception as e:
        return {"success": False, "message": str(e)}


def list_buckets(url: str, token: str, org: str, version: int = 2) -> List[str]:
    url_stripped = url.rstrip("/")

    # v3: try SHOW DATABASES via v1 query compat
    if version == 3:
        ctx = _make_ssl_context(url_stripped)
        headers = {}
        if token:
            headers["Authorization"] = f"Token {token}"
        try:
            req = urllib.request.Request(
                f"{url_stripped}/query?q=SHOW+DATABASES",
                headers=headers,
            )
            kwargs = {"context": ctx} if ctx else {}
            resp = urllib.request.urlopen(req, timeout=5, **kwargs)
            data = json.loads(resp.read().decode("utf-8", errors="replace"))
            for result in data.get("results", []):
                for series in result.get("series", []):
                    return [row[0] for row in series.get("values", []) if not row[0].startswith("_")]
        except Exception:
            pass
        return []

    # v1/v2: use influxdb-client
    try:
        from influxdb_client import InfluxDBClient
        skip_verify = _should_skip_verify(url)
        client = InfluxDBClient(
            url=url, token=token, org=org,
            timeout=5000, verify_ssl=not skip_verify,
        )
        buckets_api = client.buckets_api()
        buckets = buckets_api.find_buckets().buckets
        client.close()
        return [b.name for b in buckets if not b.name.startswith("_")]
    except Exception as e:
        raise RuntimeError(f"Failed to list buckets: {e}")

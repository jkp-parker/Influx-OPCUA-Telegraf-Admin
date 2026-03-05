import os
import logging

logger = logging.getLogger(__name__)

TELEGRAF_IMAGE_DEFAULT = "telegraf:1.32"
CONFIG_DIR = "/app/data/telegraf-configs"
CONTAINER_PREFIX = "fluxforge-telegraf-"


class DockerService:
    def __init__(self):
        self._client = None
        self._connection_mode = "local"  # "local" or "remote"
        self._remote_host = ""
        self._tls_verify = False
        self._tls_ca = ""
        self._tls_cert = ""
        self._tls_key = ""

    def configure(self, settings: dict):
        """Reconfigure the Docker connection from DB settings."""
        mode = settings.get("docker_connection_mode", "local")
        remote_host = settings.get("docker_remote_host", "")
        tls_verify = settings.get("docker_tls_verify", "false").lower() == "true"
        tls_ca = settings.get("docker_tls_ca_path", "")
        tls_cert = settings.get("docker_tls_cert_path", "")
        tls_key = settings.get("docker_tls_key_path", "")

        changed = (
            mode != self._connection_mode
            or remote_host != self._remote_host
            or tls_verify != self._tls_verify
            or tls_ca != self._tls_ca
            or tls_cert != self._tls_cert
            or tls_key != self._tls_key
        )

        if changed:
            self._connection_mode = mode
            self._remote_host = remote_host
            self._tls_verify = tls_verify
            self._tls_ca = tls_ca
            self._tls_cert = tls_cert
            self._tls_key = tls_key
            # Force reconnect on next use
            if self._client is not None:
                try:
                    self._client.close()
                except Exception:
                    pass
                self._client = None

    @property
    def client(self):
        if self._client is None:
            import docker
            if self._connection_mode == "remote" and self._remote_host:
                kwargs = {"base_url": self._remote_host}
                if self._tls_verify and self._tls_cert and self._tls_key:
                    tls_config = docker.tls.TLSConfig(
                        ca_cert=self._tls_ca or None,
                        client_cert=(self._tls_cert, self._tls_key),
                        verify=True,
                    )
                    kwargs["tls"] = tls_config
                self._client = docker.DockerClient(**kwargs)
            else:
                self._client = docker.from_env()
        return self._client

    def is_available(self) -> bool:
        try:
            self.client.ping()
            return True
        except Exception:
            return False

    def test_connection(self, settings: dict) -> dict:
        """Test a Docker connection with arbitrary settings (does not persist)."""
        import docker
        mode = settings.get("docker_connection_mode", "local")
        remote_host = settings.get("docker_remote_host", "")
        tls_verify = settings.get("docker_tls_verify", False)
        tls_ca = settings.get("docker_tls_ca_path", "")
        tls_cert = settings.get("docker_tls_cert_path", "")
        tls_key = settings.get("docker_tls_key_path", "")

        try:
            if mode == "remote" and remote_host:
                kwargs = {"base_url": remote_host}
                if tls_verify and tls_cert and tls_key:
                    tls_config = docker.tls.TLSConfig(
                        ca_cert=tls_ca or None,
                        client_cert=(tls_cert, tls_key),
                        verify=True,
                    )
                    kwargs["tls"] = tls_config
                client = docker.DockerClient(**kwargs)
            else:
                client = docker.from_env()

            client.ping()
            info = client.info()
            client.close()
            return {
                "success": True,
                "server_version": info.get("ServerVersion", ""),
                "os": info.get("OperatingSystem", ""),
                "containers": info.get("Containers", 0),
                "images": info.get("Images", 0),
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def write_config(self, instance_name: str, content: str) -> str:
        os.makedirs(CONFIG_DIR, exist_ok=True)
        path = os.path.join(CONFIG_DIR, f"telegraf-{instance_name}.conf")
        with open(path, "w") as f:
            f.write(content)
        return path

    def deploy(self, instance_name: str, config_host_path: str,
               telegraf_image: str = TELEGRAF_IMAGE_DEFAULT) -> dict:
        container_name = f"{CONTAINER_PREFIX}{instance_name}"
        self._remove_if_exists(container_name)

        config_file = os.path.join(config_host_path, f"telegraf-{instance_name}.conf")
        container = self.client.containers.run(
            image=telegraf_image,
            name=container_name,
            detach=True,
            restart_policy={"Name": "unless-stopped"},
            network_mode="host",
            volumes={
                config_file: {"bind": "/etc/telegraf/telegraf.conf", "mode": "ro"}
            },
        )
        return {
            "container_id": container.id,
            "container_name": container_name,
            "status": container.status,
        }

    def get_status(self, instance_name: str) -> dict:
        container_name = f"{CONTAINER_PREFIX}{instance_name}"
        try:
            container = self.client.containers.get(container_name)
            return {
                "container_name": container_name,
                "status": container.status,
                "health": container.attrs.get("State", {}).get("Health", {}).get("Status"),
                "started_at": container.attrs.get("State", {}).get("StartedAt"),
                "image": ",".join(container.image.tags) if container.image.tags else str(container.image.id[:12]),
            }
        except Exception:
            return {
                "container_name": container_name,
                "status": "not_created",
                "health": None,
                "started_at": None,
                "image": None,
            }

    def stop(self, instance_name: str) -> dict:
        container_name = f"{CONTAINER_PREFIX}{instance_name}"
        try:
            container = self.client.containers.get(container_name)
            container.stop(timeout=10)
            return {"status": "stopped"}
        except Exception as e:
            return {"status": "error", "error": str(e)}

    def restart(self, instance_name: str) -> dict:
        container_name = f"{CONTAINER_PREFIX}{instance_name}"
        try:
            container = self.client.containers.get(container_name)
            container.restart(timeout=10)
            return {"status": "restarted"}
        except Exception as e:
            return {"status": "error", "error": str(e)}

    def remove(self, instance_name: str) -> dict:
        container_name = f"{CONTAINER_PREFIX}{instance_name}"
        try:
            self._remove_if_exists(container_name)
            return {"status": "removed"}
        except Exception as e:
            return {"status": "error", "error": str(e)}

    def get_logs(self, instance_name: str, tail: int = 100) -> str:
        container_name = f"{CONTAINER_PREFIX}{instance_name}"
        try:
            container = self.client.containers.get(container_name)
            return container.logs(tail=tail, timestamps=True).decode("utf-8", errors="replace")
        except Exception as e:
            return f"Error fetching logs: {e}"

    def list_managed_containers(self) -> list:
        try:
            containers = self.client.containers.list(
                all=True,
                filters={"name": CONTAINER_PREFIX},
            )
            result = []
            for c in containers:
                result.append({
                    "container_name": c.name,
                    "status": c.status,
                    "image": ",".join(c.image.tags) if c.image.tags else str(c.image.id[:12]),
                })
            return result
        except Exception:
            return []

    def _remove_if_exists(self, container_name: str):
        try:
            container = self.client.containers.get(container_name)
            container.stop(timeout=5)
            container.remove()
        except Exception:
            pass


docker_service = DockerService()

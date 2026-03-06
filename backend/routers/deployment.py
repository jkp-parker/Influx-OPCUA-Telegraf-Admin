from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from database import get_db
import models
import schemas
from services.docker_service import docker_service, _sanitize_container_name
from services import telegraf_generator
from routers.system import _get_config_dict, _set_key
from routers.devices import _scan_cache

router = APIRouter(prefix="/deployment", tags=["deployment"])


def _get_default_influxdb(db: Session):
    return db.query(models.InfluxDBConfig).filter(
        models.InfluxDBConfig.is_default == True
    ).first()


def _get_default_scan_class(db: Session):
    return db.query(models.ScanClass).filter(
        models.ScanClass.is_default == True
    ).first()


def _get_deployment_settings(db: Session) -> dict:
    cfg = _get_config_dict(db)
    return {
        "docker_enabled": cfg.get("docker_enabled", "false").lower() == "true",
        "telegraf_image": cfg.get("telegraf_image", "telegraf:1.32"),
        "telegraf_config_host_path": cfg.get(
            "telegraf_config_host_path",
            _get_env_host_path(),
        ),
        "docker_connection_mode": cfg.get("docker_connection_mode", "local"),
        "docker_remote_host": cfg.get("docker_remote_host", ""),
        "docker_tls_verify": cfg.get("docker_tls_verify", "false").lower() == "true",
        "docker_tls_ca_path": cfg.get("docker_tls_ca_path", ""),
        "docker_tls_cert_path": cfg.get("docker_tls_cert_path", ""),
        "docker_tls_key_path": cfg.get("docker_tls_key_path", ""),
    }


def _apply_docker_settings(db: Session):
    """Read Docker connection settings from DB and apply to the docker_service."""
    cfg = _get_config_dict(db)
    docker_service.configure(cfg)


def _get_env_host_path() -> str:
    import os
    return os.environ.get("TELEGRAF_CONFIG_HOST_PATH", "")


@router.get("/status")
def get_deployment_status(db: Session = Depends(get_db)):
    _apply_docker_settings(db)
    settings = _get_deployment_settings(db)
    available = docker_service.is_available()

    instances = db.query(models.TelegrafInstance).order_by(
        models.TelegrafInstance.name
    ).all()

    container_statuses = []
    for inst in instances:
        status_info = docker_service.get_status(inst.name) if available else {
            "container_name": f"fluxforge-telegraf-{_sanitize_container_name(inst.name)}",
            "status": "not_created",
            "health": None,
            "started_at": None,
            "image": None,
        }
        tag_count = db.query(models.Tag).join(models.Device).filter(
            models.Device.telegraf_instance_id == inst.id,
            models.Tag.enabled == True,
        ).count()
        container_statuses.append(schemas.ContainerStatusOut(
            instance_id=inst.id,
            instance_name=inst.name,
            **status_info,
        ))

    return {
        "docker_available": available,
        "settings": schemas.DeploymentSettingsOut(
            docker_available=available,
            **settings,
        ),
        "containers": container_statuses,
    }


@router.post("/instances/{instance_id}/deploy")
def deploy_instance(instance_id: int, db: Session = Depends(get_db)):
    _apply_docker_settings(db)
    settings = _get_deployment_settings(db)
    if not settings["telegraf_config_host_path"]:
        raise HTTPException(
            status_code=400,
            detail="telegraf_config_host_path is not configured. Set it in Administration > Docker Deployment.",
        )

    if not docker_service.is_available():
        raise HTTPException(status_code=503, detail="Docker is not available")

    inst = db.query(models.TelegrafInstance).filter(
        models.TelegrafInstance.id == instance_id
    ).first()
    if not inst:
        raise HTTPException(status_code=404, detail="Telegraf instance not found")

    system_cfg = _get_config_dict(db)
    default_influx = _get_default_influxdb(db)
    default_sc = _get_default_scan_class(db)
    tags = db.query(models.Tag).options(
        joinedload(models.Tag.scan_class),
        joinedload(models.Tag.device).joinedload(models.Device.influxdb_config),
    ).filter(
        models.Tag.telegraf_instance_id == instance_id,
        models.Tag.enabled == True,
    ).all()
    config_content = telegraf_generator.generate_config_from_tags(
        tags, system_cfg, default_influx,
        scan_cache=_scan_cache, default_scan_class=default_sc,
    )

    docker_service.write_config(inst.name, config_content)

    result = docker_service.deploy(
        inst.name,
        config_host_path=settings["telegraf_config_host_path"],
        telegraf_image=settings["telegraf_image"],
    )
    return result


@router.post("/instances/{instance_id}/action")
def instance_action(instance_id: int, payload: schemas.ContainerActionRequest, db: Session = Depends(get_db)):
    _apply_docker_settings(db)
    if not docker_service.is_available():
        raise HTTPException(status_code=503, detail="Docker is not available")

    inst = db.query(models.TelegrafInstance).filter(
        models.TelegrafInstance.id == instance_id
    ).first()
    if not inst:
        raise HTTPException(status_code=404, detail="Telegraf instance not found")

    action = payload.action
    if action == "stop":
        return docker_service.stop(inst.name)
    elif action == "restart":
        return docker_service.restart(inst.name)
    elif action == "remove":
        return docker_service.remove(inst.name)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown action: {action}")


@router.get("/instances/{instance_id}/logs")
def get_instance_logs(instance_id: int, tail: int = 100, db: Session = Depends(get_db)):
    _apply_docker_settings(db)
    inst = db.query(models.TelegrafInstance).filter(
        models.TelegrafInstance.id == instance_id
    ).first()
    if not inst:
        raise HTTPException(status_code=404, detail="Telegraf instance not found")

    logs = docker_service.get_logs(inst.name, tail=tail)
    return {"logs": logs}


@router.post("/deploy-all")
def deploy_all(db: Session = Depends(get_db)):
    _apply_docker_settings(db)
    settings = _get_deployment_settings(db)
    if not settings["telegraf_config_host_path"]:
        raise HTTPException(
            status_code=400,
            detail="telegraf_config_host_path is not configured.",
        )
    if not docker_service.is_available():
        raise HTTPException(status_code=503, detail="Docker is not available")

    instances = db.query(models.TelegrafInstance).filter(
        models.TelegrafInstance.enabled == True
    ).all()

    system_cfg = _get_config_dict(db)
    default_influx = _get_default_influxdb(db)
    default_sc = _get_default_scan_class(db)

    results = []
    for inst in instances:
        tags = db.query(models.Tag).options(
            joinedload(models.Tag.scan_class),
            joinedload(models.Tag.device).joinedload(models.Device.influxdb_config),
        ).filter(
            models.Tag.telegraf_instance_id == inst.id,
            models.Tag.enabled == True,
        ).all()
        config_content = telegraf_generator.generate_config_from_tags(
            tags, system_cfg, default_influx,
            scan_cache=_scan_cache, default_scan_class=default_sc,
        )
        docker_service.write_config(inst.name, config_content)
        result = docker_service.deploy(
            inst.name,
            config_host_path=settings["telegraf_config_host_path"],
            telegraf_image=settings["telegraf_image"],
        )
        results.append({"instance": inst.name, **result})

    return {"deployed": len(results), "results": results}


@router.get("/settings", response_model=schemas.DeploymentSettingsOut)
def get_settings(db: Session = Depends(get_db)):
    _apply_docker_settings(db)
    settings = _get_deployment_settings(db)
    return schemas.DeploymentSettingsOut(
        docker_available=docker_service.is_available(),
        **settings,
    )


@router.put("/settings", response_model=schemas.DeploymentSettingsOut)
def update_settings(payload: schemas.DeploymentSettingsUpdate, db: Session = Depends(get_db)):
    if payload.docker_enabled is not None:
        _set_key(db, "docker_enabled", str(payload.docker_enabled).lower())
    if payload.telegraf_image is not None:
        _set_key(db, "telegraf_image", payload.telegraf_image)
    if payload.telegraf_config_host_path is not None:
        _set_key(db, "telegraf_config_host_path", payload.telegraf_config_host_path)
    if payload.docker_connection_mode is not None:
        _set_key(db, "docker_connection_mode", payload.docker_connection_mode)
    if payload.docker_remote_host is not None:
        _set_key(db, "docker_remote_host", payload.docker_remote_host)
    if payload.docker_tls_verify is not None:
        _set_key(db, "docker_tls_verify", str(payload.docker_tls_verify).lower())
    if payload.docker_tls_ca_path is not None:
        _set_key(db, "docker_tls_ca_path", payload.docker_tls_ca_path)
    if payload.docker_tls_cert_path is not None:
        _set_key(db, "docker_tls_cert_path", payload.docker_tls_cert_path)
    if payload.docker_tls_key_path is not None:
        _set_key(db, "docker_tls_key_path", payload.docker_tls_key_path)
    db.commit()

    _apply_docker_settings(db)
    settings = _get_deployment_settings(db)
    return schemas.DeploymentSettingsOut(
        docker_available=docker_service.is_available(),
        **settings,
    )


@router.post("/test-docker")
def test_docker_connection(payload: schemas.DockerTestConnectionRequest):
    result = docker_service.test_connection(payload.model_dump())
    return result

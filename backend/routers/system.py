from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models
import schemas

router = APIRouter(prefix="/system", tags=["system"])

SYSTEM_KEYS = [
    "setup_complete",
    "influxdb_url",
    "influxdb_token",
    "influxdb_org",
    "influxdb_default_bucket",
    "telegraf_config_path",
    "telegraf_reload_command",
    "app_title",
]

DEFAULTS = {
    "setup_complete": "false",
    "influxdb_url": "",
    "influxdb_token": "",
    "influxdb_org": "",
    "influxdb_default_bucket": "",
    "telegraf_config_path": "/etc/telegraf/telegraf.conf",
    "telegraf_reload_command": "systemctl reload telegraf",
    "app_title": "OPC UA Telegraf Admin",
}


def _get_config_dict(db: Session) -> dict:
    rows = db.query(models.SystemConfig).all()
    cfg = dict(DEFAULTS)
    for row in rows:
        cfg[row.key] = row.value
    return cfg


def _set_key(db: Session, key: str, value: str):
    row = db.query(models.SystemConfig).filter(models.SystemConfig.key == key).first()
    if row:
        row.value = value
    else:
        row = models.SystemConfig(key=key, value=value)
        db.add(row)


@router.get("/config", response_model=schemas.SystemConfigOut)
def get_config(db: Session = Depends(get_db)):
    cfg = _get_config_dict(db)
    return schemas.SystemConfigOut(
        setup_complete=cfg.get("setup_complete", "false").lower() == "true",
        influxdb_url=cfg.get("influxdb_url", ""),
        influxdb_token=cfg.get("influxdb_token", ""),
        influxdb_org=cfg.get("influxdb_org", ""),
        influxdb_default_bucket=cfg.get("influxdb_default_bucket", ""),
        telegraf_config_path=cfg.get("telegraf_config_path", "/etc/telegraf/telegraf.conf"),
        telegraf_reload_command=cfg.get("telegraf_reload_command", "systemctl reload telegraf"),
        app_title=cfg.get("app_title", "OPC UA Telegraf Admin"),
    )


@router.put("/config", response_model=schemas.SystemConfigOut)
def update_config(payload: schemas.SystemConfigUpdate, db: Session = Depends(get_db)):
    fields = {
        "influxdb_url": payload.influxdb_url or "",
        "influxdb_token": payload.influxdb_token or "",
        "influxdb_org": payload.influxdb_org or "",
        "influxdb_default_bucket": payload.influxdb_default_bucket or "",
        "telegraf_config_path": payload.telegraf_config_path or "/etc/telegraf/telegraf.conf",
        "telegraf_reload_command": payload.telegraf_reload_command or "systemctl reload telegraf",
        "app_title": payload.app_title or "OPC UA Telegraf Admin",
        "setup_complete": "true",
    }
    for key, value in fields.items():
        _set_key(db, key, value)
    db.commit()
    return get_config(db)


@router.post("/config/test-influxdb")
def test_influxdb(db: Session = Depends(get_db)):
    from services import influxdb_service
    cfg = _get_config_dict(db)
    result = influxdb_service.test_connection(
        cfg.get("influxdb_url", ""),
        cfg.get("influxdb_token", ""),
        cfg.get("influxdb_org", ""),
    )
    return result

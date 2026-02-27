from fastapi import APIRouter, Depends
from fastapi.responses import PlainTextResponse, Response
from sqlalchemy.orm import Session, joinedload
from database import get_db
import models
from services import telegraf_generator
from routers.system import _get_config_dict

router = APIRouter(prefix="/telegraf", tags=["telegraf"])


def _load_devices(db: Session):
    return db.query(models.Device).options(
        joinedload(models.Device.tags).joinedload(models.Tag.scan_class),
        joinedload(models.Device.influxdb_config),
    ).filter(models.Device.enabled == True).order_by(models.Device.name).all()


def _get_default_influxdb(db: Session):
    return db.query(models.InfluxDBConfig).filter(
        models.InfluxDBConfig.is_default == True
    ).first()


@router.get("/config", response_class=PlainTextResponse)
def get_config(db: Session = Depends(get_db)):
    devices = _load_devices(db)
    system_cfg = _get_config_dict(db)
    default_influx = _get_default_influxdb(db)
    return telegraf_generator.generate_config(devices, system_cfg, default_influx)


@router.get("/config/download")
def download_config(db: Session = Depends(get_db)):
    devices = _load_devices(db)
    system_cfg = _get_config_dict(db)
    default_influx = _get_default_influxdb(db)
    content = telegraf_generator.generate_config(devices, system_cfg, default_influx)
    return Response(
        content=content,
        media_type="text/plain",
        headers={"Content-Disposition": "attachment; filename=telegraf.conf"},
    )

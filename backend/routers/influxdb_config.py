from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models
import schemas
from services import influxdb_service
from schemas import InfluxTestRequest

router = APIRouter(prefix="/influxdb", tags=["influxdb"])


@router.get("", response_model=list[schemas.InfluxDBConfigOut])
def list_configs(db: Session = Depends(get_db)):
    items = db.query(models.InfluxDBConfig).order_by(models.InfluxDBConfig.name).all()
    result = []
    for item in items:
        device_count = db.query(models.Device).filter(models.Device.influxdb_config_id == item.id).count()
        out = schemas.InfluxDBConfigOut.model_validate(item)
        out.device_count = device_count
        result.append(out)
    return result


@router.post("", response_model=schemas.InfluxDBConfigOut)
def create_config(payload: schemas.InfluxDBConfigCreate, db: Session = Depends(get_db)):
    existing = db.query(models.InfluxDBConfig).filter(models.InfluxDBConfig.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Name already exists")
    if payload.is_default:
        db.query(models.InfluxDBConfig).update({"is_default": False})
    cfg = models.InfluxDBConfig(**payload.model_dump())
    db.add(cfg)
    db.commit()
    db.refresh(cfg)
    out = schemas.InfluxDBConfigOut.model_validate(cfg)
    out.device_count = 0
    return out


@router.post("/test-connection")
def test_connection_unsaved(payload: InfluxTestRequest):
    """Test an InfluxDB connection without saving the config first."""
    return influxdb_service.test_connection(payload.url, payload.token, payload.org)


@router.get("/{cfg_id}", response_model=schemas.InfluxDBConfigOut)
def get_config(cfg_id: int, db: Session = Depends(get_db)):
    cfg = db.query(models.InfluxDBConfig).filter(models.InfluxDBConfig.id == cfg_id).first()
    if not cfg:
        raise HTTPException(status_code=404, detail="InfluxDB config not found")
    device_count = db.query(models.Device).filter(models.Device.influxdb_config_id == cfg_id).count()
    out = schemas.InfluxDBConfigOut.model_validate(cfg)
    out.device_count = device_count
    return out


@router.put("/{cfg_id}", response_model=schemas.InfluxDBConfigOut)
def update_config(cfg_id: int, payload: schemas.InfluxDBConfigUpdate, db: Session = Depends(get_db)):
    cfg = db.query(models.InfluxDBConfig).filter(models.InfluxDBConfig.id == cfg_id).first()
    if not cfg:
        raise HTTPException(status_code=404, detail="InfluxDB config not found")
    existing = db.query(models.InfluxDBConfig).filter(
        models.InfluxDBConfig.name == payload.name,
        models.InfluxDBConfig.id != cfg_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Name already in use")
    if payload.is_default:
        db.query(models.InfluxDBConfig).filter(models.InfluxDBConfig.id != cfg_id).update({"is_default": False})
    for field, value in payload.model_dump().items():
        setattr(cfg, field, value)
    db.commit()
    db.refresh(cfg)
    device_count = db.query(models.Device).filter(models.Device.influxdb_config_id == cfg_id).count()
    out = schemas.InfluxDBConfigOut.model_validate(cfg)
    out.device_count = device_count
    return out


@router.delete("/{cfg_id}")
def delete_config(cfg_id: int, db: Session = Depends(get_db)):
    cfg = db.query(models.InfluxDBConfig).filter(models.InfluxDBConfig.id == cfg_id).first()
    if not cfg:
        raise HTTPException(status_code=404, detail="InfluxDB config not found")
    db.query(models.Device).filter(models.Device.influxdb_config_id == cfg_id).update({"influxdb_config_id": None})
    db.delete(cfg)
    db.commit()
    return {"ok": True}


@router.post("/{cfg_id}/test")
def test_connection(cfg_id: int, db: Session = Depends(get_db)):
    cfg = db.query(models.InfluxDBConfig).filter(models.InfluxDBConfig.id == cfg_id).first()
    if not cfg:
        raise HTTPException(status_code=404, detail="InfluxDB config not found")
    return influxdb_service.test_connection(cfg.url, cfg.token, cfg.org)


@router.get("/{cfg_id}/buckets")
def list_buckets(cfg_id: int, db: Session = Depends(get_db)):
    cfg = db.query(models.InfluxDBConfig).filter(models.InfluxDBConfig.id == cfg_id).first()
    if not cfg:
        raise HTTPException(status_code=404, detail="InfluxDB config not found")
    try:
        buckets = influxdb_service.list_buckets(cfg.url, cfg.token, cfg.org)
        return {"buckets": buckets}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

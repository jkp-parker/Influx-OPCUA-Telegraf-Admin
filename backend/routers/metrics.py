from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
import models

router = APIRouter(prefix="/metrics", tags=["metrics"])


@router.get("")
def get_metrics(db: Session = Depends(get_db)):
    total_devices = db.query(models.Device).count()
    enabled_devices = db.query(models.Device).filter(models.Device.enabled == True).count()
    total_tags = db.query(models.Tag).count()
    enabled_tags = db.query(models.Tag).filter(models.Tag.enabled == True).count()
    scan_class_count = db.query(models.ScanClass).count()
    influxdb_count = db.query(models.InfluxDBConfig).count()

    # Tags per scan class
    scan_classes = db.query(models.ScanClass).order_by(models.ScanClass.interval_ms).all()
    tags_by_scan_class = []
    for sc in scan_classes:
        count = db.query(models.Tag).filter(
            models.Tag.scan_class_id == sc.id, models.Tag.enabled == True
        ).count()
        tags_by_scan_class.append({
            "name": sc.name,
            "interval_ms": sc.interval_ms,
            "tag_count": count,
        })

    unassigned_tags = db.query(models.Tag).filter(
        models.Tag.scan_class_id == None, models.Tag.enabled == True
    ).count()
    if unassigned_tags > 0:
        tags_by_scan_class.append({
            "name": "Unassigned",
            "interval_ms": 0,
            "tag_count": unassigned_tags,
        })

    # Devices with their tag counts and influxdb targets
    devices = db.query(models.Device).order_by(models.Device.name).all()
    device_summary = []
    for d in devices:
        tag_count = db.query(models.Tag).filter(
            models.Tag.device_id == d.id, models.Tag.enabled == True
        ).count()
        influx_name = None
        if d.influxdb_config_id:
            cfg = db.query(models.InfluxDBConfig).filter(
                models.InfluxDBConfig.id == d.influxdb_config_id
            ).first()
            if cfg:
                influx_name = cfg.name
        device_summary.append({
            "id": d.id,
            "name": d.name,
            "endpoint_url": d.endpoint_url,
            "enabled": d.enabled,
            "enabled_tag_count": tag_count,
            "influxdb_name": influx_name,
        })

    # InfluxDB config summaries
    influx_configs = db.query(models.InfluxDBConfig).all()
    influx_summary = []
    for cfg in influx_configs:
        device_count = db.query(models.Device).filter(
            models.Device.influxdb_config_id == cfg.id
        ).count()
        influx_summary.append({
            "id": cfg.id,
            "name": cfg.name,
            "url": cfg.url,
            "org": cfg.org,
            "bucket": cfg.bucket,
            "is_default": cfg.is_default,
            "device_count": device_count,
        })

    return {
        "total_devices": total_devices,
        "enabled_devices": enabled_devices,
        "total_tags": total_tags,
        "enabled_tags": enabled_tags,
        "scan_class_count": scan_class_count,
        "influxdb_count": influxdb_count,
        "tags_by_scan_class": tags_by_scan_class,
        "device_summary": device_summary,
        "influx_summary": influx_summary,
    }

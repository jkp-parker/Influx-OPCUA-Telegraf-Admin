from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from typing import Optional
from database import get_db
import models
import schemas
from services import opcua_service
from schemas import OpcuaTestRequest

router = APIRouter(prefix="/devices", tags=["devices"])

# In-memory scan cache: device_id -> {"status": ..., "nodes": [...]}
_scan_cache: dict = {}


@router.get("", response_model=list[schemas.DeviceOut])
def list_devices(db: Session = Depends(get_db)):
    devices = db.query(models.Device).options(
        joinedload(models.Device.influxdb_config)
    ).order_by(models.Device.name).all()
    result = []
    for d in devices:
        tag_count = db.query(models.Tag).filter(models.Tag.device_id == d.id).count()
        enabled_tag_count = db.query(models.Tag).filter(
            models.Tag.device_id == d.id, models.Tag.enabled == True
        ).count()
        out = schemas.DeviceOut.model_validate(d)
        out.tag_count = tag_count
        out.enabled_tag_count = enabled_tag_count
        out.influxdb_name = d.influxdb_config.name if d.influxdb_config else None
        result.append(out)
    return result


@router.post("", response_model=schemas.DeviceOut)
def create_device(payload: schemas.DeviceCreate, db: Session = Depends(get_db)):
    existing = db.query(models.Device).filter(models.Device.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Device name already exists")
    device = models.Device(**payload.model_dump())
    db.add(device)
    db.commit()
    db.refresh(device)
    out = schemas.DeviceOut.model_validate(device)
    out.tag_count = 0
    out.enabled_tag_count = 0
    return out


@router.post("/test-connection")
def test_connection_unsaved(payload: OpcuaTestRequest):
    """Test an OPC UA connection without saving the device first."""
    return opcua_service.test_connection(payload.endpoint_url, payload.username or "", payload.password or "")


@router.get("/{device_id}", response_model=schemas.DeviceOut)
def get_device(device_id: int, db: Session = Depends(get_db)):
    device = db.query(models.Device).options(
        joinedload(models.Device.influxdb_config)
    ).filter(models.Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    tag_count = db.query(models.Tag).filter(models.Tag.device_id == device_id).count()
    enabled_tag_count = db.query(models.Tag).filter(
        models.Tag.device_id == device_id, models.Tag.enabled == True
    ).count()
    out = schemas.DeviceOut.model_validate(device)
    out.tag_count = tag_count
    out.enabled_tag_count = enabled_tag_count
    out.influxdb_name = device.influxdb_config.name if device.influxdb_config else None
    return out


@router.put("/{device_id}", response_model=schemas.DeviceOut)
def update_device(device_id: int, payload: schemas.DeviceUpdate, db: Session = Depends(get_db)):
    device = db.query(models.Device).filter(models.Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    existing = db.query(models.Device).filter(
        models.Device.name == payload.name,
        models.Device.id != device_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Device name already in use")
    for field, value in payload.model_dump().items():
        setattr(device, field, value)
    db.commit()
    db.refresh(device)
    tag_count = db.query(models.Tag).filter(models.Tag.device_id == device_id).count()
    enabled_tag_count = db.query(models.Tag).filter(
        models.Tag.device_id == device_id, models.Tag.enabled == True
    ).count()
    out = schemas.DeviceOut.model_validate(device)
    out.tag_count = tag_count
    out.enabled_tag_count = enabled_tag_count
    return out


@router.delete("/{device_id}")
def delete_device(device_id: int, db: Session = Depends(get_db)):
    device = db.query(models.Device).filter(models.Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    db.delete(device)
    db.commit()
    return {"ok": True}


@router.post("/{device_id}/test-connection")
def test_connection(device_id: int, db: Session = Depends(get_db)):
    device = db.query(models.Device).filter(models.Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return opcua_service.test_connection(device.endpoint_url, device.username, device.password)


@router.post("/{device_id}/browse")
def browse_node(
    device_id: int,
    node_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    device = db.query(models.Device).filter(models.Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    try:
        nodes = opcua_service.browse_node(
            device.endpoint_url, node_id, device.username, device.password
        )
        return {"nodes": nodes}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _do_scan(device_id: int, endpoint_url: str, username: str, password: str):
    _scan_cache[device_id] = {"status": "scanning", "nodes": [], "error": None}
    try:
        nodes = opcua_service.scan_all_variables(endpoint_url, username, password)
        _scan_cache[device_id] = {"status": "complete", "nodes": nodes, "error": None}
    except Exception as e:
        _scan_cache[device_id] = {"status": "error", "nodes": [], "error": str(e)}


@router.post("/{device_id}/scan")
def start_scan(device_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    device = db.query(models.Device).filter(models.Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    existing = _scan_cache.get(device_id, {})
    if existing.get("status") == "scanning":
        return {"status": "scanning", "message": "Scan already in progress"}
    background_tasks.add_task(_do_scan, device_id, device.endpoint_url, device.username, device.password)
    _scan_cache[device_id] = {"status": "scanning", "nodes": [], "error": None}
    return {"status": "scanning", "message": "Scan started"}


@router.get("/{device_id}/scan")
def get_scan_status(device_id: int):
    status = _scan_cache.get(device_id, {"status": "idle", "nodes": [], "error": None})
    return status


@router.delete("/{device_id}/scan")
def clear_scan(device_id: int):
    _scan_cache.pop(device_id, None)
    return {"ok": True}


# Tag management for a device
@router.get("/{device_id}/tags", response_model=list[schemas.TagOut])
def get_device_tags(device_id: int, db: Session = Depends(get_db)):
    device = db.query(models.Device).filter(models.Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    tags = db.query(models.Tag).options(
        joinedload(models.Tag.scan_class)
    ).filter(models.Tag.device_id == device_id).all()
    result = []
    for tag in tags:
        out = schemas.TagOut.model_validate(tag)
        out.scan_class_name = tag.scan_class.name if tag.scan_class else None
        result.append(out)
    return result


@router.put("/{device_id}/tags")
def save_device_tags(device_id: int, payload: schemas.BulkTagSave, db: Session = Depends(get_db)):
    """Replace all tags for a device with the provided list."""
    device = db.query(models.Device).filter(models.Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    # Delete existing tags
    db.query(models.Tag).filter(models.Tag.device_id == device_id).delete()

    # Insert new tags
    for tag_data in payload.tags:
        tag = models.Tag(**tag_data.model_dump())
        db.add(tag)

    db.commit()
    return {"ok": True, "count": len(payload.tags)}


@router.patch("/{device_id}/tags/{tag_id}", response_model=schemas.TagOut)
def update_tag(device_id: int, tag_id: int, payload: schemas.TagUpdate, db: Session = Depends(get_db)):
    tag = db.query(models.Tag).filter(
        models.Tag.id == tag_id, models.Tag.device_id == device_id
    ).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    update_data = payload.model_dump(exclude_none=True)
    for field, value in update_data.items():
        setattr(tag, field, value)
    db.commit()
    db.refresh(tag)
    out = schemas.TagOut.model_validate(tag)
    out.scan_class_name = tag.scan_class.name if tag.scan_class else None
    return out


@router.delete("/{device_id}/tags/{tag_id}")
def delete_tag(device_id: int, tag_id: int, db: Session = Depends(get_db)):
    tag = db.query(models.Tag).filter(
        models.Tag.id == tag_id, models.Tag.device_id == device_id
    ).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    db.delete(tag)
    db.commit()
    return {"ok": True}

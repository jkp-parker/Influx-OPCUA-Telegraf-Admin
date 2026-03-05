from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse, Response
from sqlalchemy.orm import Session, joinedload
from database import get_db
import models
import schemas
from services import telegraf_generator
from routers.system import _get_config_dict
from routers.devices import _scan_cache

router = APIRouter(prefix="/telegraf-instances", tags=["telegraf-instances"])


def _load_instance(db: Session, instance_id: int):
    inst = db.query(models.TelegrafInstance).options(
        joinedload(models.TelegrafInstance.devices)
        .joinedload(models.Device.tags)
        .joinedload(models.Tag.scan_class),
        joinedload(models.TelegrafInstance.devices)
        .joinedload(models.Device.node_includes)
        .joinedload(models.NodeInclude.scan_class),
        joinedload(models.TelegrafInstance.devices)
        .joinedload(models.Device.influxdb_config),
    ).filter(models.TelegrafInstance.id == instance_id).first()
    if not inst:
        raise HTTPException(status_code=404, detail="Telegraf instance not found")
    return inst


def _get_default_influxdb(db: Session):
    return db.query(models.InfluxDBConfig).filter(
        models.InfluxDBConfig.is_default == True
    ).first()


def _get_default_scan_class(db: Session):
    return db.query(models.ScanClass).filter(
        models.ScanClass.is_default == True
    ).first()


def _instance_out(inst, db: Session) -> schemas.TelegrafInstanceOut:
    tag_count = db.query(models.Tag).join(models.Device).filter(
        models.Device.telegraf_instance_id == inst.id,
        models.Tag.enabled == True,
    ).count()
    device_count = db.query(models.Device).filter(
        models.Device.telegraf_instance_id == inst.id,
    ).count()
    out = schemas.TelegrafInstanceOut.model_validate(inst)
    out.device_count = device_count
    out.tag_count = tag_count
    return out


@router.get("", response_model=list[schemas.TelegrafInstanceOut])
def list_instances(db: Session = Depends(get_db)):
    instances = db.query(models.TelegrafInstance).order_by(
        models.TelegrafInstance.name
    ).all()
    return [_instance_out(inst, db) for inst in instances]


@router.post("", response_model=schemas.TelegrafInstanceOut)
def create_instance(payload: schemas.TelegrafInstanceCreate, db: Session = Depends(get_db)):
    existing = db.query(models.TelegrafInstance).filter(
        models.TelegrafInstance.name == payload.name
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Instance name already exists")

    inst = models.TelegrafInstance(
        name=payload.name,
        description=payload.description or "",
        enabled=payload.enabled if payload.enabled is not None else True,
    )
    db.add(inst)
    db.flush()

    if payload.device_ids:
        devices = db.query(models.Device).filter(
            models.Device.id.in_(payload.device_ids)
        ).all()
        for dev in devices:
            dev.telegraf_instance_id = inst.id

    db.commit()
    db.refresh(inst)
    return _instance_out(inst, db)


@router.get("/{instance_id}", response_model=schemas.TelegrafInstanceOut)
def get_instance(instance_id: int, db: Session = Depends(get_db)):
    inst = db.query(models.TelegrafInstance).filter(
        models.TelegrafInstance.id == instance_id
    ).first()
    if not inst:
        raise HTTPException(status_code=404, detail="Telegraf instance not found")
    return _instance_out(inst, db)


@router.put("/{instance_id}", response_model=schemas.TelegrafInstanceOut)
def update_instance(instance_id: int, payload: schemas.TelegrafInstanceUpdate, db: Session = Depends(get_db)):
    inst = db.query(models.TelegrafInstance).filter(
        models.TelegrafInstance.id == instance_id
    ).first()
    if not inst:
        raise HTTPException(status_code=404, detail="Telegraf instance not found")

    existing = db.query(models.TelegrafInstance).filter(
        models.TelegrafInstance.name == payload.name,
        models.TelegrafInstance.id != instance_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Instance name already in use")

    inst.name = payload.name
    inst.description = payload.description or ""
    if payload.enabled is not None:
        inst.enabled = payload.enabled

    if payload.device_ids is not None:
        # Unassign devices currently on this instance but not in the new list
        current_devices = db.query(models.Device).filter(
            models.Device.telegraf_instance_id == instance_id
        ).all()
        new_ids = set(payload.device_ids)
        for dev in current_devices:
            if dev.id not in new_ids:
                dev.telegraf_instance_id = None
        # Assign new devices
        for dev_id in payload.device_ids:
            dev = db.query(models.Device).filter(models.Device.id == dev_id).first()
            if dev:
                dev.telegraf_instance_id = instance_id

    db.commit()
    db.refresh(inst)
    return _instance_out(inst, db)


@router.delete("/{instance_id}")
def delete_instance(instance_id: int, db: Session = Depends(get_db)):
    inst = db.query(models.TelegrafInstance).filter(
        models.TelegrafInstance.id == instance_id
    ).first()
    if not inst:
        raise HTTPException(status_code=404, detail="Telegraf instance not found")

    # Unassign devices
    devices = db.query(models.Device).filter(
        models.Device.telegraf_instance_id == instance_id
    ).all()
    for dev in devices:
        dev.telegraf_instance_id = None

    db.delete(inst)
    db.commit()
    return {"ok": True}


@router.get("/{instance_id}/config", response_class=PlainTextResponse)
def get_instance_config(instance_id: int, db: Session = Depends(get_db)):
    inst = _load_instance(db, instance_id)
    system_cfg = _get_config_dict(db)
    default_influx = _get_default_influxdb(db)
    default_sc = _get_default_scan_class(db)
    devices = [d for d in inst.devices if d.enabled]
    content = telegraf_generator.generate_config(
        devices, system_cfg, default_influx,
        scan_cache=_scan_cache, default_scan_class=default_sc,
    )
    return PlainTextResponse(content=content)


@router.get("/{instance_id}/config/download")
def download_instance_config(instance_id: int, db: Session = Depends(get_db)):
    inst = _load_instance(db, instance_id)
    system_cfg = _get_config_dict(db)
    default_influx = _get_default_influxdb(db)
    default_sc = _get_default_scan_class(db)
    devices = [d for d in inst.devices if d.enabled]
    content = telegraf_generator.generate_config(
        devices, system_cfg, default_influx,
        scan_cache=_scan_cache, default_scan_class=default_sc,
    )
    filename = f"telegraf-{inst.name}.conf"
    return Response(
        content=content,
        media_type="text/plain",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/configs", response_model=list[schemas.TelegrafInstanceConfigOut])
def get_all_configs(db: Session = Depends(get_db)):
    """Get generated configs for all instances (for multi-tab view)."""
    instances = db.query(models.TelegrafInstance).options(
        joinedload(models.TelegrafInstance.devices)
        .joinedload(models.Device.tags)
        .joinedload(models.Tag.scan_class),
        joinedload(models.TelegrafInstance.devices)
        .joinedload(models.Device.node_includes)
        .joinedload(models.NodeInclude.scan_class),
        joinedload(models.TelegrafInstance.devices)
        .joinedload(models.Device.influxdb_config),
    ).filter(models.TelegrafInstance.enabled == True).order_by(
        models.TelegrafInstance.name
    ).all()

    system_cfg = _get_config_dict(db)
    default_influx = _get_default_influxdb(db)
    default_sc = _get_default_scan_class(db)
    configs = telegraf_generator.generate_instance_configs(
        instances, system_cfg, default_influx,
        scan_cache=_scan_cache, default_scan_class=default_sc,
    )

    result = []
    for inst_id, data in configs.items():
        result.append(schemas.TelegrafInstanceConfigOut(
            instance_id=inst_id,
            instance_name=data["name"],
            config=data["config"],
            device_count=data["device_count"],
            tag_count=data["tag_count"],
        ))
    return result


@router.post("/auto-create")
def auto_create_instances(db: Session = Depends(get_db)):
    """Create one TelegrafInstance per device."""
    devices = db.query(models.Device).filter(models.Device.enabled == True).all()
    created = 0
    for dev in devices:
        safe_name = f"telegraf-{dev.name.lower().replace(' ', '-')}"
        existing = db.query(models.TelegrafInstance).filter(
            models.TelegrafInstance.name == safe_name
        ).first()
        if existing:
            dev.telegraf_instance_id = existing.id
            continue
        inst = models.TelegrafInstance(
            name=safe_name,
            description=f"Auto-created for device: {dev.name}",
        )
        db.add(inst)
        db.flush()
        dev.telegraf_instance_id = inst.id
        created += 1

    db.commit()
    return {"created": created, "total_devices": len(devices)}


@router.get("/suggest-splits", response_model=list[schemas.SplitSuggestion])
def get_split_suggestions(db: Session = Depends(get_db)):
    """Get suggestions for splitting devices across instances."""
    devices = db.query(models.Device).options(
        joinedload(models.Device.tags).joinedload(models.Tag.scan_class),
    ).filter(models.Device.enabled == True).all()

    suggestions = telegraf_generator.suggest_splits(devices)
    return [schemas.SplitSuggestion(**s) for s in suggestions]

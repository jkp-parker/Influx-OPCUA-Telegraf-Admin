from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models
import schemas

router = APIRouter(prefix="/scan-classes", tags=["scan-classes"])


@router.get("", response_model=list[schemas.ScanClassOut])
def list_scan_classes(db: Session = Depends(get_db)):
    items = db.query(models.ScanClass).order_by(models.ScanClass.interval_ms).all()
    result = []
    for item in items:
        tag_count = db.query(models.Tag).filter(models.Tag.scan_class_id == item.id).count()
        out = schemas.ScanClassOut.model_validate(item)
        out.tag_count = tag_count
        result.append(out)
    return result


@router.post("", response_model=schemas.ScanClassOut)
def create_scan_class(payload: schemas.ScanClassCreate, db: Session = Depends(get_db)):
    existing = db.query(models.ScanClass).filter(models.ScanClass.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Scan class name already exists")
    sc = models.ScanClass(**payload.model_dump())
    db.add(sc)
    db.commit()
    db.refresh(sc)
    out = schemas.ScanClassOut.model_validate(sc)
    out.tag_count = 0
    return out


@router.get("/{sc_id}", response_model=schemas.ScanClassOut)
def get_scan_class(sc_id: int, db: Session = Depends(get_db)):
    sc = db.query(models.ScanClass).filter(models.ScanClass.id == sc_id).first()
    if not sc:
        raise HTTPException(status_code=404, detail="Scan class not found")
    tag_count = db.query(models.Tag).filter(models.Tag.scan_class_id == sc_id).count()
    out = schemas.ScanClassOut.model_validate(sc)
    out.tag_count = tag_count
    return out


@router.put("/{sc_id}", response_model=schemas.ScanClassOut)
def update_scan_class(sc_id: int, payload: schemas.ScanClassUpdate, db: Session = Depends(get_db)):
    sc = db.query(models.ScanClass).filter(models.ScanClass.id == sc_id).first()
    if not sc:
        raise HTTPException(status_code=404, detail="Scan class not found")
    existing = db.query(models.ScanClass).filter(
        models.ScanClass.name == payload.name,
        models.ScanClass.id != sc_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Name already in use")
    for field, value in payload.model_dump().items():
        setattr(sc, field, value)
    db.commit()
    db.refresh(sc)
    tag_count = db.query(models.Tag).filter(models.Tag.scan_class_id == sc_id).count()
    out = schemas.ScanClassOut.model_validate(sc)
    out.tag_count = tag_count
    return out


@router.delete("/{sc_id}")
def delete_scan_class(sc_id: int, db: Session = Depends(get_db)):
    sc = db.query(models.ScanClass).filter(models.ScanClass.id == sc_id).first()
    if not sc:
        raise HTTPException(status_code=404, detail="Scan class not found")
    # Unassign tags
    db.query(models.Tag).filter(models.Tag.scan_class_id == sc_id).update({"scan_class_id": None})
    db.delete(sc)
    db.commit()
    return {"ok": True}


@router.post("/{sc_id}/set-default")
def set_default_scan_class(sc_id: int, db: Session = Depends(get_db)):
    sc = db.query(models.ScanClass).filter(models.ScanClass.id == sc_id).first()
    if not sc:
        raise HTTPException(status_code=404, detail="Scan class not found")
    # Clear existing default
    db.query(models.ScanClass).filter(models.ScanClass.is_default == True).update({"is_default": False})
    sc.is_default = True
    db.commit()
    return {"ok": True}


@router.post("/{sc_id}/clear-default")
def clear_default_scan_class(sc_id: int, db: Session = Depends(get_db)):
    sc = db.query(models.ScanClass).filter(models.ScanClass.id == sc_id).first()
    if not sc:
        raise HTTPException(status_code=404, detail="Scan class not found")
    sc.is_default = False
    db.commit()
    return {"ok": True}

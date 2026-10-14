"""Itinerary, checklist and places: simple per-trip CRUD."""
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import Access, editor, viewer
from app.models import ChecklistItem, ItineraryItem, Place
from app.schemas import ChecklistIn, ChecklistPatch, ItineraryIn, ItineraryOut, PlaceIn, PlaceOut

router = APIRouter(prefix="/trips/{trip_id}", tags=["content"])


def _get(db: Session, model, item_id: uuid.UUID, trip_id: uuid.UUID):
    obj = db.get(model, item_id)
    if not obj or obj.trip_id != trip_id:
        raise HTTPException(404, "Not found")
    return obj


# ---- itinerary ----
@router.get("/itinerary", response_model=list[ItineraryOut])
def list_itinerary(a: Access = Depends(viewer), db: Session = Depends(get_db)):
    return db.scalars(select(ItineraryItem).where(ItineraryItem.trip_id == a.trip.id)
                      .order_by(ItineraryItem.starts_at)).all()


@router.post("/itinerary", response_model=ItineraryOut, status_code=201)
def add_itinerary(body: ItineraryIn, a: Access = Depends(editor), db: Session = Depends(get_db)):
    item = ItineraryItem(trip_id=a.trip.id, **body.model_dump())
    db.add(item)
    db.commit()
    return item


@router.put("/itinerary/{item_id}", response_model=ItineraryOut)
def update_itinerary(item_id: uuid.UUID, body: ItineraryIn, a: Access = Depends(editor), db: Session = Depends(get_db)):
    item = _get(db, ItineraryItem, item_id, a.trip.id)
    for k, v in body.model_dump().items():
        setattr(item, k, v)
    db.commit()
    return item


@router.delete("/itinerary/{item_id}", status_code=204)
def delete_itinerary(item_id: uuid.UUID, a: Access = Depends(editor), db: Session = Depends(get_db)) -> None:
    db.delete(_get(db, ItineraryItem, item_id, a.trip.id))
    db.commit()


# ---- checklist ----
@router.get("/checklist")
def list_checklist(a: Access = Depends(viewer), db: Session = Depends(get_db)) -> list[dict]:
    rows = db.scalars(select(ChecklistItem).where(ChecklistItem.trip_id == a.trip.id)
                      .order_by(ChecklistItem.group_name, ChecklistItem.sort_order)).all()
    return [{"id": r.id, "group_name": r.group_name, "label": r.label, "done": r.done} for r in rows]


@router.post("/checklist", status_code=201)
def add_checklist(body: ChecklistIn, a: Access = Depends(editor), db: Session = Depends(get_db)) -> dict:
    n = len(db.scalars(select(ChecklistItem.id).where(ChecklistItem.trip_id == a.trip.id)).all())
    c = ChecklistItem(trip_id=a.trip.id, sort_order=n, **body.model_dump())
    db.add(c)
    db.commit()
    return {"id": c.id, "group_name": c.group_name, "label": c.label, "done": c.done}


@router.patch("/checklist/{item_id}")
def patch_checklist(item_id: uuid.UUID, body: ChecklistPatch, a: Access = Depends(editor), db: Session = Depends(get_db)) -> dict:
    c = _get(db, ChecklistItem, item_id, a.trip.id)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(c, k, v)
    db.commit()
    return {"id": c.id, "group_name": c.group_name, "label": c.label, "done": c.done}


@router.delete("/checklist/{item_id}", status_code=204)
def delete_checklist(item_id: uuid.UUID, a: Access = Depends(editor), db: Session = Depends(get_db)) -> None:
    db.delete(_get(db, ChecklistItem, item_id, a.trip.id))
    db.commit()


# ---- places (map) ----
@router.get("/places", response_model=list[PlaceOut])
def list_places(a: Access = Depends(viewer), db: Session = Depends(get_db)):
    return db.scalars(select(Place).where(Place.trip_id == a.trip.id)).all()


@router.post("/places", response_model=PlaceOut, status_code=201)
def add_place(body: PlaceIn, a: Access = Depends(editor), db: Session = Depends(get_db)):
    p = Place(trip_id=a.trip.id, **body.model_dump())
    db.add(p)
    db.commit()
    return p


@router.delete("/places/{place_id}", status_code=204)
def delete_place(place_id: uuid.UUID, a: Access = Depends(editor), db: Session = Depends(get_db)) -> None:
    db.delete(_get(db, Place, place_id, a.trip.id))
    db.commit()

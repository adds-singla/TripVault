import re
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import Settings, get_settings
from app.db import get_db
from app.models import (Document, Expense, ItineraryItem, Trip, TripInvite, TripMember, User)
from app.schemas import UserOut
from app.services.ledger import compute_balances

router = APIRouter()


def claim_invites(db: Session, user: User) -> None:
    for inv in db.scalars(select(TripInvite).where(TripInvite.email == user.email.lower())).all():
        if not db.get(TripMember, (inv.trip_id, user.id)):
            db.add(TripMember(trip_id=inv.trip_id, user_id=user.id, role=inv.role))
        db.delete(inv)
    db.commit()


@router.get("/health", tags=["meta"])
def health() -> dict:
    return {"status": "ok"}


@router.get("/auth/me", response_model=UserOut, tags=["auth"])
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> User:
    claim_invites(db, user)
    return user


class MockLogin(BaseModel):
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    name: str | None = None


@router.post("/auth/mock-login", response_model=UserOut, tags=["auth"])
def mock_login(body: MockLogin, db: Session = Depends(get_db), s: Settings = Depends(get_settings)) -> User:
    """Local dev only: sign in (or sign up) by email without a password."""
    if s.auth_mode != "mock" or s.app_env == "production":
        raise HTTPException(404, "Not found")
    email = body.email.lower()
    user = db.scalar(select(User).where(User.email == email))
    if not user:
        local = email.split("@")[0]
        user = User(id="mock-" + re.sub(r"[^a-z0-9]+", "-", local), email=email,
                    name=body.name or re.sub(r"[._-]+", " ", local).title())
        db.add(user)
        db.commit()
    claim_invites(db, user)
    return user


@router.get("/notifications", tags=["meta"])
def notifications(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    """Derived (not stored): money you owe, trips starting soon, upcoming itinerary."""
    out: list[dict] = []
    now = datetime.now(timezone.utc)
    trips = db.scalars(select(Trip).join(TripMember).where(TripMember.user_id == user.id)).all()
    for t in trips:
        net = compute_balances(db, t.id).get(user.id)
        if net is not None and net < 0:
            out.append({"kind": "owe", "text": f"You owe {abs(net)} {t.currency} in {t.name}", "trip_id": str(t.id)})
        if t.start_date and 0 <= (t.start_date - now.date()).days <= 14:
            out.append({"kind": "trip", "text": f"{t.name} starts in {(t.start_date - now.date()).days} days",
                        "trip_id": str(t.id)})
        soon = db.scalar(select(ItineraryItem).where(ItineraryItem.trip_id == t.id, ItineraryItem.starts_at >= now,
                                                     ItineraryItem.starts_at <= now + timedelta(hours=48))
                         .order_by(ItineraryItem.starts_at))
        if soon:
            out.append({"kind": "itinerary", "text": f"Next up in {t.name}: {soon.title}", "trip_id": str(t.id)})
    return out


@router.get("/search", tags=["meta"])
def search(q: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    """Global search across the caller's trips, itinerary, expenses and documents."""
    q = q.strip()
    if len(q) < 2:
        return []
    like = f"%{q}%"
    ids = [m.trip_id for m in db.scalars(select(TripMember).where(TripMember.user_id == user.id)).all()]
    res: list[dict] = []
    for t in db.scalars(select(Trip).where(Trip.id.in_(ids), or_(Trip.name.ilike(like), Trip.destination.ilike(like)))).all():
        res.append({"type": "Trip", "title": t.name, "subtitle": t.destination, "href": f"/trip/overview/?id={t.id}"})
    for i in db.scalars(select(ItineraryItem).where(ItineraryItem.trip_id.in_(ids), or_(
            ItineraryItem.title.ilike(like), ItineraryItem.confirmation_ref.ilike(like))).limit(8)).all():
        res.append({"type": "Itinerary", "title": i.title, "subtitle": i.confirmation_ref or i.location or "",
                    "href": f"/trip/itinerary/?id={i.trip_id}"})
    for e in db.scalars(select(Expense).where(Expense.trip_id.in_(ids), or_(
            Expense.merchant.ilike(like), Expense.description.ilike(like))).limit(8)).all():
        res.append({"type": "Expense", "title": e.merchant, "subtitle": f"{e.amount} {e.currency}",
                    "href": f"/trip/expenses/?id={e.trip_id}"})
    for d in db.scalars(select(Document).where(Document.trip_id.in_(ids), Document.name.ilike(like)).limit(8)).all():
        res.append({"type": "Document", "title": d.name, "subtitle": d.folder, "href": f"/trip/documents/?id={d.trip_id}"})
    return res


# ── Local-disk upload / download (dev only, no S3/MinIO needed) ───────────────
from fastapi import Request, Response
from fastapi.responses import FileResponse
from pathlib import Path
from app import storage as _storage


@router.put("/local-upload", tags=["dev"], include_in_schema=False)
async def local_upload(token: str, request: Request) -> dict:
    """Receives the raw file bytes the browser PUT to the fake presigned URL."""
    data = await request.body()
    try:
        _storage.save_local_upload(token, data)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    return {"ok": True}


@router.get("/local-download", tags=["dev"], include_in_schema=False)
def local_download(key: str) -> Response:
    p = _storage.LOCAL_ROOT / key
    if not p.exists():
        raise HTTPException(404, "File not found")
    return FileResponse(str(p))

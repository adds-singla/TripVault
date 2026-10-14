import uuid
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import get_db
from app.deps import Access, editor, owner, viewer
from app.models import ChecklistItem, Document, Expense, Trip, TripInvite, TripMember, User
from app.schemas import InviteIn, RolePatch, TripIn, TripPatch

router = APIRouter(prefix="/trips", tags=["trips"])


def trip_dict(db: Session, t: Trip, my_role: str) -> dict:
    members = db.execute(select(User, TripMember.role).join(TripMember, TripMember.user_id == User.id)
                         .where(TripMember.trip_id == t.id)).all()
    spent = db.scalar(select(func.coalesce(func.sum(Expense.amount), 0))
                      .where(Expense.trip_id == t.id, Expense.is_settlement.is_(False)))
    total = db.scalar(select(func.count()).select_from(ChecklistItem).where(ChecklistItem.trip_id == t.id))
    done = db.scalar(select(func.count()).select_from(ChecklistItem)
                     .where(ChecklistItem.trip_id == t.id, ChecklistItem.done.is_(True)))
    docs = db.scalar(select(func.count()).select_from(Document).where(Document.trip_id == t.id))
    return {"id": t.id, "name": t.name, "destination": t.destination, "currency": t.currency,
            "start_date": t.start_date, "end_date": t.end_date, "budget": t.budget, "my_role": my_role,
            "owner_id": t.owner_id, "total_spent": spent, "checklist_total": total, "checklist_done": done,
            "document_count": docs,
            "members": [{"id": u.id, "name": u.name, "email": u.email, "role": r} for u, r in members]}


@router.get("")
def list_trips(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    rows = db.execute(select(Trip, TripMember.role).join(TripMember, TripMember.trip_id == Trip.id)
                      .where(TripMember.user_id == user.id).order_by(Trip.start_date.desc().nullslast())).all()
    return [trip_dict(db, t, r) for t, r in rows]


@router.post("", status_code=201)
def create_trip(body: TripIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    if body.start_date and body.end_date and body.end_date < body.start_date:
        raise HTTPException(422, "End date must be after start date")
    t = Trip(**body.model_dump(), owner_id=user.id)
    db.add(t)
    db.flush()
    db.add(TripMember(trip_id=t.id, user_id=user.id, role="owner"))
    db.commit()
    return trip_dict(db, t, "owner")


@router.get("/{trip_id}")
def get_trip(a: Access = Depends(viewer), db: Session = Depends(get_db)) -> dict:
    return trip_dict(db, a.trip, a.member.role)


@router.patch("/{trip_id}")
def patch_trip(body: TripPatch, a: Access = Depends(editor), db: Session = Depends(get_db)) -> dict:
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(a.trip, k, v)
    db.commit()
    return trip_dict(db, a.trip, a.member.role)


@router.delete("/{trip_id}", status_code=204)
def delete_trip(a: Access = Depends(owner), db: Session = Depends(get_db)) -> None:
    from app.storage import delete_object
    for d in db.scalars(select(Document).where(Document.trip_id == a.trip.id)).all():
        delete_object(d.s3_key)
    db.delete(a.trip)
    db.commit()


# ---- members & invites ----
@router.get("/{trip_id}/members")
def list_members(a: Access = Depends(viewer), db: Session = Depends(get_db)) -> dict:
    t = trip_dict(db, a.trip, a.member.role)
    invites = db.scalars(select(TripInvite).where(TripInvite.trip_id == a.trip.id)).all()
    return {"members": t["members"],
            "invites": [{"id": i.id, "email": i.email, "role": i.role} for i in invites]}


@router.post("/{trip_id}/members", status_code=201)
def invite(body: InviteIn, a: Access = Depends(owner), db: Session = Depends(get_db)) -> dict:
    email = body.email.lower()
    user = db.scalar(select(User).where(User.email == email))
    if user and db.get(TripMember, (a.trip.id, user.id)):
        raise HTTPException(409, "Already a member")
    if user:  # known user: add right away
        db.add(TripMember(trip_id=a.trip.id, user_id=user.id, role=body.role))
        db.commit()
        return {"status": "added", "email": email}
    if db.scalar(select(TripInvite).where(TripInvite.trip_id == a.trip.id, TripInvite.email == email)):
        raise HTTPException(409, "Already invited")
    db.add(TripInvite(trip_id=a.trip.id, email=email, role=body.role, invited_by=a.user.id))
    db.commit()
    return {"status": "invited", "email": email}


@router.patch("/{trip_id}/members/{user_id}")
def change_role(user_id: str, body: RolePatch, a: Access = Depends(owner), db: Session = Depends(get_db)) -> dict:
    m = db.get(TripMember, (a.trip.id, user_id))
    if not m:
        raise HTTPException(404, "Member not found")
    if m.role == "owner":
        raise HTTPException(400, "Cannot change the owner's role")
    m.role = body.role
    db.commit()
    return {"user_id": user_id, "role": m.role}


@router.delete("/{trip_id}/members/{user_id}", status_code=204)
def remove_member(user_id: str, a: Access = Depends(viewer), db: Session = Depends(get_db)) -> None:
    m = db.get(TripMember, (a.trip.id, user_id))
    if not m:
        raise HTTPException(404, "Member not found")
    if m.role == "owner":
        raise HTTPException(400, "The owner cannot be removed")
    if user_id != a.user.id and a.member.role != "owner":
        raise HTTPException(403, "Only the owner can remove others")
    db.delete(m)
    db.commit()


@router.delete("/{trip_id}/invites/{invite_id}", status_code=204)
def cancel_invite(invite_id: uuid.UUID, a: Access = Depends(owner), db: Session = Depends(get_db)) -> None:
    inv = db.get(TripInvite, invite_id)
    if not inv or inv.trip_id != a.trip.id:
        raise HTTPException(404, "Invite not found")
    db.delete(inv)
    db.commit()

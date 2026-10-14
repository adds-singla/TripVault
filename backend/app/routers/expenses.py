"""Expenses, receipt scanning, balances, settle-up and the trip dashboard."""
import uuid
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import storage
from app.db import get_db
from app.deps import Access, editor, viewer
from app.models import (ChecklistItem, Document, Expense, ExpenseSplit, ItineraryItem, Photo, Place, TripMember, User)
from app.schemas import ExpenseIn, ScanIn, SettleIn
from app.services.ledger import compute_balances
from app.services.settle import minimize_transactions
from app.services.splits import split_equal

router = APIRouter(prefix="/trips/{trip_id}", tags=["expenses"])
CENT = Decimal("0.01")


def _members(db: Session, trip_id) -> dict[str, User]:
    return {u.id: u for u in db.scalars(select(User).join(TripMember, TripMember.user_id == User.id)
                                        .where(TripMember.trip_id == trip_id))}


def _expense_dict(e: Expense, users: dict[str, User]) -> dict:
    others = [s for s in e.splits if s.user_id != e.payer_id]
    pending = sum(1 for s in others if not s.settled)
    payer = users.get(e.payer_id)
    return {"id": e.id, "merchant": e.merchant, "description": e.description, "amount": e.amount,
            "currency": e.currency, "category": e.category, "spent_on": e.spent_on, "is_settlement": e.is_settlement,
            "payer": {"id": e.payer_id, "name": payer.name if payer else "Former member"},
            "split_count": len(e.splits), "per_person": (e.amount / len(e.splits)).quantize(CENT) if e.splits else e.amount,
            "has_receipt": bool(e.receipt_s3_key), "status": "pending" if pending else "settled", "pending_count": pending,
            "shares": {s.user_id: s.share_amount for s in e.splits}}


@router.get("/expenses")
def list_expenses(category: str | None = None, a: Access = Depends(viewer), db: Session = Depends(get_db)) -> list[dict]:
    q = select(Expense).where(Expense.trip_id == a.trip.id).order_by(Expense.spent_on.desc(), Expense.created_at.desc())
    if category:
        q = q.where(Expense.category == category)
    users = _members(db, a.trip.id)
    return [_expense_dict(e, users) for e in db.scalars(q).all()]


@router.post("/expenses", status_code=201)
def create_expense(body: ExpenseIn, a: Access = Depends(editor), db: Session = Depends(get_db)) -> dict:
    users = _members(db, a.trip.id)
    payer = body.payer_id or a.user.id
    if payer not in users:
        raise HTTPException(422, "Payer must be a trip member")
    if body.split_mode == "custom":
        if not body.shares:
            raise HTTPException(422, "Custom split needs shares")
        shares = {u: v.quantize(CENT) for u, v in body.shares.items() if v > 0}
        if abs(sum(shares.values()) - body.amount) > CENT:
            raise HTTPException(422, "Custom shares must add up to the total amount")
    else:
        shares = split_equal(body.amount, body.participants or list(users))
    if any(u not in users for u in shares):
        raise HTTPException(422, "All participants must be trip members")
    if body.receipt_s3_key and not body.receipt_s3_key.startswith(f"trips/{a.trip.id}/receipts/"):
        raise HTTPException(400, "Invalid receipt key")
    e = Expense(trip_id=a.trip.id, payer_id=payer, merchant=body.merchant, description=body.description,
                amount=body.amount, currency=body.currency or a.trip.currency, category=body.category,
                spent_on=body.spent_on, receipt_s3_key=body.receipt_s3_key, image_hash=body.image_hash,
                ocr_raw_text=body.ocr_raw_text)
    for uid, share in shares.items():
        e.splits.append(ExpenseSplit(user_id=uid, share_amount=share, settled=(uid == payer)))
    db.add(e)
    db.commit()
    return _expense_dict(e, users)


@router.delete("/expenses/{expense_id}", status_code=204)
def delete_expense(expense_id: uuid.UUID, a: Access = Depends(editor), db: Session = Depends(get_db)) -> None:
    e = db.get(Expense, expense_id)
    if not e or e.trip_id != a.trip.id:
        raise HTTPException(404, "Expense not found")
    if e.receipt_s3_key:
        storage.delete_object(e.receipt_s3_key)
    db.delete(e)
    db.commit()


@router.post("/expenses/scan")
def scan_receipt(body: ScanIn, a: Access = Depends(editor), db: Session = Depends(get_db)) -> dict:
    """Download the uploaded receipt from S3, run OCR + classification + duplicate detection."""
    from app.ml import ocr, pipeline
    if not body.s3_key.startswith(f"trips/{a.trip.id}/receipts/") or ".." in body.s3_key:
        raise HTTPException(400, "Invalid receipt key for this trip")
    if not storage.head_object(body.s3_key):
        raise HTTPException(400, "Receipt not found in storage")
    try:
        result = pipeline.analyze_receipt(db, a.trip.id, storage.get_bytes(body.s3_key))
    except ocr.OCRUnavailable as e:
        raise HTTPException(503, str(e))
    except ValueError as e:
        raise HTTPException(422, str(e))
    result["s3_key"] = body.s3_key
    result["currency"] = result["currency"] or a.trip.currency
    return result


# ---- balances & settle-up ----
def _balances_payload(db: Session, trip_id) -> dict:
    users = _members(db, trip_id)
    net = compute_balances(db, trip_id)
    name = lambda u: users[u].name if u in users else "Former member"
    return {"net": [{"user_id": u, "name": name(u), "amount": net.get(u, Decimal(0))} for u in users],
            "transactions": [{"from_user": f, "from_name": name(f), "to_user": t, "to_name": name(t), "amount": amt}
                             for f, t, amt in minimize_transactions(net)]}


@router.get("/balances")
def balances(a: Access = Depends(viewer), db: Session = Depends(get_db)) -> dict:
    return _balances_payload(db, a.trip.id)


@router.post("/settle")
def settle(body: SettleIn, a: Access = Depends(editor), db: Session = Depends(get_db)) -> dict:
    """Record that from_user paid to_user `amount`. Clears direct splits first (oldest first);
    any remainder (from a simplified multi-person route) is booked as a settlement adjustment."""
    users = _members(db, a.trip.id)
    if body.from_user not in users or body.to_user not in users or body.from_user == body.to_user:
        raise HTTPException(422, "Invalid members")
    net = compute_balances(db, a.trip.id)
    limit = min(-net.get(body.from_user, Decimal(0)), net.get(body.to_user, Decimal(0)))
    if body.amount > limit + CENT:
        raise HTTPException(422, f"Amount exceeds what is owed ({max(limit, Decimal(0))})")
    now, remaining = datetime.now(timezone.utc), body.amount
    direct = db.scalars(select(ExpenseSplit).join(Expense, Expense.id == ExpenseSplit.expense_id)
                        .where(Expense.trip_id == a.trip.id, ExpenseSplit.user_id == body.from_user,
                               ExpenseSplit.settled.is_(False), Expense.payer_id == body.to_user)
                        .order_by(Expense.spent_on)).all()
    for sp in direct:
        if remaining <= 0:
            break
        if sp.share_amount <= remaining:
            sp.settled, sp.settled_at, remaining = True, now, remaining - sp.share_amount
        else:
            db.add(ExpenseSplit(expense_id=sp.expense_id, user_id=sp.user_id, share_amount=remaining,
                                settled=True, settled_at=now))
            sp.share_amount -= remaining
            remaining = Decimal(0)
    if remaining > 0:
        adj = Expense(trip_id=a.trip.id, payer_id=body.from_user, merchant="Settlement payment", amount=remaining,
                      currency=a.trip.currency, category="Other", spent_on=date.today(), is_settlement=True,
                      description=f"{users[body.from_user].name} paid {users[body.to_user].name}")
        adj.splits.append(ExpenseSplit(user_id=body.to_user, share_amount=remaining, settled=False))
        db.add(adj)
    db.commit()
    return _balances_payload(db, a.trip.id)


# ---- dashboard ----
@router.get("/dashboard")
def dashboard(a: Access = Depends(viewer), db: Session = Depends(get_db)) -> dict:
    trip, uid = a.trip, a.user.id
    users = _members(db, trip.id)
    spend = [e for e in db.scalars(select(Expense).where(Expense.trip_id == trip.id, Expense.is_settlement.is_(False))).all()]
    total = sum((e.amount for e in spend), Decimal(0))
    by_cat: dict[str, Decimal] = defaultdict(lambda: Decimal(0))
    by_day: dict[date, Decimal] = defaultdict(lambda: Decimal(0))
    for e in spend:
        by_cat[e.category] += e.amount
        by_day[e.spent_on] += e.amount
    categories = sorted(({"category": c, "amount": v, "percent": round(float(v / total * 100), 1) if total else 0}
                         for c, v in by_cat.items()), key=lambda x: -x["amount"])
    daily = [{"date": d, "amount": v} for d, v in sorted(by_day.items())]
    net = compute_balances(db, trip.id).get(uid, Decimal(0))
    my_share = sum((s.share_amount for e in spend for s in e.splits if s.user_id == uid), Decimal(0))

    # smart recommendations
    today = date.today()
    days_total = ((trip.end_date - trip.start_date).days + 1) if trip.start_date and trip.end_date else None
    days_left = None
    if trip.end_date:
        days_left = max((trip.end_date - max(today, trip.start_date or today)).days + 1, 1)
    spend_days = len(by_day)
    tips: list[str] = []
    suggested = None
    if trip.budget:
        remaining = trip.budget - total
        suggested = (remaining / days_left).quantize(CENT) if days_left and remaining > 0 else Decimal(0)
        if remaining < 0:
            tips.append(f"You're {abs(remaining):.2f} {trip.currency} over budget.")
        elif total / trip.budget > Decimal("0.8"):
            tips.append("You've used over 80% of the budget. Consider cheaper options for the remaining days.")
    if categories and categories[0]["percent"] > 40:
        tips.append(f"{categories[0]['category']} is {categories[0]['percent']}% of spending; check for savings there.")
    if spend_days and total:
        tips.append(f"Average spend on active days: {(total / spend_days):.2f} {trip.currency}.")
    if not spend:
        tips.append("No expenses yet. Scan a receipt or add one to see insights.")

    now = datetime.now(timezone.utc)
    items = db.scalars(select(ItineraryItem).where(ItineraryItem.trip_id == trip.id).order_by(ItineraryItem.starts_at)).all()
    naive = lambda d: d.replace(tzinfo=None) if d.tzinfo is None else d.astimezone(timezone.utc).replace(tzinfo=None)
    upcoming = next((i for i in items if naive(i.starts_at) >= now.replace(tzinfo=None)), None)
    nm = upcoming or (items[0] if items else None)
    lodging = next((p for p in db.scalars(select(Place).where(Place.trip_id == trip.id, Place.kind == "hotel"))), None)
    cl = db.scalars(select(ChecklistItem).where(ChecklistItem.trip_id == trip.id).order_by(ChecklistItem.done, ChecklistItem.sort_order)).all()
    docs = db.scalars(select(Document).where(Document.trip_id == trip.id).order_by(Document.created_at.desc())).all()
    return {
        "currency": trip.currency, "budget": trip.budget,
        "kpis": {"total_spent": total, "per_person": (total / max(len(users), 1)).quantize(CENT), "my_share": my_share,
                 "you_owe": abs(net) if net < 0 else Decimal(0), "owed_to_you": net if net > 0 else Decimal(0),
                 "expense_count": len(spend), "members": len(users),
                 "budget_used_percent": round(float(total / trip.budget * 100), 1) if trip.budget else None},
        "categories": categories, "daily": daily,
        "recommendations": {"suggested_daily_budget": suggested, "days_left": days_left, "days_total": days_total,
                            "tips": tips},
        "counts": {"itinerary": len(items), "documents": len(docs), "expenses": len(spend),
                   "checklist_done": sum(c.done for c in cl), "checklist_total": len(cl),
                   "places": len(db.scalars(select(Place.id).where(Place.trip_id == trip.id)).all()),
                   "photos": len(db.scalars(select(Photo.id).where(Photo.trip_id == trip.id)).all())},
        "next_milestone": ({"id": nm.id, "kind": nm.kind, "title": nm.title, "location": nm.location, "starts_at": nm.starts_at,
                            "confirmation_ref": nm.confirmation_ref, "notes": nm.notes} if nm else None),
        "lodging": ({"name": lodging.name, "address": lodging.address} if lodging else None),
        "checklist_preview": [{"id": c.id, "label": c.label, "done": c.done} for c in cl[:4]],
        "recent_documents": [{"id": d.id, "name": d.name, "folder": d.folder, "size": d.size} for d in docs[:2]],
    }

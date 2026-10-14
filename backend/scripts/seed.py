"""Idempotent seed: demo users + the 'Singapore Trip' with sample data.
Run: python -m scripts.seed
"""
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import select

from app.db import SessionLocal
from app.models import (ChecklistItem, Expense, ExpenseSplit, ItineraryItem, Place, Trip,
                        TripMember, User)

USERS = [("mock-elena", "elena.vance@tripvault.io", "Elena Vance"),
         ("mock-aman", "aman.k@tripvault.io", "Aman K."),
         ("mock-david", "david.m@tripvault.io", "David M."),
         ("mock-marcus", "marcus.lin@tripvault.io", "Marcus Lin")]

# (merchant, description, amount, category, date, payer)
EXPENSES = [
    ("Jumbo Seafood Clarke Quay", "Chilli crab & dinner banquet", "184.50", "Food", date(2026, 10, 15), "mock-elena"),
    ("Marina Bay Sands Hotel", "Deluxe Tower Suite, 3 nights", "1026.00", "Accommodation", date(2026, 10, 14), "mock-david"),
    ("Singapore Airlines", "SQ 321 baggage add-on", "240.00", "Transport", date(2026, 10, 13), "mock-aman"),
    ("Gardens by the Bay", "Avatar Experience + Supertree pass", "140.00", "Activities", date(2026, 10, 16), "mock-elena"),
]
SETTLED_MERCHANTS = {"Jumbo Seafood Clarke Quay", "Marina Bay Sands Hotel", "Gardens by the Bay"}

CHECKLIST = [("Documents", "Passport & visa copies", True), ("Documents", "Travel medical policy", True),
             ("Electronics", "Universal power adapter", True), ("Electronics", "Portable charger", False),
             ("Clothing", "Light raincoat / umbrella", False), ("Clothing", "Comfortable walking shoes", False),
             ("Health", "Sunscreen & insect repellent", False)]

PLACES = [("Marina Bay Sands Hotel", "hotel", 1.2834, 103.8607, "10 Bayfront Ave"),
          ("Gardens by the Bay", "attraction", 1.2816, 103.8636, "18 Marina Gardens Dr"),
          ("Jumbo Seafood Clarke Quay", "food", 1.2906, 103.8465, "30 Merchant Rd"),
          ("Singapore Botanic Gardens", "attraction", 1.3138, 103.8159, "1 Cluny Rd")]


def run() -> None:
    with SessionLocal() as db:
        if db.scalar(select(Trip).where(Trip.name == "Singapore Trip")):
            print("Seed already applied.")
            return
        for uid, email, name in USERS:
            if not db.get(User, uid):
                db.add(User(id=uid, email=email, name=name))
        db.flush()

        trip = Trip(id=uuid.uuid4(), name="Singapore Trip", destination="Singapore", currency="USD",
                    start_date=date(2026, 10, 14), end_date=date(2026, 10, 21),
                    budget=Decimal("5000"), owner_id="mock-elena")
        db.add(trip)
        db.flush()
        for uid, _, _ in USERS:
            db.add(TripMember(trip_id=trip.id, user_id=uid, role="owner" if uid == "mock-elena" else "editor"))

        tz = timezone.utc
        db.add_all([
            ItineraryItem(trip_id=trip.id, kind="flight", title="SQ 321 LHR → SIN", location="Heathrow T2",
                          starts_at=datetime(2026, 10, 14, 20, 50, tzinfo=tz), confirmation_ref="TRP984"),
            ItineraryItem(trip_id=trip.id, kind="stay", title="Marina Bay Sands Hotel check-in",
                          location="10 Bayfront Ave", starts_at=datetime(2026, 10, 15, 15, 0, tzinfo=tz)),
            ItineraryItem(trip_id=trip.id, kind="dinner", title="Dinner at Jumbo Seafood",
                          location="Clarke Quay", starts_at=datetime(2026, 10, 15, 19, 30, tzinfo=tz)),
            ItineraryItem(trip_id=trip.id, kind="activity", title="Gardens by the Bay",
                          location="Supertree Grove", starts_at=datetime(2026, 10, 16, 10, 0, tzinfo=tz)),
        ])
        db.add_all([ChecklistItem(trip_id=trip.id, group_name=g, label=l, done=d, sort_order=i)
                    for i, (g, l, d) in enumerate(CHECKLIST)])
        db.add_all([Place(trip_id=trip.id, name=n, kind=k, lat=la, lng=lo, address=a)
                    for n, k, la, lo, a in PLACES])

        member_ids = [u[0] for u in USERS]
        for merchant, desc, amt, cat, d, payer in EXPENSES:
            total = Decimal(amt)
            exp = Expense(trip_id=trip.id, payer_id=payer, merchant=merchant, description=desc,
                          amount=total, currency="USD", category=cat, spent_on=d)
            share = (total / len(member_ids)).quantize(Decimal("0.01"))
            for uid in member_ids:
                exp.splits.append(ExpenseSplit(user_id=uid, share_amount=share,
                                               settled=merchant in SETTLED_MERCHANTS or uid == payer))
            db.add(exp)
        db.commit()
        print("Seeded demo data (4 users, 'Singapore Trip').")


if __name__ == "__main__":
    run()

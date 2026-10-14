"""Authorization: every trip endpoint goes through trip_access(min_role)."""
import uuid
from dataclasses import dataclass
from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session
from app.auth import get_current_user
from app.db import get_db
from app.models import Trip, TripMember, User

RANK = {"viewer": 1, "editor": 2, "owner": 3}


@dataclass
class Access:
    trip: Trip
    member: TripMember
    user: User


def trip_access(min_role: str = "viewer"):
    def dep(trip_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Access:
        member = db.get(TripMember, (trip_id, user.id))
        trip = db.get(Trip, trip_id) if member else None
        if not member or not trip:
            raise HTTPException(404, "Trip not found")  # don't reveal existence to non-members
        if RANK[member.role] < RANK[min_role]:
            raise HTTPException(403, f"Requires {min_role} role")
        return Access(trip, member, user)
    return dep


viewer = trip_access("viewer")
editor = trip_access("editor")
owner = trip_access("owner")

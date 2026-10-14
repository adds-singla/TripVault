"""ORM models. Mirrors the Alembic initial migration."""
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (Boolean, CheckConstraint, Date, DateTime, Float, ForeignKey, Index,
                        Integer, Numeric, String, Text, Uuid, func)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

ROLES = ("owner", "editor", "viewer")
DOC_FOLDERS = ("Flights", "Hotels", "Tickets", "Passport", "Other")
CATEGORIES = ("Food", "Transport", "Accommodation", "Activities", "Shopping", "Other")


def _id() -> Mapped[uuid.UUID]:
    return mapped_column(Uuid, primary_key=True, default=uuid.uuid4)


def _now() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), server_default=func.now())


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(128), primary_key=True)  # Cognito sub
    email: Mapped[str] = mapped_column(String(320), unique=True)
    name: Mapped[str] = mapped_column(String(200), default="")
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = _now()


class Trip(Base):
    __tablename__ = "trips"
    id: Mapped[uuid.UUID] = _id()
    name: Mapped[str] = mapped_column(String(200))
    destination: Mapped[str] = mapped_column(String(200), default="")
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    budget: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    cover_s3_key: Mapped[str | None] = mapped_column(String(500))
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = _now()
    members: Mapped[list["TripMember"]] = relationship(back_populates="trip", cascade="all, delete-orphan")


class TripMember(Base):
    __tablename__ = "trip_members"
    __table_args__ = (CheckConstraint("role in ('owner','editor','viewer')", name="ck_member_role"),
                      Index("ix_trip_members_user_id", "user_id"))
    trip_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trips.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    role: Mapped[str] = mapped_column(String(10), default="viewer")
    joined_at: Mapped[datetime] = _now()
    trip: Mapped[Trip] = relationship(back_populates="members")
    user: Mapped[User] = relationship()


class ItineraryItem(Base):
    __tablename__ = "itinerary_items"
    id: Mapped[uuid.UUID] = _id()
    trip_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trips.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(20))  # flight | stay | dinner | transit | activity
    title: Mapped[str] = mapped_column(String(200))
    location: Mapped[str | None] = mapped_column(String(300))
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    confirmation_ref: Mapped[str | None] = mapped_column(String(50))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = _now()


class Document(Base):
    __tablename__ = "documents"
    id: Mapped[uuid.UUID] = _id()
    trip_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trips.id", ondelete="CASCADE"), index=True)
    uploader_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(300))
    s3_key: Mapped[str] = mapped_column(String(500), unique=True)
    folder: Mapped[str] = mapped_column(String(20), default="Other")
    size: Mapped[int] = mapped_column(Integer, default=0)
    content_type: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = _now()


class Expense(Base):
    __tablename__ = "expenses"
    __table_args__ = (Index("ix_expenses_trip_date", "trip_id", "spent_on"),)
    id: Mapped[uuid.UUID] = _id()
    trip_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trips.id", ondelete="CASCADE"), index=True)
    payer_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    merchant: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(String(300))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    category: Mapped[str] = mapped_column(String(20), default="Other")
    spent_on: Mapped[date] = mapped_column(Date)
    receipt_s3_key: Mapped[str | None] = mapped_column(String(500))
    image_hash: Mapped[str | None] = mapped_column(String(64), index=True)
    ocr_raw_text: Mapped[str | None] = mapped_column(Text)
    is_settlement: Mapped[bool] = mapped_column(Boolean, default=False)  # payment between members, not spend
    created_at: Mapped[datetime] = _now()
    splits: Mapped[list["ExpenseSplit"]] = relationship(back_populates="expense", cascade="all, delete-orphan")


class ExpenseSplit(Base):
    __tablename__ = "expense_splits"
    id: Mapped[uuid.UUID] = _id()
    expense_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("expenses.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    share_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    settled: Mapped[bool] = mapped_column(Boolean, default=False)
    settled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expense: Mapped[Expense] = relationship(back_populates="splits")


class ChecklistItem(Base):
    __tablename__ = "checklist_items"
    id: Mapped[uuid.UUID] = _id()
    trip_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trips.id", ondelete="CASCADE"), index=True)
    group_name: Mapped[str] = mapped_column(String(100), default="General")
    label: Mapped[str] = mapped_column(String(300))
    done: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class Place(Base):
    __tablename__ = "places"
    id: Mapped[uuid.UUID] = _id()
    trip_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trips.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    kind: Mapped[str] = mapped_column(String(20), default="attraction")  # hotel | attraction | food
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    address: Mapped[str | None] = mapped_column(String(300))
    notes: Mapped[str | None] = mapped_column(Text)


class Photo(Base):
    __tablename__ = "photos"
    id: Mapped[uuid.UUID] = _id()
    trip_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trips.id", ondelete="CASCADE"), index=True)
    uploader_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    s3_key: Mapped[str] = mapped_column(String(500), unique=True)
    caption: Mapped[str | None] = mapped_column(String(300))
    size: Mapped[int] = mapped_column(Integer, default=0)
    content_type: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = _now()


class TripInvite(Base):
    """Pending invite by email; claimed automatically when that email signs in."""
    __tablename__ = "trip_invites"
    __table_args__ = (CheckConstraint("role in ('editor','viewer')", name="ck_invite_role"),)
    id: Mapped[uuid.UUID] = _id()
    trip_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trips.id", ondelete="CASCADE"), index=True)
    email: Mapped[str] = mapped_column(String(320), index=True)
    role: Mapped[str] = mapped_column(String(10), default="viewer")
    invited_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = _now()

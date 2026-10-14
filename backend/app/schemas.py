"""Pydantic request/response models."""
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

Role = Literal["owner", "editor", "viewer"]
Category = Literal["Food", "Transport", "Accommodation", "Activities", "Shopping", "Other"]
Folder = Literal["Flights", "Hotels", "Tickets", "Passport", "Other"]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class UserOut(ORM):
    id: str
    email: str
    name: str
    avatar_url: str | None = None


class TripIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    destination: str = Field(default="", max_length=200)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    start_date: date | None = None
    end_date: date | None = None
    budget: Decimal | None = Field(default=None, ge=0)


class TripPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    destination: str | None = None
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    start_date: date | None = None
    end_date: date | None = None
    budget: Decimal | None = Field(default=None, ge=0)


class InviteIn(BaseModel):
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    role: Literal["editor", "viewer"] = "viewer"


class RolePatch(BaseModel):
    role: Literal["editor", "viewer"]


class ItineraryIn(BaseModel):
    kind: Literal["flight", "stay", "dinner", "transit", "activity"]
    title: str = Field(min_length=1, max_length=200)
    location: str | None = None
    starts_at: datetime
    ends_at: datetime | None = None
    confirmation_ref: str | None = Field(default=None, max_length=50)
    notes: str | None = None


class ItineraryOut(ItineraryIn, ORM):
    id: uuid.UUID


class PresignUploadIn(BaseModel):
    filename: str
    content_type: str
    size: int
    kind: Literal["documents", "receipts", "photos"] = "documents"


class DocumentIn(BaseModel):
    name: str = Field(min_length=1, max_length=300)
    s3_key: str
    folder: Folder = "Other"
    content_type: str
    size: int = 0


class DocumentOut(ORM):
    id: uuid.UUID
    name: str
    folder: str
    size: int
    content_type: str
    created_at: datetime
    uploader_id: str


class ExpenseIn(BaseModel):
    merchant: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=300)
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    category: Category = "Other"
    spent_on: date
    payer_id: str | None = None  # default: current user
    split_mode: Literal["equal", "custom"] = "equal"
    participants: list[str] | None = None  # equal split among these (default: all members)
    shares: dict[str, Decimal] | None = None  # custom split: user_id -> amount
    receipt_s3_key: str | None = None
    image_hash: str | None = None
    ocr_raw_text: str | None = None


class ScanIn(BaseModel):
    s3_key: str


class SettleIn(BaseModel):
    from_user: str
    to_user: str
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)


class ChecklistIn(BaseModel):
    group_name: str = Field(default="General", max_length=100)
    label: str = Field(min_length=1, max_length=300)
    done: bool = False


class ChecklistPatch(BaseModel):
    group_name: str | None = None
    label: str | None = None
    done: bool | None = None


class PlaceIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    kind: Literal["hotel", "attraction", "food"] = "attraction"
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    address: str | None = None
    notes: str | None = None


class PlaceOut(PlaceIn, ORM):
    id: uuid.UUID


class PhotoIn(BaseModel):
    s3_key: str
    caption: str | None = None
    content_type: str
    size: int = 0

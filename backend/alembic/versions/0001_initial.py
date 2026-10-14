"""initial schema

Revision ID: 0001
Revises:
"""
from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

NOW = sa.func.now()


def _pk():
    return sa.Column("id", sa.Uuid, primary_key=True)


def upgrade() -> None:
    op.create_table("users",
        sa.Column("id", sa.String(128), primary_key=True),
        sa.Column("email", sa.String(320), nullable=False, unique=True),
        sa.Column("name", sa.String(200), nullable=False, server_default=""),
        sa.Column("avatar_url", sa.String(500)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW))

    op.create_table("trips", _pk(),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("destination", sa.String(200), nullable=False, server_default=""),
        sa.Column("currency", sa.String(3), nullable=False, server_default="USD"),
        sa.Column("start_date", sa.Date()), sa.Column("end_date", sa.Date()),
        sa.Column("budget", sa.Numeric(12, 2)),
        sa.Column("cover_s3_key", sa.String(500)),
        sa.Column("owner_id", sa.String(128), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW))
    op.create_index("ix_trips_owner_id", "trips", ["owner_id"])

    op.create_table("trip_members",
        sa.Column("trip_id", sa.Uuid, sa.ForeignKey("trips.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("user_id", sa.String(128), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("role", sa.String(10), nullable=False, server_default="viewer"),
        sa.Column("joined_at", sa.DateTime(timezone=True), server_default=NOW),
        sa.CheckConstraint("role in ('owner','editor','viewer')", name="ck_member_role"))
    op.create_index("ix_trip_members_user_id", "trip_members", ["user_id"])

    op.create_table("itinerary_items", _pk(),
        sa.Column("trip_id", sa.Uuid, sa.ForeignKey("trips.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("location", sa.String(300)),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True)),
        sa.Column("confirmation_ref", sa.String(50)),
        sa.Column("notes", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW))
    op.create_index("ix_itinerary_items_trip_id", "itinerary_items", ["trip_id"])

    op.create_table("documents", _pk(),
        sa.Column("trip_id", sa.Uuid, sa.ForeignKey("trips.id", ondelete="CASCADE"), nullable=False),
        sa.Column("uploader_id", sa.String(128), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(300), nullable=False),
        sa.Column("s3_key", sa.String(500), nullable=False, unique=True),
        sa.Column("folder", sa.String(20), nullable=False, server_default="Other"),
        sa.Column("size", sa.Integer, nullable=False, server_default="0"),
        sa.Column("content_type", sa.String(100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW))
    op.create_index("ix_documents_trip_id", "documents", ["trip_id"])
    op.create_index("ix_documents_uploader_id", "documents", ["uploader_id"])

    op.create_table("expenses", _pk(),
        sa.Column("trip_id", sa.Uuid, sa.ForeignKey("trips.id", ondelete="CASCADE"), nullable=False),
        sa.Column("payer_id", sa.String(128), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("merchant", sa.String(200), nullable=False),
        sa.Column("description", sa.String(300)),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="USD"),
        sa.Column("category", sa.String(20), nullable=False, server_default="Other"),
        sa.Column("spent_on", sa.Date(), nullable=False),
        sa.Column("receipt_s3_key", sa.String(500)),
        sa.Column("image_hash", sa.String(64)),
        sa.Column("ocr_raw_text", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW))
    op.create_index("ix_expenses_trip_id", "expenses", ["trip_id"])
    op.create_index("ix_expenses_payer_id", "expenses", ["payer_id"])
    op.create_index("ix_expenses_trip_date", "expenses", ["trip_id", "spent_on"])
    op.create_index("ix_expenses_image_hash", "expenses", ["image_hash"])

    op.create_table("expense_splits", _pk(),
        sa.Column("expense_id", sa.Uuid, sa.ForeignKey("expenses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.String(128), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("share_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("settled", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("settled_at", sa.DateTime(timezone=True)))
    op.create_index("ix_expense_splits_expense_id", "expense_splits", ["expense_id"])
    op.create_index("ix_expense_splits_user_id", "expense_splits", ["user_id"])

    op.create_table("checklist_items", _pk(),
        sa.Column("trip_id", sa.Uuid, sa.ForeignKey("trips.id", ondelete="CASCADE"), nullable=False),
        sa.Column("group_name", sa.String(100), nullable=False, server_default="General"),
        sa.Column("label", sa.String(300), nullable=False),
        sa.Column("done", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"))
    op.create_index("ix_checklist_items_trip_id", "checklist_items", ["trip_id"])

    op.create_table("places", _pk(),
        sa.Column("trip_id", sa.Uuid, sa.ForeignKey("trips.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False, server_default="attraction"),
        sa.Column("lat", sa.Float, nullable=False), sa.Column("lng", sa.Float, nullable=False),
        sa.Column("address", sa.String(300)), sa.Column("notes", sa.Text()))
    op.create_index("ix_places_trip_id", "places", ["trip_id"])

    op.create_table("photos", _pk(),
        sa.Column("trip_id", sa.Uuid, sa.ForeignKey("trips.id", ondelete="CASCADE"), nullable=False),
        sa.Column("uploader_id", sa.String(128), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("s3_key", sa.String(500), nullable=False, unique=True),
        sa.Column("caption", sa.String(300)),
        sa.Column("size", sa.Integer, nullable=False, server_default="0"),
        sa.Column("content_type", sa.String(100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW))
    op.create_index("ix_photos_trip_id", "photos", ["trip_id"])
    op.create_index("ix_photos_uploader_id", "photos", ["uploader_id"])


def downgrade() -> None:
    for t in ("photos", "places", "checklist_items", "expense_splits", "expenses", "documents",
              "itinerary_items", "trip_members", "trips", "users"):
        op.drop_table(t)

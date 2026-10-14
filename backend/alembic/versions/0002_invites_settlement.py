"""trip invites + expenses.is_settlement

Revision ID: 0002
Revises: 0001
"""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("expenses", sa.Column("is_settlement", sa.Boolean, nullable=False, server_default=sa.false()))
    op.create_table("trip_invites",
        sa.Column("id", sa.Uuid, primary_key=True),
        sa.Column("trip_id", sa.Uuid, sa.ForeignKey("trips.id", ondelete="CASCADE"), nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("role", sa.String(10), nullable=False, server_default="viewer"),
        sa.Column("invited_by", sa.String(128), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("role in ('editor','viewer')", name="ck_invite_role"))
    op.create_index("ix_trip_invites_trip_id", "trip_invites", ["trip_id"])
    op.create_index("ix_trip_invites_email", "trip_invites", ["email"])


def downgrade() -> None:
    op.drop_table("trip_invites")
    with op.batch_alter_table("expenses") as b:
        b.drop_column("is_settlement")

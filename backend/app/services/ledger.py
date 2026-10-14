"""Balance computation from unsettled expense splits."""
from collections import defaultdict
from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models import Expense, ExpenseSplit


def compute_balances(db: Session, trip_id) -> dict[str, Decimal]:
    rows = db.execute(select(ExpenseSplit.user_id, ExpenseSplit.share_amount, Expense.payer_id)
                      .join(Expense, Expense.id == ExpenseSplit.expense_id)
                      .where(Expense.trip_id == trip_id, ExpenseSplit.settled.is_(False))).all()
    net: dict[str, Decimal] = defaultdict(lambda: Decimal(0))
    for user_id, share, payer_id in rows:
        if user_id == payer_id:
            continue  # you don't owe yourself
        net[user_id] -= share
        net[payer_id] += share
    return dict(net)

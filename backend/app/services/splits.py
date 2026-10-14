"""Money splitting helpers (all Decimal, exact to the cent)."""
from decimal import ROUND_DOWN, Decimal

CENT = Decimal("0.01")


def split_equal(amount: Decimal, user_ids: list[str]) -> dict[str, Decimal]:
    """Split amount equally; leftover cents go to the first users so shares sum exactly to amount."""
    if not user_ids:
        raise ValueError("Need at least one participant")
    n = len(user_ids)
    base = (amount / n).quantize(CENT, rounding=ROUND_DOWN)
    extra_cents = int((amount - base * n) / CENT)
    return {u: base + (CENT if i < extra_cents else Decimal(0)) for i, u in enumerate(user_ids)}

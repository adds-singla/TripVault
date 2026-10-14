"""Settle-up: turn net balances into a small set of payments.

net[user] > 0 means the user is owed money, < 0 means the user owes. Greedy matching of the
largest debtor with the largest creditor settles everyone in at most (n - 1) payments, and every
payment fully clears at least one person. (Finding the true minimum is NP-hard; this is the
standard, near-optimal approach used by expense-splitting apps.)
"""
from decimal import Decimal

CENT = Decimal("0.01")


def minimize_transactions(net: dict[str, Decimal]) -> list[tuple[str, str, Decimal]]:
    creditors = sorted(([u, a] for u, a in net.items() if a >= CENT), key=lambda x: (-x[1], x[0]))
    debtors = sorted(([u, -a] for u, a in net.items() if a <= -CENT), key=lambda x: (-x[1], x[0]))
    out: list[tuple[str, str, Decimal]] = []
    while creditors and debtors:
        creditors.sort(key=lambda x: (-x[1], x[0]))
        debtors.sort(key=lambda x: (-x[1], x[0]))
        c, d = creditors[0], debtors[0]
        amt = min(c[1], d[1])
        out.append((d[0], c[0], amt))
        c[1] -= amt
        d[1] -= amt
        if c[1] < CENT:
            creditors.pop(0)
        if d[1] < CENT:
            debtors.pop(0)
    return out

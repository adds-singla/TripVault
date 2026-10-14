"""Duplicate receipt detection: perceptual image hash + fuzzy (amount, date, merchant) match."""
from __future__ import annotations
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from difflib import SequenceMatcher

HASH_DISTANCE = 6        # max Hamming distance between 64-bit pHashes to call images the same
MERCHANT_SIMILARITY = 0.75


def image_hash(image_bytes: bytes) -> str:
    import io
    import imagehash
    from PIL import Image
    return str(imagehash.phash(Image.open(io.BytesIO(image_bytes))))


def hash_distance(a: str, b: str) -> int:
    import imagehash
    return imagehash.hex_to_hash(a) - imagehash.hex_to_hash(b)


def merchant_similarity(a: str, b: str) -> float:
    """Fuzzy name match. OCR often captures only the first part of a name ("Jumbo Seafood" vs
    "Jumbo Seafood Clarke Quay"), so one name contained in the other counts as a strong match."""
    a, b = a.lower().strip(), b.lower().strip()
    short, long_ = sorted((a, b), key=len)
    if len(short) >= 4 and short in long_:
        return 0.95
    return SequenceMatcher(None, a, b).ratio()


@dataclass
class Candidate:
    id: str
    merchant: str
    amount: Decimal
    spent_on: date
    image_hash: str | None = None


def find_duplicates(existing: list[Candidate], *, img_hash: str | None, amount: Decimal | None,
                    spent_on: date | None, merchant: str | None) -> list[dict]:
    hits = []
    for e in existing:
        reasons = []
        if img_hash and e.image_hash:
            try:
                if hash_distance(img_hash, e.image_hash) <= HASH_DISTANCE:
                    reasons.append("same receipt image")
            except Exception:
                pass
        if amount is not None and spent_on and merchant:
            if (abs(e.amount - amount) <= Decimal("0.01") and abs((e.spent_on - spent_on).days) <= 1
                    and merchant_similarity(e.merchant, merchant) >= MERCHANT_SIMILARITY):
                reasons.append("same merchant, amount and date")
        if reasons:
            hits.append({"expense_id": e.id, "merchant": e.merchant, "amount": e.amount,
                         "spent_on": e.spent_on, "reason": " + ".join(reasons)})
    return hits

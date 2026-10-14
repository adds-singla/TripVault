"""Scan pipeline: OCR -> parse -> classify -> duplicate check."""
from __future__ import annotations
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.ml import classifier, duplicates, ocr, parser
from app.models import Expense


def analyze_receipt(db: Session, trip_id, image_bytes: bytes) -> dict:
    text = ocr.extract_text(image_bytes)
    p = parser.parse_receipt_text(text)
    category, conf, method = classifier.classify(f"{p.merchant or ''} {text[:300]}")
    h = duplicates.image_hash(image_bytes)
    existing = [duplicates.Candidate(str(e.id), e.merchant, e.amount, e.spent_on, e.image_hash)
                for e in db.scalars(select(Expense).where(Expense.trip_id == trip_id, Expense.is_settlement.is_(False)))]
    dups = duplicates.find_duplicates(existing, img_hash=h, amount=p.total, spent_on=p.date, merchant=p.merchant)
    found = sum(x is not None for x in (p.merchant, p.total, p.date))
    return {"merchant": p.merchant, "amount": p.total, "spent_on": p.date, "currency": p.currency,
            "category": category, "category_confidence": round(conf, 2), "category_method": method,
            "image_hash": h, "ocr_raw_text": text, "fields_found": found, "duplicates": dups,
            "confidence": round(found / 3, 2)}

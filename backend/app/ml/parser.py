"""Extract merchant, total and date from raw OCR text with regexes."""
from __future__ import annotations
import re
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation

AMOUNT_RE = re.compile(r"(?<![\d.,])(\d{1,3}(?:[,]\d{3})+|\d+)[.,](\d{2})(?!\d)")
TOTAL_KEYS = ("grand total", "total due", "amount due", "total paid", "total amount", "balance due", "total")
SKIP_TOTAL = ("subtotal", "sub total", "sub-total", "tax", "gst", "vat", "svc", "service", "change", "cash", "tender")
MONTHS = {m: i for i, m in enumerate(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1)}
SKIP_MERCHANT = ("receipt", "invoice", "tax", "tel", "phone", "www", "http", "gst", "table", "cashier", "order", "date", "time")


@dataclass
class Parsed:
    merchant: str | None
    total: Decimal | None
    date: date | None
    currency: str | None


def _amounts(line: str) -> list[Decimal]:
    out = []
    for whole, cents in AMOUNT_RE.findall(line):
        try:
            out.append(Decimal(whole.replace(",", "") + "." + cents))
        except InvalidOperation:
            pass
    return out


def parse_total(text: str) -> Decimal | None:
    best: tuple[int, Decimal] | None = None
    for line in text.splitlines():
        low = line.lower()
        if any(s in low for s in SKIP_TOTAL):
            continue
        for rank, key in enumerate(TOTAL_KEYS):
            if key in low:
                vals = _amounts(line)
                if vals:
                    cand = (len(TOTAL_KEYS) - rank, max(vals))
                    if best is None or cand[0] > best[0] or (cand[0] == best[0] and cand[1] > best[1]):
                        best = cand
                break
    if best:
        return best[1]
    allv = _amounts(text)
    return max(allv) if allv else None


def _mk(y: int, m: int, d: int) -> date | None:
    if y < 100:
        y += 2000
    try:
        return date(y, m, d)
    except ValueError:
        return None


def parse_date(text: str) -> date | None:
    t = text.replace("\n", " ")
    if m := re.search(r"\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b", t):
        if d := _mk(int(m[1]), int(m[2]), int(m[3])):
            return d
    if m := re.search(r"\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b", t):
        a, b, y = int(m[1]), int(m[2]), int(m[3])
        day, mon = (b, a) if b > 12 >= a and a <= 12 and b > 12 else (a, b)  # month-first only if unambiguous
        if d := _mk(y, mon, day):
            return d
    if m := re.search(r"\b(\d{1,2})[ -]([A-Za-z]{3})[a-z]*[ ,-]+(\d{2,4})\b", t):
        if m[2].lower() in MONTHS and (d := _mk(int(m[3]), MONTHS[m[2].lower()], int(m[1]))):
            return d
    if m := re.search(r"\b([A-Za-z]{3})[a-z]*\.? (\d{1,2}),? (\d{4})\b", t):
        if m[1].lower() in MONTHS and (d := _mk(int(m[3]), MONTHS[m[1].lower()], int(m[2]))):
            return d
    return None


def parse_merchant(text: str) -> str | None:
    for line in text.splitlines()[:8]:
        s = re.sub(r"[^A-Za-z0-9&' .,-]", " ", line).strip(" .-,")
        s = re.sub(r"\b(tax\s+)?(receipt|invoice)\b", "", s, flags=re.I)  # "GRAB RIDE RECEIPT" -> "GRAB RIDE"
        s = re.sub(r"\s+", " ", s).strip(" .-,")
        letters = sum(c.isalpha() for c in s)
        if letters >= 3 and letters / max(len(s), 1) > 0.6 and not any(k in s.lower() for k in SKIP_MERCHANT):
            return s.title() if s.isupper() else s
    return None


def parse_currency(text: str) -> str | None:
    if m := re.search(r"\b(SGD|USD|EUR|GBP|INR|JPY|AUD|THB|AED)\b", text.upper()):
        return m[1]
    return {"$": None, "€": "EUR", "£": "GBP", "₹": "INR", "¥": "JPY"}.get(next((c for c in text if c in "€£₹¥"), ""))


def parse_receipt_text(text: str) -> Parsed:
    return Parsed(parse_merchant(text), parse_total(text), parse_date(text), parse_currency(text))

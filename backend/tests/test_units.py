from datetime import date
from decimal import Decimal as D

from app.ml import classifier, duplicates, parser
from app.services.settle import minimize_transactions
from app.services.splits import split_equal


# ---- settle-up algorithm ----
def _apply(net, txs):
    n = dict(net)
    for f, t, a in txs:
        n[f] += a
        n[t] -= a
    return n


def test_settle_balanced_nets_to_zero():
    net = {"a": D("120"), "b": D("-60"), "c": D("-60")}
    txs = minimize_transactions(net)
    assert all(abs(v) < D("0.01") for v in _apply(net, txs).values())
    assert len(txs) == 2


def test_settle_uses_fewer_transactions_than_pairwise():
    # a owes b 10, b owes c 10 -> net: a -10, b 0, c +10 -> ONE payment a->c
    txs = minimize_transactions({"a": D("-10"), "b": D("0"), "c": D("10")})
    assert txs == [("a", "c", D("10"))]


def test_settle_at_most_n_minus_1_and_exact():
    net = {"a": D("50.50"), "b": D("-20.25"), "c": D("-10.25"), "d": D("-30.00"), "e": D("10.00")}
    txs = minimize_transactions(net)
    assert len(txs) <= len(net) - 1
    assert all(abs(v) < D("0.01") for v in _apply(net, txs).values())


def test_settle_empty():
    assert minimize_transactions({}) == []
    assert minimize_transactions({"a": D("0"), "b": D("0")}) == []


# ---- equal split rounding ----
def test_split_equal_sums_exactly():
    s = split_equal(D("100.00"), ["a", "b", "c"])
    assert sum(s.values()) == D("100.00") and sorted(s.values()) == [D("33.33"), D("33.33"), D("33.34")]


# ---- classifier ----
def test_classifier_known_merchants():
    cases = {"Starbucks coffee": "Food", "Grab ride Orchard": "Transport", "Hilton hotel room": "Accommodation",
             "Night Safari zoo tickets": "Activities", "Uniqlo clothing": "Shopping"}
    for text, cat in cases.items():
        assert classifier.classify(text)[0] == cat, text


def test_classifier_rule_fallback_and_empty():
    assert classifier.rule_based("Sunrise Beach Resort") == "Accommodation"
    assert classifier.rule_based("zzzz qqqq") == "Other"
    assert classifier.classify("")[0] == "Other"


# ---- receipt text parser ----
RECEIPT = """JUMBO SEAFOOD
Clarke Quay #01-01
Date: 15/10/2026 20:42
1x Chilli Crab   138.00
Subtotal        176.00
Svc & Tax (10%)   8.50
TOTAL SGD       184.50
"""


def test_parse_receipt_fields():
    p = parser.parse_receipt_text(RECEIPT)
    assert p.merchant == "Jumbo Seafood" and p.total == D("184.50")
    assert p.date == date(2026, 10, 15) and p.currency == "SGD"


def test_parse_total_ignores_subtotal_and_tax():
    assert parser.parse_total("Subtotal 10.00\nGST 0.90\nTotal 10.90") == D("10.90")
    assert parser.parse_total("Grand Total 1,234.50") == D("1234.50")


def test_parse_date_formats():
    assert parser.parse_date("2026-10-15") == date(2026, 10, 15)
    assert parser.parse_date("Oct 16, 2026") == date(2026, 10, 16)
    assert parser.parse_date("16 Oct 2026") == date(2026, 10, 16)
    assert parser.parse_date("10/25/2026") == date(2026, 10, 25)  # unambiguous month-first
    assert parser.parse_date("no date here") is None


# ---- duplicate detector ----
def test_duplicate_fuzzy_match():
    ex = [duplicates.Candidate("1", "Jumbo Seafood Clarke Quay", D("184.50"), date(2026, 10, 15))]
    hit = duplicates.find_duplicates(ex, img_hash=None, amount=D("184.50"), spent_on=date(2026, 10, 15),
                                     merchant="Jumbo Seafood Clarke Qy")
    assert len(hit) == 1 and "amount" in hit[0]["reason"]
    assert not duplicates.find_duplicates(ex, img_hash=None, amount=D("99.00"), spent_on=date(2026, 10, 15),
                                          merchant="Jumbo Seafood Clarke Quay")
    assert not duplicates.find_duplicates(ex, img_hash=None, amount=D("184.50"), spent_on=date(2026, 11, 20),
                                          merchant="Jumbo Seafood Clarke Quay")


def test_duplicate_image_hash():
    import io
    from PIL import Image, ImageDraw
    img = Image.new("RGB", (200, 200), "white")
    ImageDraw.Draw(img).rectangle((20, 30, 150, 90), fill="black")
    buf = io.BytesIO(); img.save(buf, "PNG")
    h = duplicates.image_hash(buf.getvalue())
    ex = [duplicates.Candidate("1", "X", D("1"), date(2026, 1, 1), image_hash=h)]
    assert duplicates.find_duplicates(ex, img_hash=h, amount=None, spent_on=None, merchant=None)


def test_duplicate_partial_merchant_name():
    ex = [duplicates.Candidate("1", "Jumbo Seafood Clarke Quay", D("184.50"), date(2026, 10, 15))]
    assert duplicates.find_duplicates(ex, img_hash=None, amount=D("184.50"), spent_on=date(2026, 10, 15), merchant="Jumbo Seafood")


def test_merchant_strips_receipt_word():
    assert parser.parse_merchant("GRAB RIDE RECEIPT\n2026-10-17\nTotal 15.00") == "Grab Ride"

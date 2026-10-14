import pathlib
from decimal import Decimal as D
import pytest
from app.ml import ocr, parser

SAMPLES = pathlib.Path(__file__).parents[2] / "samples" / "receipts"


@pytest.mark.skipif(__import__("shutil").which("tesseract") is None, reason="tesseract not installed")
@pytest.mark.parametrize("name,total", [("jumbo_seafood.png", D("184.50")), ("starbucks.png", D("12.32")),
                                        ("grab_ride.png", D("15.00"))])
def test_ocr_sample_receipts(name, total):
    text = ocr.extract_text((SAMPLES / name).read_bytes())
    assert parser.parse_receipt_text(text).total == total

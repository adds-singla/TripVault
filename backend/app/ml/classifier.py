"""Expense category classifier: TF-IDF + Logistic Regression, with a keyword-rule fallback."""
from __future__ import annotations
import re
from functools import lru_cache
from pathlib import Path

HERE = Path(__file__).parent
MODEL_PATH = HERE / "model.joblib"
CATEGORIES = ("Food", "Transport", "Accommodation", "Activities", "Shopping", "Other")
MIN_CONFIDENCE = 0.40

RULES: dict[str, tuple[str, ...]] = {
    "Food": ("restaurant", "cafe", "coffee", "pizza", "burger", "bar", "pub", "bakery", "dining", "seafood",
             "noodle", "sushi", "grill", "kitchen", "food", "meal", "dinner", "lunch", "breakfast", "hawker"),
    "Transport": ("taxi", "uber", "grab", "lyft", "metro", "mrt", "bus", "train", "airline", "airways", "flight",
                  "fuel", "petrol", "parking", "toll", "ferry", "rail", "airport", "cab"),
    "Accommodation": ("hotel", "inn", "resort", "hostel", "airbnb", "lodge", "suites", "stay", "motel", "villa", "booking"),
    "Activities": ("ticket", "museum", "tour", "zoo", "park", "cinema", "concert", "cruise", "admission", "pass",
                   "safari", "aquarium", "gardens", "entry", "show"),
    "Shopping": ("store", "shop", "mall", "boutique", "souvenir", "mart", "market", "pharmacy", "fashion", "duty free"),
}


def rule_based(text: str) -> str:
    t = text.lower()
    scores = {c: sum(1 for k in kws if re.search(rf"\b{re.escape(k)}", t)) for c, kws in RULES.items()}
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else "Other"


@lru_cache
def _model():
    if not MODEL_PATH.exists():
        return None
    import joblib
    return joblib.load(MODEL_PATH)


def classify(text: str) -> tuple[str, float, str]:
    """Returns (category, confidence 0-1, method 'ml' | 'rules')."""
    text = (text or "").strip()
    if not text:
        return "Other", 0.0, "rules"
    model = _model()
    if model is not None:
        probs = model.predict_proba([text])[0]
        i = int(probs.argmax())
        if probs[i] >= MIN_CONFIDENCE:
            return str(model.classes_[i]), float(probs[i]), "ml"
    cat = rule_based(text)
    return cat, (0.5 if cat != "Other" else 0.2), "rules"

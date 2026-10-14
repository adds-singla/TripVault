"""Train the expense classifier. Run: python -m scripts.train_classifier"""
import csv
import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from app.ml.classifier import HERE, MODEL_PATH


def main() -> None:
    with open(HERE / "data" / "expense_categories.csv") as f:
        rows = list(csv.DictReader(f))
    X, y = [r["text"] for r in rows], [r["category"] for r in rows]
    pipe = lambda: Pipeline([("tfidf", TfidfVectorizer(lowercase=True, ngram_range=(1, 2), analyzer="char_wb")),
                             ("clf", LogisticRegression(max_iter=1000, C=8.0))])
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    p = pipe().fit(Xtr, ytr)
    print(classification_report(yte, p.predict(Xte), zero_division=0))
    joblib.dump(pipe().fit(X, y), MODEL_PATH)  # final model on all data
    print("saved", MODEL_PATH)


if __name__ == "__main__":
    main()

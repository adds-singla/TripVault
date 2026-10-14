FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
# Tesseract + OpenCV runtime libs (used from Phase 5)
RUN apt-get update && apt-get install -y --no-install-recommends tesseract-ocr libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
COPY requirements-ml.txt .
RUN pip install --no-cache-dir -r requirements.txt -r requirements-ml.txt
COPY . .
RUN python -m scripts.train_classifier > /dev/null && chmod +x entrypoint.sh  # retrain with the image's scikit-learn version
EXPOSE 8000
ENTRYPOINT ["./entrypoint.sh"]

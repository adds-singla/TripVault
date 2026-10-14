"""Receipt OCR: OpenCV preprocessing (grayscale, denoise, deskew, threshold) + Tesseract."""
from __future__ import annotations
import io


class OCRUnavailable(RuntimeError):
    pass


def _deskew(gray):
    import cv2
    import numpy as np
    coords = np.column_stack(np.where(gray < 128))
    if len(coords) < 50:
        return gray
    angle = cv2.minAreaRect(coords.astype("float32"))[-1]
    angle = -(90 + angle) if angle < -45 else -angle
    if abs(angle) < 0.3 or abs(angle) > 20:
        return gray
    h, w = gray.shape
    M = cv2.getRotationMatrix2D((w / 2, h / 2), angle, 1.0)
    return cv2.warpAffine(gray, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)


def preprocess(image_bytes: bytes):
    import cv2
    import numpy as np
    img = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image")
    h, w = img.shape[:2]
    if max(h, w) < 1400:  # upscale small photos: Tesseract likes ~300 DPI text
        img = cv2.resize(img, None, fx=1400 / max(h, w), fy=1400 / max(h, w), interpolation=cv2.INTER_CUBIC)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.fastNlMeansDenoising(gray, None, 10)
    gray = _deskew(gray)
    return cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 15)


def extract_text(image_bytes: bytes) -> str:
    try:
        import pytesseract
        proc = preprocess(image_bytes)
        return pytesseract.image_to_string(proc, config="--oem 3 --psm 6")
    except (ImportError, pytesseract.TesseractNotFoundError) as e:  # type: ignore[name-defined]
        raise OCRUnavailable("Tesseract is not installed on the server") from e

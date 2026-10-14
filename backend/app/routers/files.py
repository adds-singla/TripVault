"""Pre-signed upload/download, documents (vault) and photos."""
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import storage
from app.db import get_db
from app.deps import Access, editor, viewer
from app.models import Document, Photo
from app.schemas import DocumentIn, DocumentOut, PhotoIn, PresignUploadIn

router = APIRouter(prefix="/trips/{trip_id}", tags=["files"])


def _check_key(key: str, trip_id: uuid.UUID, sub: str) -> dict:
    """The key must live under this trip and the object must really exist in S3."""
    if not key.startswith(f"trips/{trip_id}/{sub}/") or ".." in key:
        raise HTTPException(400, "Invalid file key for this trip")
    head = storage.head_object(key)
    if not head:
        raise HTTPException(400, "Upload not found in storage; upload the file first")
    return head


@router.post("/documents/presign-upload")
def presign_upload(body: PresignUploadIn, a: Access = Depends(editor)) -> dict:
    try:
        storage.validate_upload(body.content_type, body.size)
    except ValueError as e:
        raise HTTPException(422, str(e))
    key = storage.build_key(str(a.trip.id), body.kind, body.content_type)
    url, headers = storage.presign_upload(key, body.content_type)
    return {"upload_url": url, "s3_key": key, "headers": headers, "expires_in": 300}


@router.get("/documents", response_model=list[DocumentOut])
def list_documents(folder: str | None = None, a: Access = Depends(viewer), db: Session = Depends(get_db)):
    q = select(Document).where(Document.trip_id == a.trip.id).order_by(Document.created_at.desc())
    if folder:
        q = q.where(Document.folder == folder)
    return db.scalars(q).all()


@router.post("/documents", response_model=DocumentOut, status_code=201)
def register_document(body: DocumentIn, a: Access = Depends(editor), db: Session = Depends(get_db)):
    head = _check_key(body.s3_key, a.trip.id, "documents")
    size = head["ContentLength"]
    if size > 10 * 1024 * 1024:
        storage.delete_object(body.s3_key)
        raise HTTPException(422, "File exceeds 10 MB")
    d = Document(trip_id=a.trip.id, uploader_id=a.user.id, name=body.name, s3_key=body.s3_key, folder=body.folder,
                 size=size, content_type=body.content_type)
    db.add(d)
    db.commit()
    return d


@router.get("/documents/{doc_id}/presign-download")
def presign_download(doc_id: uuid.UUID, a: Access = Depends(viewer), db: Session = Depends(get_db)) -> dict:
    d = db.get(Document, doc_id)
    if not d or d.trip_id != a.trip.id:
        raise HTTPException(404, "Document not found")
    return {"url": storage.presign_download(d.s3_key, d.name), "expires_in": 300}


@router.delete("/documents/{doc_id}", status_code=204)
def delete_document(doc_id: uuid.UUID, a: Access = Depends(editor), db: Session = Depends(get_db)) -> None:
    d = db.get(Document, doc_id)
    if not d or d.trip_id != a.trip.id:
        raise HTTPException(404, "Document not found")
    storage.delete_object(d.s3_key)
    db.delete(d)
    db.commit()


# ---- photos ----
@router.get("/photos")
def list_photos(a: Access = Depends(viewer), db: Session = Depends(get_db)) -> list[dict]:
    rows = db.scalars(select(Photo).where(Photo.trip_id == a.trip.id).order_by(Photo.created_at.desc())).all()
    return [{"id": p.id, "caption": p.caption, "created_at": p.created_at, "uploader_id": p.uploader_id,
             "url": storage.presign_download(p.s3_key, "photo", expires=3600)} for p in rows]


@router.post("/photos", status_code=201)
def register_photo(body: PhotoIn, a: Access = Depends(editor), db: Session = Depends(get_db)) -> dict:
    head = _check_key(body.s3_key, a.trip.id, "photos")
    if not body.content_type.startswith("image/"):
        raise HTTPException(422, "Photos must be images")
    p = Photo(trip_id=a.trip.id, uploader_id=a.user.id, s3_key=body.s3_key, caption=body.caption,
              size=head["ContentLength"], content_type=body.content_type)
    db.add(p)
    db.commit()
    return {"id": p.id}


@router.delete("/photos/{photo_id}", status_code=204)
def delete_photo(photo_id: uuid.UUID, a: Access = Depends(editor), db: Session = Depends(get_db)) -> None:
    p = db.get(Photo, photo_id)
    if not p or p.trip_id != a.trip.id:
        raise HTTPException(404, "Photo not found")
    storage.delete_object(p.s3_key)
    db.delete(p)
    db.commit()

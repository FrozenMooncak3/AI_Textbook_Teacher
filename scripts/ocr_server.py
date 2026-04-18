#!/usr/bin/env python3
"""HTTP wrapper around PaddleOCR for screenshot recognition and PDF OCR."""

import io
import os
import tempfile
import threading
from typing import Any

import boto3
import fitz
import numpy as np
import requests
from botocore.client import Config
from flask import Flask, jsonify, request
from PIL import Image, ImageOps
from paddleocr import PaddleOCR

try:
    import pymupdf4llm

    HAS_PYMUPDF4LLM = True
except ImportError:
    HAS_PYMUPDF4LLM = False

OCR_SERVER_TOKEN = os.environ.get("OCR_SERVER_TOKEN", "")
NEXT_CALLBACK_URL = os.environ.get("NEXT_CALLBACK_URL", "")


def _require_bearer() -> tuple[Any, int] | None:
    """Return (response, status) if Bearer token invalid, else None."""
    if not OCR_SERVER_TOKEN:
        return jsonify({"error": "OCR_SERVER_TOKEN not configured"}), 500
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return jsonify({"error": "missing Bearer token"}), 401
    received = header[len("Bearer ") :].strip()
    if received != OCR_SERVER_TOKEN:
        return jsonify({"error": "invalid token"}), 401
    return None


OCR_PROVIDER = os.environ.get("OCR_PROVIDER", "paddle")

print("Loading PaddleOCR model...", flush=True)
ocr_engine = PaddleOCR(use_angle_cls=True, lang="ch", use_gpu=False, show_log=False)
ocr_lock = threading.Lock()
print("PaddleOCR model loaded", flush=True)

app = Flask(__name__)


def _post_callback(event: dict[str, Any]) -> None:
    """POST an OCR event to Next.js callback. Logs failure but doesn't raise."""
    if not NEXT_CALLBACK_URL:
        print(
            f"[callback] NEXT_CALLBACK_URL not configured; skipping event={event.get('event')}",
            flush=True,
        )
        return
    if not OCR_SERVER_TOKEN:
        print(
            f"[callback] OCR_SERVER_TOKEN not configured; skipping event={event.get('event')}",
            flush=True,
        )
        return

    try:
        response = requests.post(
            NEXT_CALLBACK_URL,
            json=event,
            headers={"Authorization": f"Bearer {OCR_SERVER_TOKEN}"},
            timeout=30,
        )
        if not response.ok:
            print(
                f"[callback] HTTP {response.status_code} for event={event.get('event')}: {response.text[:300]}",
                flush=True,
            )
    except Exception as error:
        print(f"[callback] POST failed for event={event.get('event')}: {error}", flush=True)


def _r2_client():
    account_id = os.environ.get("R2_ACCOUNT_ID")
    access_key = os.environ.get("R2_ACCESS_KEY_ID")
    secret_key = os.environ.get("R2_SECRET_ACCESS_KEY")
    if not account_id or not access_key or not secret_key:
        raise RuntimeError(
            "R2 env vars missing: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY all required"
        )
    return boto3.client(
        "s3",
        endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        config=Config(signature_version="s3v4"),
    )


def _download_pdf_from_r2(object_key: str) -> str:
    """Download PDF from R2 to a temp file, return the local path. Caller must os.unlink."""
    bucket = os.environ.get("R2_BUCKET")
    if not bucket:
        raise RuntimeError("R2_BUCKET env var missing")
    tmp = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    tmp.close()
    _r2_client().download_file(bucket, object_key, tmp.name)
    return tmp.name


def _cleanup_if_temp(path: str, downloaded: bool) -> None:
    if downloaded:
        try:
            os.unlink(path)
        except OSError:
            pass


def extract_lines(result: object) -> tuple[list[str], float]:
    if not isinstance(result, list) or not result or not isinstance(result[0], list):
        return [], 0.0

    lines: list[str] = []
    confidences: list[float] = []

    for item in result[0]:
        if not isinstance(item, list) or len(item) < 2:
            continue

        recognition = item[1]
        if not isinstance(recognition, (tuple, list)) or len(recognition) < 2:
            continue

        text = str(recognition[0]).strip()
        try:
            confidence = float(recognition[1])
        except (TypeError, ValueError):
            confidence = 0.0

        if not text or confidence < 0.35:
            continue

        lines.append(text)
        confidences.append(confidence)

    average_confidence = sum(confidences) / len(confidences) if confidences else 0.0
    return lines, average_confidence


def render_pdf_page(page: fitz.Page) -> Image.Image:
    matrix = fitz.Matrix(1.5, 1.5)
    pix = page.get_pixmap(matrix=matrix)
    return Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")


def ocr_page_image(page_image: Image.Image) -> str:
    """Route OCR to the configured provider."""
    if OCR_PROVIDER == "google":
        return google_ocr(page_image)

    return paddle_ocr(page_image)


def paddle_ocr(page_image: Image.Image) -> str:
    """Run OCR with PaddleOCR."""
    with ocr_lock:
        result = ocr_engine.ocr(np.array(page_image), cls=True)

    lines, _ = extract_lines(result)
    return "\n".join(lines).strip()


def google_ocr(page_image: Image.Image) -> str:
    """OCR a page image via Google Cloud Vision API (document_text_detection)."""
    from google.cloud import vision

    client = vision.ImageAnnotatorClient()

    buffer = io.BytesIO()
    page_image.save(buffer, format="PNG")
    image = vision.Image(content=buffer.getvalue())

    response = client.document_text_detection(image=image)
    if response.error.message:
        raise RuntimeError(f"Google Vision error: {response.error.message}")

    full = response.full_text_annotation
    return full.text.strip() if full and full.text else ""


def classify_page(page: fitz.Page) -> str:
    """Classify a PDF page as text, scanned, or mixed."""
    text = page.get_text().strip()
    char_count = len(text)
    images = page.get_images()
    page_area = page.rect.width * page.rect.height
    image_coverage = 0.0

    if page_area > 0 and images:
        for image in images:
            xref = image[0]
            try:
                image_rects = page.get_image_rects(xref)
            except Exception:
                continue

            for rect in image_rects:
                image_coverage += rect.width * rect.height

        image_coverage = image_coverage / page_area

    if char_count > 50 and image_coverage < 0.5:
        return "text"
    if char_count < 10 and image_coverage > 0.7:
        return "scanned"

    return "mixed"


def process_pdf_ocr(
    pdf_path: str,
    book_id: int,
    classifications: list[dict[str, Any]] | None,
    downloaded: bool = False,
) -> None:
    """Background worker: OCR scanned/mixed pages and POST callbacks."""
    try:
        if not classifications:
            print(f"[ocr] book {book_id} has no classifications; skipping", flush=True)
            return

        scanned_pages = [
            page_info for page_info in classifications if page_info["type"] in ("scanned", "mixed")
        ]
        if not scanned_pages:
            print(f"[ocr] book {book_id} has no scanned pages; nothing to OCR", flush=True)
            return

        total_to_ocr = len(scanned_pages)
        doc = fitz.open(pdf_path)
        ocr_count = 0

        try:
            for page_info in scanned_pages:
                page_number = page_info["page"]
                page_index = page_number - 1
                page = doc[page_index]
                page_image = render_pdf_page(page)
                page_text = ocr_page_image(page_image)

                _post_callback(
                    {
                        "event": "page_result",
                        "book_id": book_id,
                        "module_id": 0,
                        "page_number": page_number,
                        "text": page_text,
                    }
                )

                ocr_count += 1
                _post_callback(
                    {
                        "event": "progress",
                        "book_id": book_id,
                        "pages_done": ocr_count,
                        "pages_total": total_to_ocr,
                    }
                )
        finally:
            doc.close()

        _post_callback(
            {
                "event": "module_complete",
                "book_id": book_id,
                "module_id": 0,
                "status": "success",
            }
        )
        print(f"[ocr] book {book_id} OCR complete ({ocr_count} pages)", flush=True)
    except Exception as error:
        print(f"[ocr] book {book_id} failed: {error}", flush=True)
        _post_callback(
            {
                "event": "module_complete",
                "book_id": book_id,
                "module_id": 0,
                "status": "error",
                "error": str(error)[:500],
            }
        )
    finally:
        _cleanup_if_temp(pdf_path, downloaded)


@app.get("/health")
def health() -> tuple[Any, int] | Any:
    return jsonify(
        {
            "status": "ok",
            "ocr_provider": OCR_PROVIDER,
            "callback_configured": bool(NEXT_CALLBACK_URL),
        }
    )


@app.post("/ocr")
def ocr_image_route() -> tuple[Any, int] | Any:
    auth_error = _require_bearer()
    if auth_error:
        return auth_error

    try:
        body = request.get_json(silent=True) or {}
        image_b64 = str(body.get("image_base64", "")).strip()

        if not image_b64:
            return jsonify({"error": "missing image_base64"}), 400

        import base64

        if "," in image_b64 and image_b64.startswith("data:"):
            image_b64 = image_b64.split(",", 1)[1]

        image_bytes = base64.b64decode(image_b64)
        image = Image.open(io.BytesIO(image_bytes))
        image = ImageOps.exif_transpose(image).convert("L")
        image = ImageOps.autocontrast(image)
        width, height = image.size
        if max(width, height) < 1600:
            image = image.resize((width * 2, height * 2), Image.Resampling.LANCZOS)
        image = image.convert("RGB")

        text = ocr_page_image(image)
        confidence = 1.0 if text.strip() else 0.0
        return jsonify({"text": text, "confidence": confidence})
    except Exception as error:
        return jsonify({"error": str(error)}), 500


@app.post("/classify-pdf")
def classify_pdf_route() -> tuple[Any, int] | Any:
    auth_error = _require_bearer()
    if auth_error:
        return auth_error

    body = request.get_json(silent=True) or {}
    r2_key = str(body.get("r2_object_key", "")).strip()
    legacy_path = str(body.get("pdf_path", "")).strip()
    raw_book_id = body.get("book_id")

    if not r2_key and not legacy_path:
        return jsonify({"error": "missing r2_object_key (or legacy pdf_path)"}), 400

    if raw_book_id is None:
        return jsonify({"error": "missing book_id"}), 400

    try:
        book_id = int(raw_book_id)
    except (TypeError, ValueError):
        return jsonify({"error": "invalid book_id"}), 400

    downloaded = bool(r2_key)
    try:
        pdf_path = _download_pdf_from_r2(r2_key) if r2_key else legacy_path
    except Exception as error:
        return jsonify({"error": f"R2 download failed: {error}"}), 500

    doc = None
    pages: list[dict[str, Any]] = []
    text_count = 0
    scanned_count = 0
    mixed_count = 0

    try:
        doc = fitz.open(pdf_path)
        for page_index in range(len(doc)):
            page_number = page_index + 1
            page_type = classify_page(doc[page_index])
            pages.append({"page": page_number, "type": page_type})

            if page_type == "text":
                text_count += 1
            elif page_type == "scanned":
                scanned_count += 1
            else:
                mixed_count += 1
    finally:
        if doc is not None:
            doc.close()
        _cleanup_if_temp(pdf_path, downloaded)

    return jsonify(
        {
            "pages": pages,
            "text_count": text_count,
            "scanned_count": scanned_count,
            "mixed_count": mixed_count,
            "total_pages": len(pages),
        }
    )


@app.post("/extract-text")
def extract_text_route() -> tuple[Any, int] | Any:
    auth_error = _require_bearer()
    if auth_error:
        return auth_error

    body = request.get_json(silent=True) or {}
    r2_key = str(body.get("r2_object_key", "")).strip()
    legacy_path = str(body.get("pdf_path", "")).strip()
    raw_book_id = body.get("book_id")
    classifications_raw = body.get("classifications")

    if not r2_key and not legacy_path:
        return jsonify({"error": "missing r2_object_key (or legacy pdf_path)"}), 400

    if raw_book_id is None:
        return jsonify({"error": "missing book_id"}), 400

    try:
        book_id = int(raw_book_id)
    except (TypeError, ValueError):
        return jsonify({"error": "invalid book_id"}), 400

    classifications: list[dict[str, Any]] | None = None
    if isinstance(classifications_raw, list):
        classifications = classifications_raw
    if not classifications:
        return jsonify({"error": "Run /classify-pdf first"}), 400

    downloaded = bool(r2_key)
    try:
        pdf_path = _download_pdf_from_r2(r2_key) if r2_key else legacy_path
    except Exception as error:
        return jsonify({"error": f"R2 download failed: {error}"}), 500

    doc = None
    full_text_parts: list[str] = []
    text_page_count = 0

    try:
        doc = fitz.open(pdf_path)
        for page_index in range(len(doc)):
            page_number = page_index + 1
            classification = next((item for item in classifications if item["page"] == page_number), None)

            if classification and classification["type"] == "text":
                if HAS_PYMUPDF4LLM:
                    page_markdown = pymupdf4llm.to_markdown(pdf_path, pages=[page_index])
                else:
                    page_markdown = doc[page_index].get_text().strip()

                full_text_parts.append(f"--- PAGE {page_number} ---\n{page_markdown}")
                text_page_count += 1
                continue

            full_text_parts.append(f"--- PAGE {page_number} ---\n[OCR_PENDING]")
    finally:
        if doc is not None:
            doc.close()
        _cleanup_if_temp(pdf_path, downloaded)

    full_text = "\n".join(full_text_parts)

    return jsonify({"text": full_text, "page_count": text_page_count})


@app.post("/ocr-pdf")
def ocr_pdf_route() -> tuple[Any, int] | Any:
    auth_error = _require_bearer()
    if auth_error:
        return auth_error

    body = request.get_json(silent=True) or {}
    r2_key = str(body.get("r2_object_key", "")).strip()
    legacy_path = str(body.get("pdf_path", "")).strip()
    raw_book_id = body.get("book_id")
    classifications_raw = body.get("classifications")

    if not r2_key and not legacy_path:
        return jsonify({"error": "missing r2_object_key (or legacy pdf_path)"}), 400

    if raw_book_id is None:
        return jsonify({"error": "missing book_id"}), 400

    try:
        book_id = int(raw_book_id)
    except (TypeError, ValueError):
        return jsonify({"error": "invalid book_id"}), 400

    classifications: list[dict[str, Any]] | None = None
    if isinstance(classifications_raw, list):
        classifications = classifications_raw

    downloaded = bool(r2_key)
    try:
        pdf_path = _download_pdf_from_r2(r2_key) if r2_key else legacy_path
    except Exception as error:
        return jsonify({"error": f"R2 download failed: {error}"}), 500

    if not os.path.isfile(pdf_path):
        return jsonify({"error": "pdf_path not found"}), 404

    worker = threading.Thread(
        target=process_pdf_ocr,
        args=(pdf_path, book_id, classifications, downloaded),
        daemon=True,
    )
    worker.start()
    return jsonify({"status": "accepted"}), 202


def main() -> None:
    host = os.environ.get("OCR_HOST", "0.0.0.0")
    port = int(os.environ.get("OCR_PORT", "8000"))
    print(f"OCR server listening on http://{host}:{port}", flush=True)
    app.run(host=host, port=port, threaded=True)


if __name__ == "__main__":
    main()

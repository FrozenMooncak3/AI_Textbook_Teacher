#!/usr/bin/env python3
"""HTTP wrapper around PaddleOCR for screenshot recognition and PDF OCR."""

import io
import json
import os
import tempfile
import threading
from typing import Any

import boto3
import fitz
import numpy as np
import psycopg2
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


def preprocess_image(image_path: str) -> Image.Image:
    image = Image.open(image_path)
    image = ImageOps.exif_transpose(image).convert("L")
    image = ImageOps.autocontrast(image)

    width, height = image.size
    if max(width, height) < 1600:
        scale = 2
        image = image.resize((width * scale, height * scale), Image.Resampling.LANCZOS)

    return image.convert("RGB")


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


def run_write(connection: Any, sql: str, params: tuple[object, ...]) -> None:
    with connection.cursor() as cursor:
        cursor.execute(sql, params)
    connection.commit()


def log_to_db(connection: Any, level: str, action: str, details: str) -> None:
    try:
        run_write(
            connection,
            "INSERT INTO logs (level, action, details) VALUES (%s, %s, %s)",
            (level, action, details),
        )
    except Exception as error:
        connection.rollback()
        print(f"Failed to write log: {error}", flush=True)


def update_ocr_progress(connection: Any, book_id: int, current_page: int, total_pages: int) -> None:
    run_write(
        connection,
        "UPDATE books SET ocr_current_page = %s, ocr_total_pages = %s, parse_status = 'processing' WHERE id = %s",
        (current_page, total_pages, book_id),
    )


def set_parse_status(connection: Any, book_id: int, status: str) -> None:
    run_write(
        connection,
        "UPDATE books SET parse_status = %s WHERE id = %s",
        (status, book_id),
    )


def write_ocr_result(connection: Any, book_id: int, raw_text: str) -> None:
    run_write(
        connection,
        "UPDATE books SET raw_text = %s, parse_status = 'done' WHERE id = %s",
        (raw_text, book_id),
    )


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


def extract_page_text(page: fitz.Page) -> str:
    text = page.get_text().strip()
    if text:
        return text

    image = render_pdf_page(page)
    return paddle_ocr(image)


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


def extract_text_from_pdf(pdf_path: str, connection: Any, book_id: int) -> str:
    doc = fitz.open(pdf_path)
    total_pages = doc.page_count
    marked_parts: list[str] = []
    has_text = False

    update_ocr_progress(connection, book_id, 0, total_pages)

    try:
        for page_index in range(total_pages):
            page_number = page_index + 1
            page_text = ""

            try:
                page = doc[page_index]
                page_text = extract_page_text(page)
            except Exception as page_error:
                log_to_db(
                    connection,
                    "warn",
                    "OCR skipped page",
                    f"bookId={book_id}, page={page_number}, error={str(page_error)[:500]}",
                )

            if page_text.strip():
                has_text = True

            marked_parts.append(f"--- PAGE {page_number} ---\n{page_text}".rstrip())
            update_ocr_progress(connection, book_id, page_number, total_pages)

            if page_number % 10 == 0 or page_number == total_pages:
                log_to_db(
                    connection,
                    "info",
                    "OCR progress",
                    f"bookId={book_id}, pages={page_number}/{total_pages}",
                )
    finally:
        doc.close()

    if not has_text:
        raise ValueError("OCR returned empty text")

    return "\n\n".join(marked_parts).strip()


def replace_page_placeholder(book_id: int, page_num: int, ocr_text: str, connection: Any) -> None:
    """Replace a single OCR placeholder inside raw_text."""
    with connection.cursor() as cursor:
        cursor.execute("SELECT raw_text FROM books WHERE id = %s", (book_id,))
        row = cursor.fetchone()

    raw_text = (row[0] if row else "") or ""
    placeholder = f"--- PAGE {page_num} ---\n[OCR_PENDING]"
    replacement = f"--- PAGE {page_num} ---\n{ocr_text}"
    updated_text = raw_text.replace(placeholder, replacement)
    run_write(connection, "UPDATE books SET raw_text = %s WHERE id = %s", (updated_text, book_id))


def check_module_ocr_completion(book_id: int, completed_page: int, connection: Any) -> None:
    """Mark processing modules done once their last scanned page is OCRed."""
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT id, page_start, page_end FROM modules WHERE book_id = %s AND ocr_status = 'processing'",
            (book_id,),
        )
        modules = cursor.fetchall()

        cursor.execute("SELECT page_classifications FROM books WHERE id = %s", (book_id,))
        row = cursor.fetchone()

    if not row or not row[0]:
        return

    classifications = json.loads(row[0])

    for module_id, page_start, page_end in modules:
        if page_start is None or page_end is None:
            continue

        module_scanned_pages = [
            page_info["page"]
            for page_info in classifications
            if page_start <= page_info["page"] <= page_end and page_info["type"] in ("scanned", "mixed")
        ]
        if not module_scanned_pages:
            continue

        if completed_page >= max(module_scanned_pages):
            run_write(connection, "UPDATE modules SET ocr_status = 'done' WHERE id = %s", (module_id,))

    connection.commit()


def process_pdf_ocr(pdf_path: str, book_id: int, database_url: str, downloaded: bool = False) -> None:
    try:
        with psycopg2.connect(database_url) as connection:
            log_to_db(connection, "info", "OCR started", f"bookId={book_id}, file={pdf_path}")

            with connection.cursor() as cursor:
                cursor.execute("SELECT page_classifications FROM books WHERE id = %s", (book_id,))
                row = cursor.fetchone()

            classifications = json.loads(row[0]) if row and row[0] else None
            if not classifications:
                raw_text = extract_text_from_pdf(pdf_path, connection, book_id)
                write_ocr_result(connection, book_id, raw_text)
                log_to_db(connection, "info", "OCR finished (legacy)", f"bookId={book_id}")
                return

            scanned_pages = [
                page_info for page_info in classifications if page_info["type"] in ("scanned", "mixed")
            ]
            if not scanned_pages:
                set_parse_status(connection, book_id, "done")
                log_to_db(connection, "info", "OCR skipped (all text)", f"bookId={book_id}")
                return

            run_write(
                connection,
                "UPDATE books SET ocr_total_pages = %s, parse_status = 'processing' WHERE id = %s",
                (len(scanned_pages), book_id),
            )

            doc = fitz.open(pdf_path)
            ocr_count = 0
            try:
                for page_info in scanned_pages:
                    page_number = page_info["page"]
                    page_index = page_number - 1
                    page = doc[page_index]
                    page_image = render_pdf_page(page)
                    page_text = ocr_page_image(page_image)

                    replace_page_placeholder(book_id, page_number, page_text, connection)

                    ocr_count += 1
                    update_ocr_progress(connection, book_id, ocr_count, len(scanned_pages))
                    check_module_ocr_completion(book_id, page_number, connection)

                    if ocr_count % 5 == 0 or ocr_count == len(scanned_pages):
                        log_to_db(
                            connection,
                            "info",
                            "OCR progress",
                            f"bookId={book_id}, scanned={ocr_count}/{len(scanned_pages)}",
                        )
            finally:
                doc.close()

            set_parse_status(connection, book_id, "done")
            log_to_db(connection, "info", "OCR finished", f"bookId={book_id}, scanned={ocr_count}")
    except Exception as error:
        print(f"OCR failed for book {book_id}: {error}", flush=True)
        try:
            with psycopg2.connect(database_url) as connection:
                run_write(
                    connection,
                    "UPDATE books SET parse_status = 'error' WHERE id = %s",
                    (book_id,),
                )
                log_to_db(
                    connection,
                    "error",
                    "OCR failed",
                    f"bookId={book_id}, error={str(error)[:1000]}",
                )
        except Exception as db_error:
            print(f"Failed to record OCR failure for book {book_id}: {db_error}", flush=True)
    finally:
        _cleanup_if_temp(pdf_path, downloaded)


@app.get("/health")
def health() -> tuple[Any, int] | Any:
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        return jsonify({"status": "error", "database": "missing"}), 500

    return jsonify({"status": "ok", "database": "configured"})


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
    database_url = os.environ.get("DATABASE_URL")

    if not r2_key and not legacy_path:
        return jsonify({"error": "missing r2_object_key (or legacy pdf_path)"}), 400

    if raw_book_id is None:
        return jsonify({"error": "missing book_id"}), 400

    try:
        book_id = int(raw_book_id)
    except (TypeError, ValueError):
        return jsonify({"error": "invalid book_id"}), 400

    if not database_url:
        return jsonify({"error": "missing DATABASE_URL"}), 500

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

    with psycopg2.connect(database_url) as connection:
        run_write(
            connection,
            """
            UPDATE books
            SET page_classifications = %s, text_pages_count = %s, scanned_pages_count = %s
            WHERE id = %s
            """,
            (json.dumps(pages), text_count, scanned_count, book_id),
        )

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
    database_url = os.environ.get("DATABASE_URL")

    if not r2_key and not legacy_path:
        return jsonify({"error": "missing r2_object_key (or legacy pdf_path)"}), 400

    if raw_book_id is None:
        return jsonify({"error": "missing book_id"}), 400

    try:
        book_id = int(raw_book_id)
    except (TypeError, ValueError):
        return jsonify({"error": "invalid book_id"}), 400

    if not database_url:
        return jsonify({"error": "missing DATABASE_URL"}), 500

    downloaded = bool(r2_key)
    try:
        pdf_path = _download_pdf_from_r2(r2_key) if r2_key else legacy_path
    except Exception as error:
        return jsonify({"error": f"R2 download failed: {error}"}), 500

    with psycopg2.connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT page_classifications FROM books WHERE id = %s", (book_id,))
            row = cursor.fetchone()

    if not row or not row[0]:
        return jsonify({"error": "Run /classify-pdf first"}), 400

    classifications = json.loads(row[0])
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

    with psycopg2.connect(database_url) as connection:
        run_write(connection, "UPDATE books SET raw_text = %s WHERE id = %s", (full_text, book_id))

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
    database_url = os.environ.get("DATABASE_URL")

    if not r2_key and not legacy_path:
        return jsonify({"error": "missing r2_object_key (or legacy pdf_path)"}), 400

    if raw_book_id is None:
        return jsonify({"error": "missing book_id"}), 400

    try:
        book_id = int(raw_book_id)
    except (TypeError, ValueError):
        return jsonify({"error": "invalid book_id"}), 400

    if not database_url:
        return jsonify({"error": "missing DATABASE_URL"}), 500

    downloaded = bool(r2_key)
    try:
        pdf_path = _download_pdf_from_r2(r2_key) if r2_key else legacy_path
    except Exception as error:
        return jsonify({"error": f"R2 download failed: {error}"}), 500

    if not os.path.isfile(pdf_path):
        return jsonify({"error": "pdf_path not found"}), 404

    worker = threading.Thread(
        target=process_pdf_ocr,
        args=(pdf_path, book_id, database_url, downloaded),
        daemon=True,
    )
    worker.start()
    return jsonify({"status": "processing"}), 202


def main() -> None:
    host = os.environ.get("OCR_HOST", "0.0.0.0")
    port = int(os.environ.get("OCR_PORT", "8000"))
    print(f"OCR server listening on http://{host}:{port}", flush=True)
    app.run(host=host, port=port, threaded=True)


if __name__ == "__main__":
    main()

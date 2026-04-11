#!/usr/bin/env python3
"""HTTP wrapper around PaddleOCR for screenshot recognition and PDF OCR."""

import io
import json
import os
import threading
from typing import Any

import fitz
import numpy as np
import psycopg2
from flask import Flask, jsonify, request
from PIL import Image, ImageOps
from paddleocr import PaddleOCR

try:
    import pymupdf4llm

    HAS_PYMUPDF4LLM = True
except ImportError:
    HAS_PYMUPDF4LLM = False

print("Loading PaddleOCR model...", flush=True)
ocr_engine = PaddleOCR(use_angle_cls=True, lang="ch", use_gpu=False, show_log=False)
ocr_lock = threading.Lock()
print("PaddleOCR model loaded", flush=True)

app = Flask(__name__)


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


def extract_page_text(page: fitz.Page) -> str:
    text = page.get_text().strip()
    if text:
        return text

    image = render_pdf_page(page)
    with ocr_lock:
        result = ocr_engine.ocr(np.array(image), cls=True)

    lines, _ = extract_lines(result)
    return "\n".join(lines).strip()


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


def process_pdf_ocr(pdf_path: str, book_id: int, database_url: str) -> None:
    try:
        with psycopg2.connect(database_url) as connection:
            log_to_db(connection, "info", "OCR started", f"bookId={book_id}, file={pdf_path}")
            raw_text = extract_text_from_pdf(pdf_path, connection, book_id)
            write_ocr_result(connection, book_id, raw_text)
            log_to_db(connection, "info", "OCR finished", f"bookId={book_id}, chars={len(raw_text)}")
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


@app.get("/health")
def health() -> tuple[Any, int] | Any:
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        return jsonify({"status": "error", "database": "missing"}), 500

    return jsonify({"status": "ok", "database": "configured"})


@app.post("/ocr")
def ocr_image_route() -> tuple[Any, int] | Any:
    try:
        body = request.get_json(silent=True) or {}
        image_path = str(body.get("image_path", "")).strip()

        if not image_path:
            return jsonify({"error": "missing image_path"}), 400

        image = preprocess_image(image_path)
        with ocr_lock:
            result = ocr_engine.ocr(np.array(image), cls=True)

        lines, confidence = extract_lines(result)
        return jsonify({"text": "\n".join(lines), "confidence": confidence})
    except Exception as error:
        return jsonify({"error": str(error)}), 500


@app.post("/classify-pdf")
def classify_pdf_route() -> tuple[Any, int] | Any:
    body = request.get_json(silent=True) or {}
    pdf_path = str(body.get("pdf_path", "")).strip()
    raw_book_id = body.get("book_id")
    database_url = os.environ.get("DATABASE_URL")

    if not pdf_path:
        return jsonify({"error": "missing pdf_path"}), 400

    if raw_book_id is None:
        return jsonify({"error": "missing book_id"}), 400

    try:
        book_id = int(raw_book_id)
    except (TypeError, ValueError):
        return jsonify({"error": "invalid book_id"}), 400

    if not database_url:
        return jsonify({"error": "missing DATABASE_URL"}), 500

    doc = fitz.open(pdf_path)
    pages: list[dict[str, Any]] = []
    text_count = 0
    scanned_count = 0

    try:
        for page_index in range(len(doc)):
            page_number = page_index + 1
            page_type = classify_page(doc[page_index])
            pages.append({"page": page_number, "type": page_type})

            if page_type == "text":
                text_count += 1
            else:
                scanned_count += 1
    finally:
        doc.close()

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
        }
    )


@app.post("/extract-text")
def extract_text_route() -> tuple[Any, int] | Any:
    body = request.get_json(silent=True) or {}
    pdf_path = str(body.get("pdf_path", "")).strip()
    raw_book_id = body.get("book_id")
    database_url = os.environ.get("DATABASE_URL")

    if not pdf_path:
        return jsonify({"error": "missing pdf_path"}), 400

    if raw_book_id is None:
        return jsonify({"error": "missing book_id"}), 400

    try:
        book_id = int(raw_book_id)
    except (TypeError, ValueError):
        return jsonify({"error": "invalid book_id"}), 400

    if not database_url:
        return jsonify({"error": "missing DATABASE_URL"}), 500

    with psycopg2.connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT page_classifications FROM books WHERE id = %s", (book_id,))
            row = cursor.fetchone()

    if not row or not row[0]:
        return jsonify({"error": "Run /classify-pdf first"}), 400

    classifications = json.loads(row[0])
    doc = fitz.open(pdf_path)
    full_text_parts: list[str] = []
    text_page_count = 0

    try:
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
        doc.close()

    full_text = "\n".join(full_text_parts)

    with psycopg2.connect(database_url) as connection:
        run_write(connection, "UPDATE books SET raw_text = %s WHERE id = %s", (full_text, book_id))

    return jsonify({"text": full_text, "page_count": text_page_count})


@app.post("/ocr-pdf")
def ocr_pdf_route() -> tuple[Any, int] | Any:
    body = request.get_json(silent=True) or {}
    pdf_path = str(body.get("pdf_path", "")).strip()
    raw_book_id = body.get("book_id")
    database_url = os.environ.get("DATABASE_URL")

    if not pdf_path:
        return jsonify({"error": "missing pdf_path"}), 400

    if raw_book_id is None:
        return jsonify({"error": "missing book_id"}), 400

    try:
        book_id = int(raw_book_id)
    except (TypeError, ValueError):
        return jsonify({"error": "invalid book_id"}), 400

    if not database_url:
        return jsonify({"error": "missing DATABASE_URL"}), 500

    if not os.path.isfile(pdf_path):
        return jsonify({"error": "pdf_path not found"}), 404

    worker = threading.Thread(
        target=process_pdf_ocr,
        args=(pdf_path, book_id, database_url),
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

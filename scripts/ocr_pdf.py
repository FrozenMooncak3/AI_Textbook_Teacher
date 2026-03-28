#!/usr/bin/env python3
"""Extract PDF text and update OCR progress in SQLite."""

import argparse
import io
import sqlite3
import sys

import fitz  # PyMuPDF
import numpy as np
from PIL import Image
from paddleocr import PaddleOCR


def log_to_db(db_path: str, book_id: int, level: str, action: str, details: str) -> None:
    try:
        conn = sqlite3.connect(db_path)
        conn.execute(
            "INSERT INTO logs (level, action, details) VALUES (?, ?, ?)",
            (level, action, details),
        )
        conn.commit()
        conn.close()
    except Exception:
        pass


def update_ocr_progress(db_path: str, book_id: int, current_page: int, total_pages: int) -> None:
    try:
        conn = sqlite3.connect(db_path)
        conn.execute(
            "UPDATE books SET ocr_current_page=?, ocr_total_pages=?, parse_status='processing' WHERE id=?",
            (current_page, total_pages, book_id),
        )
        conn.commit()
        conn.close()
    except Exception:
        pass


def set_parse_status(db_path: str, book_id: int, status: str) -> None:
    conn = sqlite3.connect(db_path)
    conn.execute("UPDATE books SET parse_status=? WHERE id=?", (status, book_id))
    conn.commit()
    conn.close()


def extract_text_from_pdf(pdf_path: str, db_path: str, book_id: int) -> str:
    ocr = PaddleOCR(
        use_angle_cls=True,
        lang="ch",
        use_gpu=False,
        show_log=False,
    )

    doc = fitz.open(pdf_path)
    total_pages = doc.page_count
    pages_text: list[str] = []

    update_ocr_progress(db_path, book_id, 0, total_pages)

    try:
        for page_num in range(total_pages):
            text = ""

            try:
                page = doc[page_num]
                text = page.get_text().strip()

                if not text:
                    matrix = fitz.Matrix(1.5, 1.5)
                    pix = page.get_pixmap(matrix=matrix)
                    image = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
                    result = ocr.ocr(np.array(image), cls=True)

                    if result and result[0]:
                        lines = [line[1][0] for line in result[0] if line[1][0].strip()]
                        text = "\n".join(lines).strip()
            except Exception as page_err:
                log_to_db(
                    db_path,
                    book_id,
                    "warn",
                    "OCR skipped page",
                    f"page {page_num + 1}: {str(page_err)[:200]}",
                )

            if text:
                pages_text.append(text)

            update_ocr_progress(db_path, book_id, page_num + 1, total_pages)

            if (page_num + 1) % 10 == 0 or page_num + 1 == total_pages:
                log_to_db(
                    db_path,
                    book_id,
                    "info",
                    "OCR progress",
                    f"bookId={book_id}, pages={page_num + 1}/{total_pages}",
                )
    finally:
        doc.close()

    marked_parts: list[str] = []
    for i, text in enumerate(pages_text):
        marked_parts.append(f"--- PAGE {i + 1} ---\n{text}")
    return "\n\n".join(marked_parts)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf_path")
    parser.add_argument("--book-id", type=int, required=True)
    parser.add_argument("--db-path", required=True)
    args = parser.parse_args()

    db_path = args.db_path
    book_id = args.book_id

    log_to_db(
        db_path,
        book_id,
        "info",
        "OCR started",
        f"bookId={book_id}, file={args.pdf_path}",
    )

    try:
        text = extract_text_from_pdf(args.pdf_path, db_path, book_id)
    except Exception as error:
        log_to_db(db_path, book_id, "error", "OCR failed", str(error))
        set_parse_status(db_path, book_id, "error")
        return 1

    if not text.strip():
        log_to_db(db_path, book_id, "error", "OCR returned empty text", f"bookId={book_id}")
        set_parse_status(db_path, book_id, "error")
        return 1

    conn = sqlite3.connect(db_path)
    conn.execute(
        "UPDATE books SET raw_text=?, parse_status='done' WHERE id=?",
        (text, book_id),
    )
    conn.commit()
    conn.close()

    log_to_db(db_path, book_id, "info", "OCR finished", f"bookId={book_id}, chars={len(text)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

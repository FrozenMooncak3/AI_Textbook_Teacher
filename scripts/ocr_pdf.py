#!/usr/bin/env python3
"""
OCR PDF 文字提取脚本（PaddleOCR 版本）
用法：python scripts/ocr_pdf.py <pdf_path> --book-id <id> --db-path <path>
完成后直接更新 SQLite 数据库中的 books 表。
"""
import sys
import io
import argparse
import sqlite3
from pathlib import Path

import fitz  # PyMuPDF
import numpy as np
from PIL import Image
from paddleocr import PaddleOCR


def log_to_db(db_path: str, book_id: int, level: str, action: str, details: str) -> None:
    try:
        conn = sqlite3.connect(db_path)
        conn.execute(
            'INSERT INTO logs (level, action, details) VALUES (?, ?, ?)',
            (level, action, details)
        )
        conn.commit()
        conn.close()
    except Exception:
        pass


def update_ocr_progress(db_path: str, book_id: int, current_page: int, total_pages: int) -> None:
    """每页更新 ocr_current_page，供前端轮询。"""
    try:
        conn = sqlite3.connect(db_path)
        conn.execute(
            "UPDATE books SET ocr_current_page=?, ocr_total_pages=?, parse_status='processing' WHERE id=?",
            (current_page, total_pages, book_id)
        )
        conn.commit()
        conn.close()
    except Exception:
        pass


def extract_text_from_pdf(pdf_path: str, db_path: str, book_id: int) -> str:
    # 初始化 PaddleOCR（首次运行会自动下载模型，约 30MB）
    ocr = PaddleOCR(
        use_angle_cls=True,
        lang='ch',
        use_gpu=False,
        show_log=False,
    )

    doc = fitz.open(pdf_path)
    total_pages = doc.page_count
    pages_text = []

    # 先写入总页数
    update_ocr_progress(db_path, book_id, 0, total_pages)

    for page_num in range(total_pages):
        page = doc[page_num]

        # 先尝试直接提取文字层（电子版 PDF）
        text = page.get_text().strip()

        if not text:
            try:
                mat = fitz.Matrix(1.5, 1.5)
                pix = page.get_pixmap(matrix=mat)
                img = Image.open(io.BytesIO(pix.tobytes('png'))).convert('RGB')
                img_array = np.array(img)
                result = ocr.ocr(img_array, cls=True)
                if result and result[0]:
                    lines = [line[1][0] for line in result[0] if line[1][0].strip()]
                    text = '\n'.join(lines).strip()
            except Exception as page_err:
                log_to_db(db_path, book_id, 'warn', 'OCR 跳过坏页',
                          f'第 {page_num + 1} 页：{str(page_err)[:200]}')

        if text:
            pages_text.append(text)

        # 每页更新进度（供前端实时轮询）
        update_ocr_progress(db_path, book_id, page_num + 1, total_pages)

        # 每 10 页写一条日志
        if (page_num + 1) % 10 == 0 or page_num + 1 == total_pages:
            log_to_db(
                db_path, book_id, 'info', 'OCR 进度',
                f'bookId={book_id}，{page_num + 1}/{total_pages} 页'
            )

    doc.close()
    return '\n\n'.join(pages_text)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('pdf_path')
    parser.add_argument('--book-id', type=int, required=True)
    parser.add_argument('--db-path', required=True)
    args = parser.parse_args()

    db_path = args.db_path
    book_id = args.book_id

    log_to_db(db_path, book_id, 'info', 'OCR 开始', f'bookId={book_id}，文件：{args.pdf_path}')

    try:
        text = extract_text_from_pdf(args.pdf_path, db_path, book_id)
    except Exception as e:
        log_to_db(db_path, book_id, 'error', 'OCR 失败', str(e))
        conn = sqlite3.connect(db_path)
        conn.execute(
            "UPDATE books SET parse_status='error' WHERE id=?", (book_id,)
        )
        conn.commit()
        conn.close()
        return 1

    if not text.strip():
        log_to_db(db_path, book_id, 'error', 'OCR 提取文字为空', f'bookId={book_id}')
        conn = sqlite3.connect(db_path)
        conn.execute(
            "UPDATE books SET parse_status='error' WHERE id=?", (book_id,)
        )
        conn.commit()
        conn.close()
        return 1

    conn = sqlite3.connect(db_path)
    conn.execute(
        "UPDATE books SET raw_text=?, parse_status='done' WHERE id=?",
        (text, book_id)
    )
    conn.commit()
    conn.close()

    log_to_db(db_path, book_id, 'info', 'OCR 完成', f'bookId={book_id}，字数：{len(text)}')
    return 0


if __name__ == '__main__':
    sys.exit(main())

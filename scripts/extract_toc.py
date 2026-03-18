#!/usr/bin/env python3
"""从 PDF 提取书签目录，输出 JSON 格式。

用法：python scripts/extract_toc.py <pdf_path>
输出：[{"title": "...", "page": 1, "level": 1}, ...]
"""

import sys
import json

import fitz  # PyMuPDF


def main() -> None:
    if len(sys.argv) < 2:
        print("用法: python extract_toc.py <pdf_path>", file=sys.stderr)
        sys.exit(1)

    pdf_path = sys.argv[1]
    doc = fitz.open(pdf_path)
    toc = doc.get_toc()
    doc.close()

    items = []
    for level, title, page in toc:
        title = title.strip()
        if title:
            items.append({"title": title, "page": page, "level": level})

    sys.stdout.reconfigure(encoding="utf-8")
    print(json.dumps(items, ensure_ascii=False))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""HTTP wrapper around PaddleOCR for screenshot recognition."""

import json
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

import numpy as np
from PIL import Image, ImageOps
from paddleocr import PaddleOCR

print("Loading PaddleOCR model...", flush=True)
ocr_engine = PaddleOCR(use_angle_cls=True, lang="ch", use_gpu=False, show_log=False)
print("PaddleOCR model loaded", flush=True)


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


class OCRHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        if self.path == "/health":
            self._json_response({"status": "ok"})
        else:
            self._json_response({"error": "Not found"}, 404)

    def do_POST(self) -> None:
        if self.path != "/ocr":
            self._json_response({"error": "Not found"}, 404)
            return

        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length))
            image_path = body.get("image_path", "")

            if not image_path:
                self._json_response({"error": "missing image_path"}, 400)
                return

            image = preprocess_image(image_path)
            result = ocr_engine.ocr(np.array(image), cls=True)
            lines, confidence = extract_lines(result)

            self._json_response({"text": "\n".join(lines), "confidence": confidence})
        except Exception as error:
            self._json_response({"error": str(error)}, 500)

    def _json_response(self, data: dict, status: int = 200) -> None:
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args: object) -> None:
        pass


def main() -> None:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 9876
    server = HTTPServer(("127.0.0.1", port), OCRHandler)
    print(f"OCR server listening on http://127.0.0.1:{port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nOCR server stopped")
        server.server_close()


if __name__ == "__main__":
    main()

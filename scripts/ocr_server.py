#!/usr/bin/env python3
"""
PaddleOCR 常驻 HTTP 服务。
启动时加载一次模型，之后通过 HTTP 接收图片路径，返回 OCR 文字。

用法：python scripts/ocr_server.py [port]
默认端口：9876

API：
  POST /ocr  body: {"image_path": "/tmp/xxx.png"}
  返回: {"text": "识别出的文字"} 或 {"error": "..."}

  GET /health
  返回: {"status": "ok"}
"""
import sys
import json
import numpy as np
from http.server import HTTPServer, BaseHTTPRequestHandler
from PIL import Image
from paddleocr import PaddleOCR

# 全局：启动时加载一次模型
print("正在加载 PaddleOCR 模型...", flush=True)
ocr_engine = PaddleOCR(use_angle_cls=True, lang='ch', use_gpu=False, show_log=False)
print("PaddleOCR 模型加载完成", flush=True)


class OCRHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        if self.path == '/health':
            self._json_response({"status": "ok"})
        else:
            self._json_response({"error": "Not found"}, 404)

    def do_POST(self) -> None:
        if self.path != '/ocr':
            self._json_response({"error": "Not found"}, 404)
            return

        try:
            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length))
            image_path = body.get('image_path', '')

            if not image_path:
                self._json_response({"error": "missing image_path"}, 400)
                return

            img = Image.open(image_path).convert('RGB')
            result = ocr_engine.ocr(np.array(img), cls=True)

            lines: list[str] = []
            if result and result[0]:
                lines = [line[1][0] for line in result[0] if line[1][0].strip()]

            self._json_response({"text": '\n'.join(lines)})
        except Exception as e:
            self._json_response({"error": str(e)}, 500)

    def _json_response(self, data: dict, status: int = 200) -> None:
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args: object) -> None:
        # 静默常规请求日志，只打印错误
        pass


def main() -> None:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 9876
    server = HTTPServer(('127.0.0.1', port), OCRHandler)
    print(f"OCR 服务已启动: http://127.0.0.1:{port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nOCR 服务已停止")
        server.server_close()


if __name__ == '__main__':
    main()

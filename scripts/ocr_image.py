#!/usr/bin/env python3
"""
截图 OCR 脚本
用法：python scripts/ocr_image.py <image_path>
输出：识别出的文字（UTF-8，stdout）
"""
import sys
import numpy as np
from PIL import Image
from paddleocr import PaddleOCR


def main() -> int:
    if len(sys.argv) < 2:
        print('用法: ocr_image.py <image_path>', file=sys.stderr)
        return 1

    img_path = sys.argv[1]

    try:
        ocr = PaddleOCR(use_angle_cls=True, lang='ch', show_log=False)
        img = Image.open(img_path).convert('RGB')
        result = ocr.ocr(np.array(img), cls=True)

        lines = []
        if result and result[0]:
            lines = [line[1][0] for line in result[0] if line[1][0].strip()]

        # 输出到 stdout，Node.js 读取
        sys.stdout.buffer.write('\n'.join(lines).encode('utf-8'))
        return 0
    except Exception as e:
        print(f'ERROR: {e}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())

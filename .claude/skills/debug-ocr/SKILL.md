---
description: 排查 PaddleOCR / 截图 OCR / ocr_server.py 相关问题
globs: scripts/ocr_*.py, src/app/api/**/screenshot*
alwaysApply: false
---

# Debug OCR

## 何时使用
- OCR 识别结果为空或乱码
- ocr_server.py 无响应或超时
- OCR 进度卡住不动
- 截图问 AI 返回"无法识别"

## 排查步骤

1. **检查 ocr_server.py 是否运行**
   - `curl http://localhost:8765/health`
   - 如果不通：`python scripts/ocr_server.py` 启动

2. **检查日志**
   - 访问 http://localhost:3000/logs 或 GET /api/logs
   - 搜索 action 含 "ocr" 的日志条目

3. **检查 OCR 进度**
   - GET /api/books/[bookId]/status
   - 确认 ocrCurrentPage 是否在增长

4. **测试单页 OCR**
   - `python scripts/ocr_pdf.py data/uploads/[bookId].pdf --page 1`
   - 确认输出是否有文字

5. **检查截图 OCR**
   - 确认请求体中 imageBase64 格式正确（data:image/png;base64,...）
   - 检查 ocr_server.py 的 stderr 输出

## 常见问题
- **模型加载超时**：ocr_server.py 首次启动需 10-20s 加载模型，之后请求 < 5s
- **端口冲突**：默认 8765，检查是否被占用
- **图片格式错误**：必须是 base64 编码的 PNG/JPG

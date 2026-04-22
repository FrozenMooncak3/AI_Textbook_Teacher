-- scripts/cleanup-stuck-books-m4.6.sql
-- M4.6 清理 OCR hang 期间 stuck 的 books（book id 10, 11, 12）
-- 流程：先跑 SELECT 段 → 把结果贴进 docs/journal/2026-04-22-stuck-books-snapshot.md
--      → 再跑 DELETE 段
-- modules 表通过 ON DELETE CASCADE 自动清；R2 对象保留，由用户日后重传同 PDF 复用。

-- ============================================================
-- STEP 1: SELECT - 验证 + 备份（把输出存到 journal snapshot）
-- ============================================================
SELECT
  id,
  user_id,
  title,
  file_size,
  parse_status,
  kp_extraction_status,
  upload_status,
  ocr_total_pages,
  scanned_pages_count,
  file_path,
  created_at
FROM books
WHERE id IN (10, 11, 12)
ORDER BY id;

-- 同时看看 modules 表里挂了多少行（cascade 删之前先数一下）
SELECT book_id, COUNT(*) AS module_count
FROM modules
WHERE book_id IN (10, 11, 12)
GROUP BY book_id
ORDER BY book_id;

-- ============================================================
-- STEP 2: DELETE - 实际清理（跑 Step 1 确认无误后再跑这段）
-- ============================================================
-- modules 表通过 ON DELETE CASCADE 自动清掉（见 schema.sql:71-73）
DELETE FROM books WHERE id IN (10, 11, 12);

-- 验证：应返回 0 行
SELECT id, title FROM books WHERE id IN (10, 11, 12);

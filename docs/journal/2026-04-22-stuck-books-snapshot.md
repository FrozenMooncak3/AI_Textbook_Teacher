# Stuck Books 10/11/12 清理前快照（M4.6）

**日期：** 2026-04-22
**清理脚本：** `scripts/cleanup-stuck-books-m4.6.sql`

---

## 背景

M4.5 收尾 live E2E 测试（2026-04-22）暴露：Vercel Function → Cloud Run OCR 调用 4-6 分钟 hang（`TypeError: fetch failed`），books 10/11/12 上传 confirm 成功但 `runClassifyAndExtract` 全程卡死，DB 里留下 stuck artifacts：

- `parse_status` 卡在 `pending`（未进 `done` / `error`）
- `kp_extraction_status` 卡在 `pending`（OCR 未完成 → KP 抽取未触发）
- 有的可能连 modules 行都没建（`extract-text` 返回前就超时）

**清理动作：**
- `DELETE FROM books WHERE id IN (10, 11, 12)` — cascade 自动删 modules
- R2 对象**保留**（日后重传同 PDF 可复用，省带宽 + 留诊断样本）

---

## 清理前 books 状态

_运行 `scripts/cleanup-stuck-books-m4.6.sql` STEP 1 的 SELECT，把输出贴在下面_

| id | user_id | title | file_size | parse_status | kp_extraction_status | upload_status | ocr_total_pages | scanned_pages_count | file_path | created_at |
|----|---------|-------|-----------|--------------|----------------------|---------------|-----------------|---------------------|-----------|-----------|
| 10 | 1 | `epa_sample_letter_sent_to_commissioners_dated_february_29_2015` | 2024538 (2.0MB) | done | pending | confirmed | 3 | 3 | `null` | 2026-04-21T17:15:53.210Z |
| 11 | 1 | `΢��ͼƬ����_T13T14��֤`（MBCS 乱码） | 117676 (115KB) | error | pending | confirmed | 1 | 1 | `null` | 2026-04-22T02:41:13.742Z |
| 12 | 1 | `΢��ͼƬ����_v2`（MBCS 乱码） | 117676 (115KB) | error | pending | confirmed | 1 | 1 | `null` | 2026-04-22T02:49:14.026Z |

---

## 清理前 modules 挂行数

_同上，跑第二段 SELECT_

| book_id | module_count |
|---------|--------------|
| 10 | 1 |
| 11 | 0（SELECT 未返回该 book_id 行，说明 modules 未建） |
| 12 | 0（同上） |

---

## 失败摘要

- **book 10**：2MB EPA sample PDF（M4.5 T13 retry 期间产物），OCR 通过（`parse_status=done`，3 页全 scanned），但 `kp_extraction_status` 卡在 `pending`——M4.5 hotfix 链修完 OCR trigger 后未追加 KP 触发。`file_path=null` 说明 R2 上传元数据未回写（上传流程早期 bug 残留），DB 行实质已是孤儿。1 个 modules 行走 cascade。
- **book 11**：MBCS 乱码标题（微信图片 `T13T14 验证`，115KB 截图测试），`parse_status=error`。上传在 Vercel → Cloud Run fetch hang 路径暴露后失败（M4.5 T13T14 诊断样本）。无 modules。
- **book 12**：同 book 11，二次验证（v2），115KB。
- **注：** 原 plan 描述 "book 11 = 14MB 真书" 的 stuck——DB 实际未留 14MB 书 ID；那次 hang 可能对应更早的 book ID，已在 M4.5 hotfix 期间清或未 insert 成功。10/11/12 是当前 DB 可见的三条 stuck/orphan 行，仍按 plan 清理。

---

## R2 文件位置

R2 对象 key = `file_path` 字段值（见上表"清理前 books 状态"）。

**R2 策略：** 不删。M4.6 修复上线后，用户可直接重传同一 PDF 到前端验证；若重传走 R2 dedup（presigned URL 对同一 PDF 会生成相同 key）可能复用旧对象。即使生成新 key，旧对象也仅占几十 MB，保留作诊断样本不影响 cost。

---

## 诊断 trail

- 外部 curl 探测 OCR 服务：`curl https://ai-textbook-ocr-<hash>.us-central1.run.app/classify-pdf` 返 401（未带 Bearer）或 200（带正确 ID token），4.5s 以内
- Vercel function logs：`runClassifyAndExtract` 进入后无后续日志，直到超时（Fluid 300s）+ `fetch failed` 抛出
- 尝试 1（Phase A，2026-04-22 同 commit redeploy）：`dpl_C7HDhBS8gQsJZwAbeqfDXtupKziB` PROMOTED，未 live 验证
- 尝试 2（Phase B，2026-04-22）：`OCR_REQUIRE_IAM_AUTH=false` → Cloud Run 服务侧硬要求 IAM invoker，1.3s 内返 403，路径不可行，env 已恢复 `true`
- 关键代码发现：`src/lib/ocr-auth.ts:21-40` `buildOcrHeaders()` 每次 fetch 都重新 `getIdTokenClient(audience)`，`IdTokenClient` 未缓存 → 每次 fetch = 1 次 OAuth 换证 round-trip → 3 次 fetch = 3 次 OAuth

---

## M4.6 修复方案

详见 `docs/superpowers/specs/2026-04-22-m4.6-ocr-pipeline-design.md`：

1. `src/lib/ocr-auth.ts` 加 `Map<audience, IdTokenClient>` 缓存（T1）
2. `src/lib/upload-flow.ts` 3 处 fetch 加 `AbortSignal.timeout(30_000)` + `retryWithBackoff` 重试 1 次（T2）
3. 本脚本清 stuck DB 行（T3）
4. `docs/m4.6-test-checklist.md` 用户 live 验证（T5）

---

## 下一步

M4.6 workaround 上线后，用户重传同一批 PDF 验证：

- ✅ 通过 → 本快照归档，R2 对象可按需清理（或保留 60 天）
- ❌ 未通过 → 走 T6B 诊断阶段，加 instrumentation 定位 hang 真正点

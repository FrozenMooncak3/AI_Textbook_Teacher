# Session-Init F.3 实施计划

**Spec**: [2026-04-18-session-init-F2-redesign.md](../specs/2026-04-18-session-init-F2-redesign.md)
**Date**: 2026-04-18
**Executor**: Claude 全程执行（用户显式授权，bash 脚本不派 Codex）
**Estimated time**: 单次 session 可完成（约 2-3 小时）

---

## 任务顺序

- [ ] **T0. 停车场清理**（前置）
- [ ] **T1. L1 裁剪：重写 project_status.md**
- [ ] **T2. tokenizer 实测验证**
- [ ] **T3. 写 SessionStart hook 脚本**
- [ ] **T4. 写 PreCompact save hook 脚本**
- [ ] **T5. 改 .claude/settings.json**
- [ ] **T6. 瘦身 session-init SKILL.md**
- [ ] **T7. 改 CLAUDE.md**
- [ ] **T8. 实装测试：新 session + /context**
- [ ] **T9. 手动触发 compact 验证拦截**
- [ ] **T10. 结果记录 + 完成**

---

## T0. 停车场清理

**目标**：过一遍 `docs/journal/INDEX.md` 的 parked 段，分流清理。

**步骤**：
1. Read `docs/journal/INDEX.md`，列出所有 parked 条目
2. 对每条生成建议（`[纳入 M?]` / `[继续停]` / `[删除]`），带一句话理由
3. 输出清单给用户批准
4. 用户批准后 Edit INDEX.md 反映分流结果
5. 若分流中发现"已完成但未迁移"的条目（比如 M6 相关），移到 `INDEX-resolved.md`

**决策点**：用户可选"full triage"或"轻清理（只处理明显过期项）"。步骤 1 开始时确认。

**验收**：INDEX.md 的 parked 段不再包含已完成 / 明显偏离主线的条目。

---

## T1. L1 裁剪：重写 project_status.md

**目标**：按 spec §3.1 新模板重写 `docs/project_status.md`，目标 ≤2k tokens，上限 4k。

**步骤**：
1. Read 当前 `docs/project_status.md`（10.9KB ≈ 3.5-4k tokens）
2. Read `docs/decisions.md` 抽最近 10 条决策摘要
3. 按 4 段模板重写：当前里程碑 / 最近关键决策 / 文件地图 / 未决问题
4. 每条决策一行，格式：`- YYYY-MM-DD <摘要> → [链接]`
5. Write 回 project_status.md

**验收**：文件 `wc -c` ≤ 8KB（对应 ~2k 中文 tokens），结构严格按模板。

---

## T2. tokenizer 实测验证

**目标**：确认 T1 裁剪后的 project_status 真 ≤4k tokens。

**步骤**：
1. 若系统有 tiktoken：`python -c "import tiktoken; enc=tiktoken.get_encoding('cl100k_base'); print(len(enc.encode(open('docs/project_status.md').read())))"`
2. 若无 tiktoken：按中文字符数 × 1.35 估算（10KB 中文 ≈ 3.5-4k tokens）
3. 超 4k → 回 T1 继续裁（优先砍决策段到 5 条）

**验收**：实测 ≤4k tokens，理想 ≤2k。

---

## T3. 写 SessionStart hook 脚本

**目标**：实现 spec §3.2 的 `scripts/hooks/session-start-inject.sh`。

**文件**：`scripts/hooks/session-start-inject.sh`（新建）

**内容骨架**：
```bash
#!/bin/bash
# session-start-inject.sh — 把 docs/project_status.md 注入 Claude context
# 所有失败路径 echo '{}' && exit 0，禁 set -e

PROJECT_STATUS="docs/project_status.md"

# 文件不存在 → 空注入
if [ ! -f "$PROJECT_STATUS" ]; then
  echo '{}'
  exit 0
fi

# 读文件内容，超 8KB 截断
CONTENT=$(cat "$PROJECT_STATUS" 2>/dev/null || echo "")
if [ -z "$CONTENT" ]; then
  echo '{}'
  exit 0
fi

# 长度防护：超 8KB 截断
MAX_BYTES=8192
if [ "$(printf '%s' "$CONTENT" | wc -c)" -gt "$MAX_BYTES" ]; then
  CONTENT=$(printf '%s' "$CONTENT" | head -c "$MAX_BYTES")
  CONTENT="${CONTENT}

[... truncated, see full file at docs/project_status.md]"
fi

# 注入包装
WRAPPER='<!-- Injected by SessionStart hook from docs/project_status.md. This is the authoritative snapshot of current project state. Use the file map to decide where to read for deeper context; do NOT eager-read INDEX files. -->

'
FULL="${WRAPPER}${CONTENT}"

# JSON 转义：主路径 sed（git bash 默认无 jq）
if command -v jq >/dev/null 2>&1; then
  FULL_JSON=$(printf '%s' "$FULL" | jq -Rs .)
  OUTPUT=$(printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":%s}}\n' "$FULL_JSON")
else
  ESC=$(printf '%s' "$FULL" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' | awk 'BEGIN{ORS=""} NR>1{print "\\n"} {print}')
  OUTPUT=$(printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "$ESC")
fi

# 自检（若有 jq）
if command -v jq >/dev/null 2>&1; then
  if ! printf '%s' "$OUTPUT" | jq . >/dev/null 2>&1; then
    echo '{}'
    exit 0
  fi
fi

printf '%s' "$OUTPUT"
exit 0
```

**验收**：
- `bash scripts/hooks/session-start-inject.sh | jq .`（若装了 jq）能解析出合法 JSON
- 空 stdin 下不报错
- 手动删除 project_status.md 后运行，输出 `{}`

---

## T4. 写 PreCompact save hook 脚本

**目标**：实现 spec §3.8 的 `scripts/hooks/pre-compact-save.sh`。

**文件**：`scripts/hooks/pre-compact-save.sh`（新建）

**内容**：直接照抄 spec §3.8 的脚本逻辑（已经过三轮 review 验证，sed-only 无 python 依赖，含自检）。

**验收**：
- `echo '{"session_id":"test-abc"}' | bash scripts/hooks/pre-compact-save.sh | jq .` 输出合法 JSON，含 `decision: "block"` 和 `reason` 字段
- 第二次运行（flag 已存在）输出 `{}`
- 空 stdin 输出合法 JSON 或 `{}`

---

## T5. 改 .claude/settings.json

**文件**：`.claude/settings.json`（修改）

**改动**：按 spec §3.3 结构，在现有 hooks 对象中：
1. SessionStart 的 `startup|clear` matcher 的 hooks 数组：第一条 rm 扩展到 `.ccb/precompact-saved-*`；第二条新增 `session-start-inject.sh`
2. PreCompact 数组追加 `pre-compact-save.sh`（保留现有 `pre-compact-check.sh`）

**验收**：`bash -n` 不报错（settings.json 是 JSON 不是 bash，实际验证是 `jq . .claude/settings.json`）。

---

## T6. 瘦身 session-init SKILL.md

**文件**：`.claude/skills/session-init/SKILL.md`（重写）

**内容**：按 spec §3.4 的新全文写入（含 resume 场景检测步骤），约 30 行。

**验收**：
- 文件 ≤ 1.5KB
- frontmatter 正确
- 包含 resume 场景检测（步骤 1）、git status（步骤 2）、停车场判断（步骤 3）、仪表盘模板、行为契约

---

## T7. 改 CLAUDE.md

**文件**：`CLAUDE.md`（修改）

**改动**：
1. "Skill 使用"段改写为 spec §3.5 的新版本（提 SessionStart hook 注入）
2. "禁止事项"段追加一行：`- 禁止 project_status.md 鲜度失守（里程碑切换 / 关键决策 / architecture 变动 / 新 spec 产生 / 阻塞变化时必须同步更新）`

**验收**：改动只在这两段，其他内容不动。

---

## T8. 实装测试：新 session + /context

**步骤**：
1. git add + commit 所有改动
2. 用户在新 terminal 开 Claude Code 新 session
3. 跑 `/context`，记录非 MCP 占比
4. 和基线 28.8k / 32% 对比

**验收**：
- 默认路径（扫停车场）非 MCP ≤ 18k
- SessionStart hook 确实把 project_status 注入了（Claude 第一轮能引用里面内容而未调 Read）
- SKILL.md 瘦身生效（session-init 调用不再拉 INDEX）

**不达标处理**：回 T1 再裁 project_status，或按 spec §6 步骤 5 压缩决策段到 5 条。

---

## T9. 手动触发 compact 验证拦截

**步骤**：
1. 在同一 session 让对话够长触发 compact（或用户手动 /compact 若 CLI 支持）
2. 观察 Claude 是否收到 "PreCompact checkpoint" 消息
3. Claude 更新 project_status.md 后 compact 是否继续
4. 检查 `.ccb/precompact-saved-<session_id>` 标志文件生成

**验收**：
- compact 前 Claude 被拦一次，收到 reason 并执行 Edit
- 同一 session 再次 compact 不再拦（幂等生效）
- project_status.md 反映本次 session 新决策

**不达标处理**：检查 settings.json 语法、脚本执行权限（`chmod +x`）、hook 日志。

---

## T10. 结果记录 + 完成

**步骤**：
1. 在 `docs/journal/2026-04-18-session-init-bloat-diagnosis.md` 追加 §10 章节，记录：
   - T8 /context 实测结果（新 baseline 数字）
   - T9 compact 拦截验证结果
   - 和 F.2 spec 预估的差值
2. 更新 `docs/journal/INDEX.md` 的 session-init 优化条目状态为 `resolved`
3. 更新 `docs/project_status.md` 的"最近关键决策"追加一条
4. 提示用户这次要同时更新 decisions.md 一条（F.3 上线）

**验收**：所有文档状态一致；`git status` 干净；用户确认功能符合预期。

---

## 回滚路径

任何一步失败可独立 `git revert`：
- T3/T4 hook 脚本失败 → revert 对应 commit，hook 退回现状
- T5 settings.json 改坏 → revert，hook 不触发
- T6 SKILL.md → revert，回 119 行旧版
- T1 project_status.md → revert，回 10.9KB 旧版

整体回滚：按 commit 粒度逆序 revert。零数据迁移、零二进制状态。

---

## 依赖和风险提醒

**CCB 边界例外**：T3/T4 的 bash 脚本在 `scripts/hooks/`，按 CLAUDE.md 默认属于 Codex。本次用户显式授权 Claude 直接写，原因：脚本 <100 行 bash，派发 round-trip 成本 > 直写成本。不作为永久规则。

**不实施的内容**：
- 不新增 Stop hook（MemPalace 风格每 N 次 save）
- 不引入 jq 作为硬依赖（项目不强制用户装）
- 不改 SKILL 的 compact/resume marker 策略以外的行为

**阻塞风险**：T2 实测若 project_status 无法压到 4k 以下，说明模板本身不够紧凑，需回 T1 调整模板（砍文件地图解释文字等）。

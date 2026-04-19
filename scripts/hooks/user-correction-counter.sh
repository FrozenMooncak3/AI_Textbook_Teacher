#!/usr/bin/env bash
# M3/M4 UserPromptSubmit 纠错词计数 — system evolution spec 2026-04-19 §2.1.2
# Detects user correction keywords, counts per session. At 2 injects warning, at 3 injects stop hint.
# session-rules 规则 3 (同问题 >=2 systematic-debugging) 的量化实现。

# Kill switch (see CLAUDE.md 技术红线)
if [ "${AI_SYSTEM_EVOLUTION_DISABLE:-0}" = "1" ]; then
  exit 0
fi

set -uo pipefail
trap 'mkdir -p .ccb/counters 2>/dev/null || true; echo "[hook-error] user-correction-counter $(date -Iseconds 2>/dev/null || date) rc=$?" >> .ccb/counters/hook-errors.log 2>/dev/null || true; exit 0' ERR

INPUT=$(cat)

# Parse stdin with node
PARSED=$(echo "$INPUT" | node -e "
  let d='';
  process.stdin.on('data', c => d += c);
  process.stdin.on('end', () => {
    try {
      const j = JSON.parse(d);
      console.log(JSON.stringify({
        session_id: j.session_id || '',
        prompt: (j.prompt || '').slice(0, 2000)
      }));
    } catch(e) {
      console.log(JSON.stringify({session_id:'', prompt:''}));
    }
  });
" 2>/dev/null)

[ -z "$PARSED" ] && exit 0

SESSION_ID=$(echo "$PARSED" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).session_id)}catch{console.log('')}})")
PROMPT=$(echo "$PARSED" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).prompt)}catch{console.log('')}})")

# session_id fallback chain
if [ -z "$SESSION_ID" ]; then
  SESSION_ID="${CLAUDE_SESSION_ID:-}"
fi
if [ -z "$SESSION_ID" ] && [ -f .ccb/session-marker ]; then
  SESSION_ID=$(head -n1 .ccb/session-marker 2>/dev/null || echo "")
fi
if [ -z "$SESSION_ID" ]; then
  SESSION_ID="fallback-$(echo "$PWD$$" | md5sum 2>/dev/null | cut -c1-8 || echo "nohash")"
fi

# Narrow keyword list — removed 不是/别/停 (high false-positive words)
# Chinese: 不对 重来 错了 重新 不行 搞错 弄错
# English (word-boundary): wrong redo "no that's" "that's wrong" stop
HIT=0
if echo "$PROMPT" | grep -qE '不对|重来|错了|重新|不行|搞错|弄错'; then
  HIT=1
fi
if [ "$HIT" = "0" ] && echo "$PROMPT" | grep -qiE "\\bwrong\\b|\\bredo\\b|no that'?s|that'?s wrong|\\bstop\\b"; then
  HIT=1
fi

if [ "$HIT" = "1" ]; then
  mkdir -p .ccb/counters
  COUNT_FILE=".ccb/counters/user-corrections-${SESSION_ID}.count"
  COUNT=$(cat "$COUNT_FILE" 2>/dev/null || echo 0)
  COUNT=$((COUNT + 1))
  echo "$COUNT" > "$COUNT_FILE"

  if [ "$COUNT" -ge 3 ]; then
    node -e "console.log(JSON.stringify({hookSpecificOutput:{hookEventName:'UserPromptSubmit',additionalContext:'🛑 本 session 已检测到用户 3 次纠错。按 Anthropic best-practices 建议 /clear 或明确回到 Phase 1 根因诊断。'}}))"
  elif [ "$COUNT" -eq 2 ]; then
    node -e "console.log(JSON.stringify({hookSpecificOutput:{hookEventName:'UserPromptSubmit',additionalContext:'⚠️ 本 session 已检测到用户 2 次纠错。触发 session-rules 规则 3：若同一问题再次失败，必须走 systematic-debugging，不得继续尝试修复。'}}))"
  fi
fi

exit 0

#!/usr/bin/env bash
# M2 PostToolUse Bash failure capture — system evolution spec 2026-04-19
# Writes failed Bash tool invocations to .ccb/counters/ + docs/journal/ (whitelist)
# Injects additionalContext back to Claude.

# Kill switch (see CLAUDE.md 技术红线)
if [ "${AI_SYSTEM_EVOLUTION_DISABLE:-0}" = "1" ]; then
  exit 0
fi

set -uo pipefail
trap 'mkdir -p .ccb/counters 2>/dev/null || true; echo "[hook-error] post-tool-failure-capture $(date -Iseconds 2>/dev/null || date) rc=$?" >> .ccb/counters/hook-errors.log 2>/dev/null || true; exit 0' ERR

INPUT=$(cat)

# Parse stdin JSON with node (Claude Code hook input v2025 schema)
PARSED=$(echo "$INPUT" | node -e "
  let d='';
  process.stdin.on('data', c => d += c);
  process.stdin.on('end', () => {
    try {
      const j = JSON.parse(d);
      const r = j.tool_response || {};
      const i = j.tool_input || {};
      const exitCode = (typeof r.exit_code === 'number') ? r.exit_code : 0;
      const tool = j.tool_name || 'unknown';
      const cmd = (i.command || '').slice(0, 200);
      const stderr = (r.stderr || '').slice(0, 300);
      console.log(JSON.stringify({exitCode, tool, cmd, stderr}));
    } catch(e) {
      console.log(JSON.stringify({exitCode:0, tool:'', cmd:'', stderr:''}));
    }
  });
" 2>/dev/null)

# Require parse success
[ -z "$PARSED" ] && exit 0

EXIT_CODE=$(echo "$PARSED" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).exitCode)}catch{console.log(0)}})")

# Skip normal results
if [ "$EXIT_CODE" = "0" ] || [ -z "$EXIT_CODE" ]; then
  exit 0
fi

TOOL=$(echo "$PARSED" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).tool)}catch{console.log('')}})")
CMD=$(echo "$PARSED" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).cmd)}catch{console.log('')}})")
STDERR=$(echo "$PARSED" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).stderr)}catch{console.log('')}})")
TS=$(date -Iseconds 2>/dev/null || date)

mkdir -p .ccb/counters

# Always append to counter log (JSON lines)
node -e "
  const line = JSON.stringify({
    ts: process.argv[1],
    tool: process.argv[2],
    exit_code: Number(process.argv[3]),
    cmd_head: process.argv[4],
    stderr_head: process.argv[5]
  });
  require('fs').appendFileSync('.ccb/counters/tool-failures.log', line + '\n');
" "$TS" "$TOOL" "$EXIT_CODE" "$CMD" "$STDERR" 2>/dev/null || true

# Whitelist: only "real workflow commands" upgrade to journal
if echo "$CMD" | grep -qE '^(codex:|gemini:|npm |pnpm |yarn |git |node |bash scripts/|docker )'; then
  DATE=$(date +%Y-%m-%d)
  JOURNAL="docs/journal/${DATE}-auto-tool-failures.md"
  if [ ! -f "$JOURNAL" ]; then
    {
      echo "# Auto Tool Failures — ${DATE}"
      echo ""
      echo "> 由 post-tool-failure-capture hook 自动生成。type: issue, status: open。"
      echo ""
    } > "$JOURNAL"
  fi
  {
    echo ""
    echo "## $TS — $TOOL failed (exit $EXIT_CODE)"
    echo "- **cmd**: \`$CMD\`"
    echo "- **stderr**: \`$STDERR\`"
    echo "- **status**: open"
    echo ""
  } >> "$JOURNAL"
fi

# Inject additionalContext back to Claude
node -e "
  const ctx = 'Bash failed (exit ' + process.argv[1] + '): ' + process.argv[2] + '. Consider diagnosing before retrying.';
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: ctx
    }
  }));
" "$EXIT_CODE" "$STDERR"

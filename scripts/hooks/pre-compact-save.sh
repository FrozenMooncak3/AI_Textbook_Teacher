#!/bin/bash
# pre-compact-save.sh — block compact once per session to force project_status.md refresh.
# Idempotent via .ccb/precompact-saved-<session_id> flag. All failure paths exit with {}.

INPUT=$(cat 2>/dev/null || echo '{}')

SESSION_ID=$(echo "$INPUT" | sed -n 's/.*"session_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
SESSION_ID=$(echo "$SESSION_ID" | tr -cd 'a-zA-Z0-9_-' | cut -c1-64)
[ -z "$SESSION_ID" ] && SESSION_ID="unknown"

FLAG_FILE=".ccb/precompact-saved-${SESSION_ID}"
if [ -f "$FLAG_FILE" ]; then
  echo '{}'
  exit 0
fi

mkdir -p .ccb 2>/dev/null || { echo '{}'; exit 0; }
touch "$FLAG_FILE" 2>/dev/null || { echo '{}'; exit 0; }

REASON='PreCompact checkpoint: before this session compacts, you MUST update docs/project_status.md to reflect any new decisions, milestone changes, architecture updates, or specs produced in this session. Only after the file is saved will compact proceed. This runs at most once per session_id.'

if command -v jq >/dev/null 2>&1; then
  REASON_JSON=$(printf '%s' "$REASON" | jq -Rs .)
  OUTPUT=$(printf '{"decision":"block","reason":%s}\n' "$REASON_JSON")
else
  REASON_ESC=$(printf '%s' "$REASON" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' | awk 'BEGIN{ORS=""} NR>1{print "\\n"} {print}')
  OUTPUT=$(printf '{"decision":"block","reason":"%s"}\n' "$REASON_ESC")
fi

if command -v jq >/dev/null 2>&1; then
  if ! printf '%s' "$OUTPUT" | jq . >/dev/null 2>&1; then
    echo '{}'
    exit 0
  fi
fi

printf '%s' "$OUTPUT"
exit 0

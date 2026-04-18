#!/bin/bash
# session-start-inject.sh — inject docs/project_status.md into Claude context
# Silent on failure: all paths exit with {} to avoid blocking session start.

PROJECT_STATUS="docs/project_status.md"

if [ ! -f "$PROJECT_STATUS" ]; then
  echo '{}'
  exit 0
fi

CONTENT=$(cat "$PROJECT_STATUS" 2>/dev/null || echo "")
if [ -z "$CONTENT" ]; then
  echo '{}'
  exit 0
fi

MAX_BYTES=8192
if [ "$(printf '%s' "$CONTENT" | wc -c)" -gt "$MAX_BYTES" ]; then
  CONTENT=$(printf '%s' "$CONTENT" | head -c "$MAX_BYTES")
  CONTENT="${CONTENT}

[... truncated, see full file at docs/project_status.md]"
fi

WRAPPER='<!-- Injected by SessionStart hook from docs/project_status.md. This is the authoritative snapshot of current project state. Use the file map to decide where to read for deeper context; do NOT eager-read INDEX files. -->

'
FULL="${WRAPPER}${CONTENT}"

if command -v jq >/dev/null 2>&1; then
  FULL_JSON=$(printf '%s' "$FULL" | jq -Rs .)
  OUTPUT=$(printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":%s}}\n' "$FULL_JSON")
else
  ESC=$(printf '%s' "$FULL" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' | awk 'BEGIN{ORS=""} NR>1{print "\\n"} {print}')
  OUTPUT=$(printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "$ESC")
fi

if command -v jq >/dev/null 2>&1; then
  if ! printf '%s' "$OUTPUT" | jq . >/dev/null 2>&1; then
    echo '{}'
    exit 0
  fi
fi

printf '%s' "$OUTPUT"
exit 0

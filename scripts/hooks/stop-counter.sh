#!/usr/bin/env bash
# H5+H6: Stop Counter
# Event: Stop
# Every 10 stops: lightweight git compliance check
# Every 50 stops: suggest /compact
# State file: .claude/.stop-count (gitignored, resets on session restart)

COUNTER_FILE=".claude/.stop-count"

# Initialize if missing
if [ ! -f "$COUNTER_FILE" ]; then
  mkdir -p "$(dirname "$COUNTER_FILE")"
  echo "0" > "$COUNTER_FILE"
fi

# Read, increment, write back
COUNT=$(cat "$COUNTER_FILE" 2>/dev/null || echo "0")
COUNT=$((COUNT + 1))
echo "$COUNT" > "$COUNTER_FILE"

OUTPUT=""

# Every 10 stops: lightweight compliance check
if [ $((COUNT % 10)) -eq 0 ]; then
  UNCOMMITTED=$(git status --porcelain 2>/dev/null | head -5)
  UNPUSHED=$(git log origin/master..HEAD --oneline 2>/dev/null)

  if [ -n "$UNCOMMITTED" ]; then
    OUTPUT="${OUTPUT}Uncommitted changes:\n${UNCOMMITTED}\n\n"
  fi
  if [ -n "$UNPUSHED" ]; then
    OUTPUT="${OUTPUT}Unpushed commits:\n${UNPUSHED}\n\n"
  fi
fi

# Every 50 stops: compact suggestion
if [ $((COUNT % 50)) -eq 0 ]; then
  OUTPUT="${OUTPUT}Context may be getting large (${COUNT} turns). Consider running /compact.\n"
fi

if [ -n "$OUTPUT" ]; then
  printf '%b' "$OUTPUT"
fi

exit 0

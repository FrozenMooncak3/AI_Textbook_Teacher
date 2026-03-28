#!/usr/bin/env bash
# H7: Pre-Compact Compliance Check
# Event: PreCompact
# Checks git state and status file updates before context compression.
# Output is advisory (does NOT block compact).
# Resets stop counter.

OUTPUT=""

# 1. Uncommitted changes
UNCOMMITTED=$(git status --porcelain 2>/dev/null | head -10)
if [ -n "$UNCOMMITTED" ]; then
  OUTPUT="${OUTPUT}Uncommitted changes:\n${UNCOMMITTED}\n\n"
fi

# 2. Unpushed commits
UNPUSHED=$(git log origin/master..HEAD --oneline 2>/dev/null)
if [ -n "$UNPUSHED" ]; then
  OUTPUT="${OUTPUT}Unpushed commits:\n${UNPUSHED}\n\n"
fi

# 3. Check if any modified files are outside Claude's file boundary
MODIFIED_FILES=$(git diff --name-only 2>/dev/null; git diff --cached --name-only 2>/dev/null)
BOUNDARY_VIOLATIONS=""
while IFS= read -r file; do
  [ -z "$file" ] && continue
  case "$file" in
    docs/*|.claude/skills/*|CLAUDE.md|AGENTS.md|GEMINI.md) ;;  # allowed
    *) BOUNDARY_VIOLATIONS="${BOUNDARY_VIOLATIONS}  ${file}\n" ;;
  esac
done <<< "$MODIFIED_FILES"

if [ -n "$BOUNDARY_VIOLATIONS" ]; then
  OUTPUT="${OUTPUT}Files modified outside Claude's boundary:\n${BOUNDARY_VIOLATIONS}\n"
fi

# 4. Check if status/changelog files were modified
STATUS_MOD=$(echo "$MODIFIED_FILES" | grep -c "docs/project_status.md")
CHANGELOG_MOD=$(echo "$MODIFIED_FILES" | grep -c "docs/changelog.md")
if [ "$STATUS_MOD" -eq 0 ] && [ "$CHANGELOG_MOD" -eq 0 ]; then
  OUTPUT="${OUTPUT}Neither project_status.md nor changelog.md modified in current changes.\n\n"
fi

# 5. Reset stop counter
echo "0" > ".claude/.stop-count" 2>/dev/null

if [ -n "$OUTPUT" ]; then
  printf 'Pre-compact compliance check:\n%b' "$OUTPUT"
fi

exit 0

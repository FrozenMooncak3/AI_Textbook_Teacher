#!/usr/bin/env bash
# H3: File Boundary Guard
# Event: PreToolUse | Matcher: Edit|Write
# Blocks edits to files outside Claude's writable boundary.
# Exit 0 = allow, exit 1 = block (with message on stdout).

# Read full JSON from stdin
INPUT=$(cat)

# Extract file_path via Node.js (guaranteed available in this project)
FILE_PATH=$(echo "$INPUT" | node -e "
  let d='';
  process.stdin.on('data', c => d += c);
  process.stdin.on('end', () => {
    try { console.log(JSON.parse(d).tool_input.file_path || ''); }
    catch { console.log(''); }
  });
")

# If path is empty or unreadable, allow (don't break on unexpected input)
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Normalize backslashes to forward slashes (Windows compatibility)
FILE_PATH=$(echo "$FILE_PATH" | tr '\\' '/')

# --- Compute relative path (3-layer approach for Windows/MSYS compat) ---
PROJECT_ROOT=$(pwd | tr '\\' '/')
REL_PATH="${FILE_PATH#$PROJECT_ROOT/}"

# Layer 2: MSYS path format conversion (/d/... -> d:/...)
if [ "$REL_PATH" = "$FILE_PATH" ]; then
  ALT_ROOT=$(echo "$PROJECT_ROOT" | sed 's|^/\([a-zA-Z]\)/|\1:/|')
  REL_PATH="${FILE_PATH#$ALT_ROOT/}"
fi

# --- Whitelist check ---
# Layer A: precise check using relative path
case "$REL_PATH" in
  docs/*|.claude/skills/*|CLAUDE.md|AGENTS.md|GEMINI.md) exit 0 ;;
esac

# Layer B: suffix fallback if relative path extraction failed
if [ "$REL_PATH" = "$FILE_PATH" ]; then
  case "$FILE_PATH" in
    */docs/*|*/.claude/skills/*|*/CLAUDE.md|*/AGENTS.md|*/GEMINI.md) exit 0 ;;
  esac
fi

# --- Not in whitelist: block ---
# Use REL_PATH for message if we got it, otherwise use full path
DISPLAY_PATH="$REL_PATH"
if [ "$DISPLAY_PATH" = "$FILE_PATH" ]; then
  DISPLAY_PATH="$FILE_PATH"
fi

echo "File boundary violation: $DISPLAY_PATH is outside Claude's writable scope."
echo "Allowed: docs/**, .claude/skills/**, CLAUDE.md, AGENTS.md, GEMINI.md"
exit 1

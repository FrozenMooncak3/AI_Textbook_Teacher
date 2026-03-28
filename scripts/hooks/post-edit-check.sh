#!/usr/bin/env bash
# H1+H2: Post-Edit Quality Check
# Event: PostToolUse | Matcher: Edit|Write
# H1: TypeScript typecheck after .ts/.tsx edits
# H2: console.log detection in src/ files
# Exit 0 always (PostToolUse is informational, not blocking).

INPUT=$(cat)

FILE_PATH=$(echo "$INPUT" | node -e "
  let d='';
  process.stdin.on('data', c => d += c);
  process.stdin.on('end', () => {
    try { console.log(JSON.parse(d).tool_input.file_path || ''); }
    catch { console.log(''); }
  });
")

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Normalize for consistent pattern matching
FILE_PATH=$(echo "$FILE_PATH" | tr '\\' '/')
OUTPUT=""

# --- H1: TypeScript typecheck (only for .ts/.tsx files) ---
case "$FILE_PATH" in
  *.ts|*.tsx)
    # 15-second timeout via Node.js (portable â€” Windows 'timeout' is a different command)
    TSC_OUTPUT=$(node -e "
      const { execSync } = require('child_process');
      try {
        const out = execSync('npx tsc --noEmit', {
          timeout: 15000, encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe']
        });
        process.stdout.write(out);
      } catch (e) {
        if (e.killed) { console.log('TSC_TIMEOUT'); process.exit(124); }
        process.stdout.write((e.stdout || '') + (e.stderr || ''));
        process.exit(1);
      }
    " 2>&1 | head -20)
    TSC_EXIT=${PIPESTATUS[0]}
    if [ "$TSC_EXIT" -eq 124 ]; then
      OUTPUT="${OUTPUT}TypeScript check timed out (>15s). Run manually: npx tsc --noEmit\n"
    elif [ "$TSC_EXIT" -ne 0 ]; then
      OUTPUT="${OUTPUT}TypeScript errors:\n${TSC_OUTPUT}\n\n"
    fi
    ;;
esac

# --- H2: console.log detection (only for files under src/) ---
case "$FILE_PATH" in
  */src/*)
    # Normalize path for grep (handle both Windows and MSYS formats)
    GREP_PATH="$FILE_PATH"
    CONSOLE_HITS=$(grep -n 'console\.\(log\|warn\|error\)' "$GREP_PATH" 2>/dev/null)
    if [ -n "$CONSOLE_HITS" ]; then
      OUTPUT="${OUTPUT}console.log detected in production code (technical red line):\n${CONSOLE_HITS}\n"
    fi
    ;;
esac

if [ -n "$OUTPUT" ]; then
  printf '%b' "$OUTPUT"
fi

exit 0

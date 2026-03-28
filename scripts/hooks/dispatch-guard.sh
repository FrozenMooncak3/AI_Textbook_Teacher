#!/usr/bin/env bash
# CCB Dispatch Guard
# Event: PreToolUse | Matcher: Bash
# Blocks wezterm dispatches to Codex/Gemini panes unless CCB protocol confirmed.
# Exit 0 = allow, exit 1 = block.

INPUT=$(cat)

COMMAND=$(echo "$INPUT" | node -e "
  let d='';
  process.stdin.on('data', c => d += c);
  process.stdin.on('end', () => {
    try { console.log(JSON.parse(d).tool_input.command || ''); }
    catch { console.log(''); }
  });
")

# Only care about wezterm send-text commands
echo "$COMMAND" | grep -q 'wezterm cli send-text' || exit 0

# Only care about pane 1 (Codex) or pane 2 (Gemini), not pane 0 (Claude)
echo "$COMMAND" | grep -qE -- '--pane-id\s+(1|2)' || exit 0

# Allow if explicitly confirmed
echo "$COMMAND" | grep -q 'CCB_CONFIRMED' && exit 0

# Block with checklist
cat <<'MSG'
CCB Dispatch Protocol - confirm these 3 steps before sending:
  1. Model tier recommended AND user confirmed they switched
  2. Chinese translation shown to user AND user approved
  3. Dispatch content is in English
Add # CCB_CONFIRMED to the command after completing all steps.
MSG
exit 1

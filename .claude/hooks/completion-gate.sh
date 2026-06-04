#!/usr/bin/env bash
# Stop hook: Run pnpm check before Claude reports completion.
# Blocks the response if tsc / lint / format / tests fail.
set -uo pipefail

INPUT=$(cat)

# stop_hook_active is set when Claude is already inside a stop-hook loop.
# Exit immediately to avoid infinite blocking.
echo "$INPUT" | grep -q '"stop_hook_active":\s*true' && exit 0

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_DIR"

# Skip when no TypeScript files are changed (conversation-only turns).
CHANGED=$(git diff --name-only HEAD 2>/dev/null | grep -E '\.ts$' || true)
[[ -z "$CHANGED" ]] && exit 0

OUTPUT=$(pnpm run check 2>&1)
EXIT=$?

if [[ $EXIT -ne 0 ]]; then
  printf '{"decision":"block","reason":"pnpm check が失敗しています。修正してから完了と報告してください。\n\n%s"}\n' \
    "$(echo "$OUTPUT" | tail -25)"
  exit 2
fi

exit 0

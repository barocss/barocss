#!/bin/zsh
set -u
export PATH=/Users/user/Library/pnpm/nodejs/22.19.0/bin:$PATH
GATE=/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh
$GATE acquire heavy 1800 d342-api-studio || exit $?
trap '$GATE release' EXIT
cd /Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b || exit $?
node --version
: > /tmp/d342-root/api-studio-exit-codes.tsv
failed=0
run_check() {
  local check_name="$1"
  shift
  "$@" > "/tmp/d342-root/${check_name}.log" 2>&1
  local check_exit=$?
  printf '%s\t%s\n' "$check_name" "$check_exit" >> /tmp/d342-root/api-studio-exit-codes.tsv
  print -r -- "${check_name}: ${check_exit}"
  if [ "$check_exit" -ne 0 ]; then failed=1; fi
  return "$check_exit"
}
run_check api-generation-first node apps/library-docs/scripts/api-inventory.mjs --write-expected /tmp/d342-root/api-candidate.json || exit $?
run_check api-adoption-first python3 /tmp/d342-root/review-api.py || exit $?
run_check api-check-first node apps/library-docs/scripts/api-inventory.mjs --check
run_check agent-tools-check-first node apps/library-docs/scripts/agent-tools.mjs --check
run_check refusals-check-first node apps/library-docs/scripts/refusals.mjs --check
run_check studio-chat-first pnpm --dir apps/cad-studio test chat.test
run_check studio-types-first pnpm --dir apps/cad-studio type-check
run_check studio-vite-first pnpm --dir apps/cad-studio exec vite build
run_check studio-browser-lint-first pnpm --dir apps/cad-studio exec eslint test/offset-face-native-browser.mjs
exit "$failed"

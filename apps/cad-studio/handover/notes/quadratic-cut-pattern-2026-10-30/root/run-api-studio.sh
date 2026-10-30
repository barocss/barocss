#!/bin/zsh
set -u
export PATH=/Users/user/Library/pnpm/nodejs/22.19.0/bin:$PATH
GATE=/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh
$GATE acquire heavy 1800 d346-api-studio || exit $?
trap '$GATE release' EXIT
cd /Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b || exit $?
: > /tmp/d346-root/api-studio-exit-codes.tsv
run_check() {
 local check_name="$1"
 shift
 "$@" > "/tmp/d346-root/${check_name}.log" 2>&1
 local check_exit=$?
 printf '%s\t%s\n' "$check_name" "$check_exit" >> /tmp/d346-root/api-studio-exit-codes.tsv
 print -r -- "${check_name}: ${check_exit}"
 return "$check_exit"
}
cp /tmp/d346-root/api-check-housekeeping.log /tmp/d346-root/api-check-first.log
printf 'api-check-reused\t0\n' >> /tmp/d346-root/api-studio-exit-codes.tsv
run_check agent-tools-check-first node apps/library-docs/scripts/agent-tools.mjs --check
run_check refusals-check-first node apps/library-docs/scripts/refusals.mjs --check
(cd apps/cad-studio && run_check studio-chat-first node scripts/test.mjs chat.test)
(cd apps/cad-studio && run_check studio-types-first node ../../node_modules/typescript/bin/tsc --noEmit)
(cd apps/cad-studio && run_check studio-vite-first node ../../node_modules/vite/bin/vite.js build)
(cd apps/cad-studio && run_check studio-driver-lint-first ../../node_modules/.bin/eslint test/quadratic-cut-pattern-browser.mjs)
if awk -F '\t' '$2 != 0 { found = 1 } END { exit !found }' /tmp/d346-root/api-studio-exit-codes.tsv; then exit 1; fi

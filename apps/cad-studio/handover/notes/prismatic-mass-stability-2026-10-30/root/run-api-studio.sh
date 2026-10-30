#!/bin/zsh
set -u
export PATH=/Users/user/Library/pnpm/nodejs/22.19.0/bin:$PATH
GATE=/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh
$GATE acquire heavy 1800 d343-api-studio || exit $?
trap '$GATE release' EXIT
cd /Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b || exit $?
node --version
: > /tmp/d343-root/api-studio-exit-codes.tsv
failed=0
run_check() {
 local check_name="$1"
 shift
 "$@" > "/tmp/d343-root/${check_name}.log" 2>&1
 local check_exit=$?
 printf '%s\t%s\n' "$check_name" "$check_exit" >> /tmp/d343-root/api-studio-exit-codes.tsv
 print -r -- "${check_name}: ${check_exit}"
 if [ "$check_exit" -ne 0 ]; then failed=1; fi
 return "$check_exit"
}
run_check api-generation-first node apps/library-docs/scripts/api-inventory.mjs --write-expected /tmp/d343-root/api-candidate.json || exit $?
run_check api-adoption-first python3 /tmp/d343-root/review-api.py || exit $?
run_check api-check-first node apps/library-docs/scripts/api-inventory.mjs --check
run_check agent-tools-check-first node apps/library-docs/scripts/agent-tools.mjs --check
run_check refusals-check-first node apps/library-docs/scripts/refusals.mjs --check
(cd apps/cad-studio && run_check studio-chat-first node scripts/test.mjs chat.test)
(cd apps/cad-studio && run_check studio-types-first node ../../node_modules/typescript/bin/tsc --noEmit)
(cd apps/cad-studio && run_check studio-vite-first node ../../node_modules/vite/bin/vite.js build)
(cd apps/cad-studio && run_check studio-browser-lint-first ../../node_modules/.bin/eslint test/prismatic-mass-stability-browser.mjs)
if awk -F '\t' '$2 != 0 { found = 1 } END { exit !found }' /tmp/d343-root/api-studio-exit-codes.tsv; then exit 1; fi
exit "$failed"

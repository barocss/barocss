#!/bin/zsh
set -u
export PATH=/Users/user/Library/pnpm/nodejs/22.19.0/bin:$PATH
GATE=/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh
$GATE acquire heavy 1800 d341-postfix-studio || exit $?
trap '$GATE release' EXIT
cd /Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b || exit $?
node --version
: > /tmp/d341-root/postfix-exit-codes.tsv
failed=0
run_check() {
 local check_name="$1"
 shift
 "$@" > "/tmp/d341-root/${check_name}.log" 2>&1
 local check_exit=$?
 printf '%s\t%s\n' "$check_name" "$check_exit" >> /tmp/d341-root/postfix-exit-codes.tsv
 print -r -- "${check_name}: ${check_exit}"
 if [ "$check_exit" -ne 0 ]; then failed=1; fi
}
run_check postfix-studio-types pnpm --dir apps/cad-studio type-check
run_check postfix-studio-vite pnpm --dir apps/cad-studio exec vite build
run_check postfix-region-browser-lint pnpm --dir apps/cad-studio exec eslint test/trimmed-surface-region-browser.mjs
exit "$failed"

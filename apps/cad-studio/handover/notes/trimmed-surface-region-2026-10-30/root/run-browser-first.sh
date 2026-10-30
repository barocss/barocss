#!/bin/zsh
set -o pipefail
export PATH=/Users/user/Library/pnpm/nodejs/22.19.0/bin:$PATH
cd /Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/apps/cad-studio || exit 1
/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh acquire heavy 1800 d341-browser-first || exit $?
trap '/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh release' EXIT
D341_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node test/trimmed-surface-region-browser.mjs /tmp/d341-studio/run-01 > /tmp/d341-root/browser-first.log 2>&1
result=$?
echo "$result" > /tmp/d341-root/browser-first.exit
exit "$result"

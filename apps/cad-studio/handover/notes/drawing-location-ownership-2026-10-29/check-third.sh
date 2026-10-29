#!/bin/sh
export PATH=/Users/user/Library/pnpm/nodejs/22.19.0/bin:$PATH
GATE=/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh
$GATE acquire heavy 1800 d331-focused > /tmp/d331/check-acquire.txt 2>&1
acquire=$?
printf '%s\n' "$acquire" > /tmp/d331/check-acquire.exit
[ "$acquire" = 0 ] || exit "$acquire"
trap '$GATE release > /tmp/d331/check-release.txt 2>&1; printf "%s\n" "$?" > /tmp/d331/check-release.exit' EXIT
cd /Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad-model
D331_EVIDENCE_DIR=/tmp/d331 node scripts/test.mjs drawing-independent-locations auto-dimension drawing-issues section-dimensions drawing-made-views > /tmp/d331/focused-third.txt 2>&1
printf '%s\n' "$?" > /tmp/d331/focused-third.exit
node ../../node_modules/typescript/bin/tsc --noEmit -p . > /tmp/d331/types-third.txt 2>&1
printf '%s\n' "$?" > /tmp/d331/types-third.exit

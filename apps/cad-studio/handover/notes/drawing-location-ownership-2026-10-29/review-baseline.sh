#!/bin/sh
export PATH=/Users/user/Library/pnpm/nodejs/22.19.0/bin:$PATH
GATE=/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh
$GATE acquire heavy 1800 d331-review-regressions > /tmp/d331/review-baseline-acquire.txt 2>&1
[ "$?" = 0 ] || exit 75
trap '$GATE release > /tmp/d331/review-baseline-release.txt 2>&1' EXIT
cd /Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad-model
node scripts/test.mjs drawing-independent-locations > /tmp/d331/review-baseline.txt 2>&1
printf '%s\n' "$?" > /tmp/d331/review-baseline.exit

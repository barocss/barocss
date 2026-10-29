#!/bin/sh
export PATH=/Users/user/Library/pnpm/nodejs/22.19.0/bin:$PATH
GATE=/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh
$GATE acquire heavy 1800 d331-focused
acquire=$?
printf '%s\n' "$acquire" > /tmp/d331/baseline-acquire.exit
[ "$acquire" = 0 ] || exit "$acquire"
trap '$GATE release > /tmp/d331/baseline-release.txt 2>&1' EXIT
cd /Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad-model
node scripts/test.mjs drawing-independent-locations > /tmp/d331/baseline.txt 2>&1
result=$?
printf '%s\n' "$result" > /tmp/d331/baseline.exit
exit "$result"

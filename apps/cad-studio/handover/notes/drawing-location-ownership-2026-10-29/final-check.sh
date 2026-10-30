#!/bin/sh
export PATH=/Users/user/Library/pnpm/nodejs/22.19.0/bin:$PATH
GATE=/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh
$GATE acquire heavy 1800 d331-focused-final > /tmp/d331/final-acquire.txt 2>&1
acquire=$?
printf '%s\n' "$acquire" > /tmp/d331/final-acquire.exit
[ "$acquire" = 0 ] || exit "$acquire"
trap '$GATE release > /tmp/d331/final-release.txt 2>&1; printf "%s\n" "$?" > /tmp/d331/final-release.exit' EXIT
node /tmp/d331/baseline-valid.mjs > /tmp/d331/baseline-valid-build.txt 2>&1
printf '%s\n' "$?" > /tmp/d331/baseline-valid-build.exit
node --test /tmp/d331/baseline-valid.test.mjs > /tmp/d331/baseline-valid.txt 2>&1
printf '%s\n' "$?" > /tmp/d331/baseline-valid.exit
cd /Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad-model
D331_EVIDENCE_DIR=/tmp/d331 node scripts/test.mjs drawing-independent-locations auto-dimension drawing-issues section-dimensions drawing-made-views > /tmp/d331/focused-final.txt 2>&1
printf '%s\n' "$?" > /tmp/d331/focused-final.exit
node ../../node_modules/typescript/bin/tsc --noEmit -p . > /tmp/d331/types-final.txt 2>&1
printf '%s\n' "$?" > /tmp/d331/types-final.exit
cd ../..
node node_modules/eslint/bin/eslint.js packages/barocss-cad-model/src/drawing/measurement.ts packages/barocss-cad-model/src/drawing/issues.ts packages/barocss-cad-model/src/drawing/auto.ts packages/barocss-cad-model/test/drawing-independent-locations.test.ts > /tmp/d331/lint-final.txt 2>&1
printf '%s\n' "$?" > /tmp/d331/lint-final.exit

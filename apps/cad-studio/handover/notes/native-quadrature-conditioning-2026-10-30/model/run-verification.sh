#!/bin/sh
set -eu
TASK_GATE=/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh
TASK_NODE=/Users/user/Library/pnpm/nodejs/22.19.0/bin/node
TASK_ROOT=/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b
trap '"$TASK_GATE" release >> /tmp/d344-model/gate.log 2>&1' EXIT
"$TASK_GATE" acquire heavy 1800 d344-model-step-consumer >> /tmp/d344-model/gate.log 2>&1
cd "$TASK_ROOT/packages/barocss-cad-model"
set +e
TEST_CONCURRENCY=1 "$TASK_NODE" scripts/test.mjs native-quadrature-step.test > /tmp/d344-model/new-first.log 2>&1
TASK_EXIT=$?
printf '%s\n' "$TASK_EXIT" > /tmp/d344-model/new-first.exit
set -e
[ "$TASK_EXIT" -eq 0 ] || exit "$TASK_EXIT"
TEST_CONCURRENCY=1 "$TASK_NODE" scripts/test.mjs r7-findings.test r7-mmgs.test step-reference-units.test step-units.test r4-caches.test mass.test mass-longitudinal.test native-mass-wire.test > /tmp/d344-model/affected-first.log 2>&1
"$TASK_NODE" ../../node_modules/typescript/bin/tsc --noEmit -p . > /tmp/d344-model/types-first.log 2>&1
"$TASK_NODE" ../../node_modules/eslint/bin/eslint.js test/native-quadrature-step.test.ts > /tmp/d344-model/lint-first.log 2>&1
cd "$TASK_ROOT/apps/cad-studio"
"$TASK_NODE" ../../node_modules/typescript/bin/tsc --noEmit > /tmp/d344-model/studio-types-first.log 2>&1
"$TASK_NODE" ../../node_modules/vite/bin/vite.js build > /tmp/d344-model/studio-vite-first.log 2>&1
"$TASK_NODE" ../../node_modules/eslint/bin/eslint.js test/native-quadrature-step-browser.mjs > /tmp/d344-model/studio-driver-lint-first.log 2>&1

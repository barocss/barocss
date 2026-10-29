#!/bin/sh
set -eu
TASK_GATE=/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh
TASK_NODE=/Users/user/Library/pnpm/nodejs/22.19.0/bin/node
TASK_ROOT=/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b
trap '"$TASK_GATE" release >> /tmp/d344-model/box-contract-gate.log 2>&1' EXIT
"$TASK_GATE" acquire heavy 1800 d344-step-box-contract >> /tmp/d344-model/box-contract-gate.log 2>&1
cd "$TASK_ROOT/packages/barocss-cad-model"
TEST_CONCURRENCY=1 "$TASK_NODE" scripts/test.mjs native-quadrature-step.test > /tmp/d344-model/box-contract-focused.log 2>&1
"$TASK_NODE" ../../node_modules/typescript/bin/tsc --noEmit -p . > /tmp/d344-model/box-contract-types.log 2>&1
"$TASK_NODE" ../../node_modules/eslint/bin/eslint.js test/native-quadrature-step.test.ts > /tmp/d344-model/box-contract-model-lint.log 2>&1
cd "$TASK_ROOT/apps/cad-studio"
"$TASK_NODE" --check test/native-quadrature-step-browser.mjs > /tmp/d344-model/box-contract-driver-syntax.log 2>&1
"$TASK_NODE" ../../node_modules/eslint/bin/eslint.js test/native-quadrature-step-browser.mjs > /tmp/d344-model/box-contract-driver-lint.log 2>&1

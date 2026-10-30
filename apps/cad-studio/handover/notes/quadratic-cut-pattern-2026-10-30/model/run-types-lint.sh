#!/bin/sh
set -eu
TASK_GATE=/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh
TASK_NODE=/Users/user/Library/pnpm/nodejs/22.19.0/bin/node
trap '"$TASK_GATE" release >> /tmp/d346-model/gate.log 2>&1' EXIT
"$TASK_GATE" acquire heavy 1800 d346-model-types-lint >> /tmp/d346-model/gate.log 2>&1
cd /Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad-model
set +e
"$TASK_NODE" ../../node_modules/typescript/bin/tsc --noEmit -p . > /tmp/d346-model/types-first.log 2>&1
printf '%s\n' "$?" > /tmp/d346-model/types-first.exit
"$TASK_NODE" ../../node_modules/eslint/bin/eslint.js src/engine/curveFeaturePattern.ts src/app/commands.ts test/quadratic-feature-pattern.test.ts > /tmp/d346-model/lint-first.log 2>&1
printf '%s\n' "$?" > /tmp/d346-model/lint-first.exit

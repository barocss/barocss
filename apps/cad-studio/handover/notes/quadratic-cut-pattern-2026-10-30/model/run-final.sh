#!/bin/sh
set -eu
TASK_GATE=/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh
TASK_NODE=/Users/user/Library/pnpm/nodejs/22.19.0/bin/node
trap '"$TASK_GATE" release >> /tmp/d346-model/gate.log 2>&1' EXIT
"$TASK_GATE" acquire heavy 1800 d346-model-final-v2 >> /tmp/d346-model/gate.log 2>&1
cd /Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad-model
set +e
TEST_CONCURRENCY=1 "$TASK_NODE" scripts/test.mjs quadratic-feature-pattern.test api-curve-feature-pattern.test api-rectangular-feature-pattern.test api-fill-feature-pattern.test fill-feature-pattern-holes.test rectangular-feature-pattern-command.test linear-feature-pattern-command.test o10-body-keys.test native-offset-face.test native-offset-result.test native-offset-circle-browser.test offset-face-native.test api-studio-commands.test > /tmp/d346-model/final-tests.log 2>&1
printf '%s\n' "$?" > /tmp/d346-model/final-tests.exit
"$TASK_NODE" ../../node_modules/typescript/bin/tsc --noEmit -p . > /tmp/d346-model/final-types.log 2>&1
printf '%s\n' "$?" > /tmp/d346-model/final-types.exit
"$TASK_NODE" ../../node_modules/eslint/bin/eslint.js src/engine/curveFeaturePattern.ts src/app/commands.ts test/quadratic-feature-pattern.test.ts test/api-curve-feature-pattern.test.ts > /tmp/d346-model/final-lint.log 2>&1
printf '%s\n' "$?" > /tmp/d346-model/final-lint.exit

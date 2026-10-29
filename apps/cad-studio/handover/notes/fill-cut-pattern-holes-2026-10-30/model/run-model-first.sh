#!/bin/sh
set -eu
TASK_GATE=/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh
TASK_NODE=/Users/user/Library/pnpm/nodejs/22.19.0/bin/node
TASK_ROOT=/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b
trap '"$TASK_GATE" release >> /tmp/d345-model/gate.log 2>&1' EXIT
"$TASK_GATE" acquire heavy 1800 d345-model-hole-mask >> /tmp/d345-model/gate.log 2>&1
cd "$TASK_ROOT/packages/barocss-cad-model"
set +e
TEST_CONCURRENCY=1 "$TASK_NODE" scripts/test.mjs fill-feature-pattern-holes.test > /tmp/d345-model/new-first.log 2>&1
TASK_EXIT=$?
printf '%s\n' "$TASK_EXIT" > /tmp/d345-model/new-first.exit
set -e
[ "$TASK_EXIT" -eq 0 ] || exit "$TASK_EXIT"
TEST_CONCURRENCY=1 "$TASK_NODE" scripts/test.mjs api-fill-feature-pattern.test api-rectangular-feature-pattern.test api-curve-feature-pattern.test api-linear-feature-pattern.test rectangular-feature-pattern-command.test linear-feature-pattern-command.test o10-body-keys.test native-offset-face.test native-offset-result.test native-offset-circle-browser.test offset-face-native.test api-studio-commands.test > /tmp/d345-model/affected-first.log 2>&1
"$TASK_NODE" ../../node_modules/typescript/bin/tsc --noEmit -p . > /tmp/d345-model/types-first.log 2>&1
"$TASK_NODE" ../../node_modules/eslint/bin/eslint.js src/engine/fillFeaturePattern.ts src/app/commands.ts test/fill-feature-pattern-holes.test.ts > /tmp/d345-model/lint-first.log 2>&1

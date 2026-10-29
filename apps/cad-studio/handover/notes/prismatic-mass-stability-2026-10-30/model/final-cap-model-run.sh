#!/bin/sh
set -eu
TASK_GATE=/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh
TASK_NODE=/Users/user/Library/pnpm/nodejs/22.19.0/bin/node
trap '"$TASK_GATE" release >> /tmp/d343-model/final-cap-model-gate.log 2>&1' EXIT
"$TASK_GATE" acquire heavy 1800 d343-model-final-cap-identity > /tmp/d343-model/final-cap-model-gate.log 2>&1
set +e
TEST_CONCURRENCY=1 "$TASK_NODE" scripts/test.mjs native-offset-face offset-face-native native-offset-result native-offset-circle-browser mass-longitudinal mass.test face-commands feature-handles sketch-profile-precision o10-body-keys > /tmp/d343-model/final-cap-model-first.log 2>&1
TASK_TEST=$?
"$TASK_NODE" node_modules/typescript/bin/tsc --noEmit -p . > /tmp/d343-model/final-cap-model-types-first.log 2>&1
TASK_TYPES=$?
"$TASK_NODE" ../../node_modules/eslint/bin/eslint.js test/mass-longitudinal.test.ts > /tmp/d343-model/final-cap-model-lint-first.log 2>&1
TASK_LINT=$?
set -e
printf 'tests=%s\ntypes=%s\nlint=%s\n' "$TASK_TEST" "$TASK_TYPES" "$TASK_LINT" > /tmp/d343-model/final-cap-model-first.exit
shasum -a 256 src/app/profileCommands.ts src/app/nativeOffsetFace.ts test/mass-longitudinal.test.ts ../../packages/barocss-cad/src/features/prismatic-solid.ts > /tmp/d343-model/final-cap-model-sources.sha256

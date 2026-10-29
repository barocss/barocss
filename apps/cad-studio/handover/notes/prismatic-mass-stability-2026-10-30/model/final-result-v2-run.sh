#!/bin/sh
set -eu
TASK_GATE=/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh
TASK_NODE=/Users/user/Library/pnpm/nodejs/22.19.0/bin/node
trap '"$TASK_GATE" release >> /tmp/d343-model/gate-final-result-v2.log 2>&1' EXIT
"$TASK_GATE" acquire heavy 1800 d343-model-final-actual-result-v2 > /tmp/d343-model/gate-final-result-v2.log 2>&1
set +e
TEST_CONCURRENCY=1 "$TASK_NODE" scripts/test.mjs native-offset-face offset-face-native native-offset-result mass-longitudinal mass.test face-commands feature-handles sketch-profile-precision o10-body-keys > /tmp/d343-model/final-result-v2-first.log 2>&1
TASK_TEST=$?
"$TASK_NODE" node_modules/typescript/bin/tsc --noEmit -p . > /tmp/d343-model/final-result-v2-types-first.log 2>&1
TASK_TYPES=$?
"$TASK_NODE" ../../node_modules/eslint/bin/eslint.js src/app/profileCommands.ts src/app/nativeOffsetFace.ts test/native-offset-face.test.ts test/offset-face-native.test.ts test/native-offset-result.test.ts test/mass-longitudinal.test.ts > /tmp/d343-model/final-result-v2-lint-first.log 2>&1
TASK_LINT=$?
set -e
printf 'tests=%s\ntypes=%s\nlint=%s\n' "$TASK_TEST" "$TASK_TYPES" "$TASK_LINT" > /tmp/d343-model/final-result-v2-first.exit
shasum -a 256 src/app/profileCommands.ts src/app/nativeOffsetFace.ts test/native-offset-face.test.ts test/offset-face-native.test.ts test/native-offset-result.test.ts test/mass-longitudinal.test.ts > /tmp/d343-model/final-result-v2-sources.sha256

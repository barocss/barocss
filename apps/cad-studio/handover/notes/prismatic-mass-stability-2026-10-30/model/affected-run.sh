#!/bin/sh
set -eu
TASK_GATE=/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh
TASK_NODE=/Users/user/Library/pnpm/nodejs/22.19.0/bin/node
trap '"$TASK_GATE" release >> /tmp/d343-model/gate-affected.log 2>&1' EXIT
"$TASK_GATE" acquire heavy 1800 d343-model-affected > /tmp/d343-model/gate-affected.log 2>&1
set +e
TEST_CONCURRENCY=1 "$TASK_NODE" scripts/test.mjs mass-longitudinal mass.test native-offset-face offset-face-native > /tmp/d343-model/affected-first.log 2>&1
TASK_TEST=$?
"$TASK_NODE" node_modules/typescript/bin/tsc --noEmit -p . > /tmp/d343-model/types-first.log 2>&1
TASK_TYPES=$?
"$TASK_NODE" ../../node_modules/eslint/bin/eslint.js test/mass-longitudinal.test.ts test/native-offset-face.test.ts test/offset-face-native.test.ts > /tmp/d343-model/lint-first.log 2>&1
TASK_LINT=$?
set -e
printf 'tests=%s\ntypes=%s\nlint=%s\n' "$TASK_TEST" "$TASK_TYPES" "$TASK_LINT" > /tmp/d343-model/affected-first.exit
shasum -a 256 src/app/nativeOffsetFace.ts > /tmp/d343-model/guard-after-affected.sha256

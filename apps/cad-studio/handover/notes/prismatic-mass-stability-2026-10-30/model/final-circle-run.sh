#!/bin/sh
set -eu
TASK_GATE=/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh
TASK_NODE=/Users/user/Library/pnpm/nodejs/22.19.0/bin/node
trap '"$TASK_GATE" release >> /tmp/d343-model/final-circle-gate.log 2>&1' EXIT
"$TASK_GATE" acquire heavy 1800 d343-model-final-circle > /tmp/d343-model/final-circle-gate.log 2>&1
set +e
TEST_CONCURRENCY=1 "$TASK_NODE" scripts/test.mjs native-offset-face offset-face-native native-offset-result native-offset-circle-browser mass-longitudinal mass.test face-commands feature-handles sketch-profile-precision o10-body-keys > /tmp/d343-model/final-circle-first.log 2>&1
TASK_RESULT=$?
set -e
printf '%s\n' "$TASK_RESULT" > /tmp/d343-model/final-circle-first.exit
shasum -a 256 src/app/profileCommands.ts src/app/nativeOffsetFace.ts test/native-offset-face.test.ts test/offset-face-native.test.ts test/native-offset-result.test.ts test/native-offset-circle-browser.test.ts test/mass-longitudinal.test.ts > /tmp/d343-model/final-circle-sources.sha256

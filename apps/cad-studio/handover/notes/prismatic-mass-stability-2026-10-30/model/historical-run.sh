#!/bin/sh
set -eu
TASK_GATE=/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh
TASK_NODE=/Users/user/Library/pnpm/nodejs/22.19.0/bin/node
trap '"$TASK_GATE" release >> /tmp/d343-model/gate.log 2>&1' EXIT
"$TASK_GATE" acquire heavy 1800 d343-model-historical > /tmp/d343-model/gate.log 2>&1
shasum -a 256 src/app/nativeOffsetFace.ts > /tmp/d343-model/guard-before.sha256
set +e
TEST_CONCURRENCY=1 "$TASK_NODE" scripts/test.mjs native-offset-face offset-face-native > /tmp/d343-model/historical-first.log 2>&1
TASK_RESULT=$?
set -e
printf '%s\n' "$TASK_RESULT" > /tmp/d343-model/historical-first.exit
shasum -a 256 src/app/nativeOffsetFace.ts > /tmp/d343-model/guard-after-historical.sha256

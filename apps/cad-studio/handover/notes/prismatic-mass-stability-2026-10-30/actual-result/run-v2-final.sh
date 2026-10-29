#!/bin/sh
set -eu
TASK_GATE=/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh
TASK_NODE=/Users/user/Library/pnpm/nodejs/22.19.0/bin/node
trap '"$TASK_GATE" release >> /tmp/d343-actual-result/gate.log 2>&1' EXIT
"$TASK_GATE" acquire heavy 1800 d343-actual-v2-final >> /tmp/d343-actual-result/gate.log 2>&1
"$TASK_NODE" scripts/test.mjs native-offset-result > /tmp/d343-actual-result/focused-v2-final.log 2>&1
"$TASK_NODE" ../../node_modules/typescript/bin/tsc --noEmit -p . > /tmp/d343-actual-result/types-v2.log 2>&1
"$TASK_NODE" ../../node_modules/eslint/bin/eslint.js src/app/nativeOffsetFace.ts test/native-offset-result.test.ts > /tmp/d343-actual-result/lint-v2.log 2>&1

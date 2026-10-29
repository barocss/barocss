#!/bin/sh
set -eu
TASK_GATE=/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh
TASK_NODE=/Users/user/Library/pnpm/nodejs/22.19.0/bin/node
trap '"$TASK_GATE" release >> /tmp/d342-nearfull/gate.log 2>&1' EXIT
"$TASK_GATE" acquire heavy 1800 d342-nearfull-checks >> /tmp/d342-nearfull/gate.log 2>&1
"$TASK_NODE" scripts/test.mjs native-offset-face > /tmp/d342-nearfull/ordinary-binding-helper.log 2>&1
"$TASK_NODE" ../../node_modules/typescript/bin/tsc --noEmit -p . > /tmp/d342-nearfull/ordinary-binding-types.log 2>&1
"$TASK_NODE" ../../node_modules/eslint/bin/eslint.js src/app/nativeOffsetFace.ts test/native-offset-face.test.ts > /tmp/d342-nearfull/ordinary-binding-lint.log 2>&1

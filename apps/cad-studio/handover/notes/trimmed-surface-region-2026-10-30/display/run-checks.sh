#!/bin/sh
set -eu
TASK_GATE=/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh
TASK_NODE=/Users/user/Library/pnpm/nodejs/22.19.0/bin/node
trap '"$TASK_GATE" release >> /tmp/d341-display/gate.log 2>&1' EXIT
"$TASK_GATE" acquire heavy 1800 d341-display-checks >> /tmp/d341-display/gate.log 2>&1
"$TASK_NODE" scripts/test.mjs direct-display-domain direct-trim-region direct-trim-split direct-trim-reverse direct.test > /tmp/d341-display/focused-first.log 2>&1
"$TASK_NODE" ../../node_modules/typescript/bin/tsc --noEmit -p . > /tmp/d341-display/types.log 2>&1
"$TASK_NODE" ../../node_modules/eslint/bin/eslint.js src/engine/trim.ts src/engine/direct.ts test/direct-display-domain.test.ts > /tmp/d341-display/lint.log 2>&1

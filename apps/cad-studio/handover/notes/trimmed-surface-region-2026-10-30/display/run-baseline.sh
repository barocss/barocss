#!/bin/sh
set -eu
TASK_GATE=/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh
TASK_NODE=/Users/user/Library/pnpm/nodejs/22.19.0/bin/node
trap '"$TASK_GATE" release >> /tmp/d341-display/gate.log 2>&1' EXIT
"$TASK_GATE" acquire heavy 1800 d341-display-baseline >> /tmp/d341-display/gate.log 2>&1
set +e
"$TASK_NODE" /tmp/d341-display/baseline-test.mjs > /tmp/d341-display/regression-before-retry.log 2>&1
TASK_RESULT=$?
set -e
printf '%s\n' "$TASK_RESULT" > /tmp/d341-display/regression-before-exit.txt
test "$TASK_RESULT" -eq 1

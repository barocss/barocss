#!/bin/sh
TASK_GATE=/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh
TASK_NODE=/Users/user/Library/pnpm/nodejs/22.19.0/bin/node
trap '"$TASK_GATE" release >> /tmp/d336-probe/gate.log 2>&1' EXIT HUP INT TERM
"$TASK_GATE" acquire heavy 1800 d336-prefixed-probe > /tmp/d336-probe/gate.log 2>&1 || exit $?
"$TASK_NODE" /tmp/d336-probe/build.mjs > /tmp/d336-probe/build.log 2>&1 || exit $?
"$TASK_NODE" /tmp/d336-probe/capsule.mjs before > /tmp/d336-probe/capsule-before.log 2>&1 || exit $?
"$TASK_NODE" /tmp/d336-probe/probe.mjs > /tmp/d336-probe/runtime.log 2>&1
TASK_RESULT=$?
"$TASK_NODE" /tmp/d336-probe/capsule.mjs after > /tmp/d336-probe/capsule-after.log 2>&1
printf '%s\n' "$TASK_RESULT" > /tmp/d336-probe/runtime-exit-code.txt
exit "$TASK_RESULT"

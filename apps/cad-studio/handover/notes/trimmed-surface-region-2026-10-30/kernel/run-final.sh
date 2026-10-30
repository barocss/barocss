#!/bin/sh
set -eu
TASK_GATE=/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh
TASK_NODE=/Users/user/Library/pnpm/nodejs/22.19.0/bin/node
TASK_OUT=/tmp/d341-kernel
trap '"$TASK_GATE" release >> "$TASK_OUT/gate-final.log" 2>&1' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM HUP
"$TASK_GATE" acquire heavy 1800 d341-kernel-final >> "$TASK_OUT/gate-final.log" 2>&1
"$TASK_NODE" --test test/trimmed-surface-region.test.mjs > "$TASK_OUT/focused-final.log" 2>&1

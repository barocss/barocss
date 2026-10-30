#!/bin/sh
set -eu
TASK_GATE=/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh
TASK_NODE=/Users/user/Library/pnpm/nodejs/22.19.0/bin/node
TASK_OUT=/tmp/d340-kernel
trap '"$TASK_GATE" release >> "$TASK_OUT/gate-final.log" 2>&1' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM HUP
"$TASK_GATE" acquire heavy 1800 d340-kernel-final >> "$TASK_OUT/gate-final.log" 2>&1
"$TASK_NODE" --test test/planar-arrangement-exact.test.mjs test/trimmed-surface-parameter-split.test.mjs > "$TASK_OUT/focused-final.log" 2>&1
"$TASK_NODE" "$TASK_OUT/material-input.mjs" > "$TASK_OUT/material-capture.log" 2>&1
python3 "$TASK_OUT/material-compare.py" > "$TASK_OUT/material-compare.log" 2>&1

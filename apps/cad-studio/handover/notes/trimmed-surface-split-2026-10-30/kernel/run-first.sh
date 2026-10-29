#!/bin/sh
set -eu
TASK_GATE=/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh
TASK_NODE=/Users/user/Library/pnpm/nodejs/22.19.0/bin/node
TASK_OUT=/tmp/d340-kernel
trap '"$TASK_GATE" release >> "$TASK_OUT/gate-first.log" 2>&1' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM HUP
"$TASK_GATE" acquire heavy 1800 d340-kernel-first >> "$TASK_OUT/gate-first.log" 2>&1
"$TASK_NODE" --test test/planar-arrangement.test.mjs > "$TASK_OUT/legacy-before.log" 2>&1
"$TASK_NODE" scripts/tool.mjs build > "$TASK_OUT/build-first.log" 2>&1
"$TASK_NODE" --test test/planar-arrangement-exact.test.mjs test/trimmed-surface-parameter-split.test.mjs > "$TASK_OUT/focused-first.log" 2>&1

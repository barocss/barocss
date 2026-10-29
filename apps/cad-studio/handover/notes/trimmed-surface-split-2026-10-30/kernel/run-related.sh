#!/bin/sh
set -eu
TASK_GATE=/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh
TASK_NODE=/Users/user/Library/pnpm/nodejs/22.19.0/bin/node
TASK_OUT=/tmp/d340-kernel
trap '"$TASK_GATE" release >> "$TASK_OUT/gate-related.log" 2>&1' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM HUP
"$TASK_GATE" acquire heavy 1800 d340-kernel-related >> "$TASK_OUT/gate-related.log" 2>&1
"$TASK_NODE" scripts/tool.mjs lint > "$TASK_OUT/lint-first.log" 2>&1
"$TASK_NODE" --test test/planar-arrangement.test.mjs test/polyhedral-boolean.test.mjs test/trimmed-surface-axis-reversal.test.mjs > "$TASK_OUT/related-first.log" 2>&1

#!/bin/sh
set -eu
TASK_GATE=/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh
TASK_NODE=/Users/user/Library/pnpm/nodejs/22.19.0/bin/node
trap '"$TASK_GATE" release >> /tmp/d344-kernel/gate.log 2>&1' EXIT
"$TASK_GATE" acquire heavy 1800 d344-baseline-trace >> /tmp/d344-kernel/gate.log 2>&1
"$TASK_NODE" /tmp/d344-kernel/build-probe.mjs > /tmp/d344-kernel/build-first.log 2>&1
"$TASK_NODE" /tmp/d344-kernel/probe.mjs > /tmp/d344-kernel/baseline-first.log 2>&1

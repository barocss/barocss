#!/bin/sh
set -eu
TASK_GATE=/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh
trap '"$TASK_GATE" release >> /tmp/d343-circle-browser/gate.log 2>&1' EXIT
"$TASK_GATE" acquire heavy 1800 d343-circle-browser >> /tmp/d343-circle-browser/gate.log 2>&1
/Users/user/Library/pnpm/nodejs/22.19.0/bin/node /tmp/d343-circle-browser/probe.mjs > /tmp/d343-circle-browser/second.log 2>&1

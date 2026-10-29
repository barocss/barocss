#!/bin/sh
set -eu
TASK_GATE=/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh
TASK_NODE=/Users/user/Library/pnpm/nodejs/22.19.0/bin/node
trap '"$TASK_GATE" release >> /tmp/d343-model/gate-classify.log 2>&1' EXIT
"$TASK_GATE" acquire heavy 1800 d343-model-provider-classification > /tmp/d343-model/gate-classify.log 2>&1
"$TASK_NODE" /tmp/d343-model/classify-build.mjs > /tmp/d343-model/classify-build.log 2>&1
"$TASK_NODE" /tmp/d343-model/classify-providers.mjs > /tmp/d343-model/classify-corrected-reader.log 2>&1

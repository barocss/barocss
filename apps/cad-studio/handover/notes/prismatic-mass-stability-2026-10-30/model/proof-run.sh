#!/bin/sh
set -eu
TASK_GATE=/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh
TASK_NODE=/Users/user/Library/pnpm/nodejs/22.19.0/bin/node
trap '"$TASK_GATE" release >> /tmp/d343-model/gate-proof.log 2>&1' EXIT
"$TASK_GATE" acquire heavy 1800 d343-model-proof > /tmp/d343-model/gate-proof.log 2>&1
set +e
TEST_CONCURRENCY=1 "$TASK_NODE" scripts/test.mjs mass-longitudinal > /tmp/d343-model/proof-first.log 2>&1
TASK_RESULT=$?
set -e
printf '%s\n' "$TASK_RESULT" > /tmp/d343-model/proof-first.exit

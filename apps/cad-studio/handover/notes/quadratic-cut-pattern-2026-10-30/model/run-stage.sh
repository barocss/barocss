#!/bin/sh
set -eu
TASK_GATE=/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh
TASK_NODE=/Users/user/Library/pnpm/nodejs/22.19.0/bin/node
trap '"$TASK_GATE" release >> /tmp/d346-model/gate.log 2>&1' EXIT
"$TASK_GATE" acquire heavy 1800 d346-model-quadratic >> /tmp/d346-model/gate.log 2>&1
cd /Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad-model
set +e
TEST_CONCURRENCY=1 "$TASK_NODE" scripts/test.mjs quadratic-feature-pattern.test > /tmp/d346-model/new-first.log 2>&1
TASK_EXIT=$?
printf '%s\n' "$TASK_EXIT" > /tmp/d346-model/new-first.exit
exit "$TASK_EXIT"

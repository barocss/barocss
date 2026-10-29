#!/bin/sh
set -eu
cd /Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad
TASK_GATE=/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh
TASK_NODE=/Users/user/Library/pnpm/nodejs/22.19.0/bin/node
trap '"$TASK_GATE" release >> /tmp/d345-kernel/gate.log 2>&1' EXIT
"$TASK_GATE" acquire heavy 1800 d345-kernel-candidate >> /tmp/d345-kernel/gate.log 2>&1
"$TASK_NODE" --test test/fill-cut-pattern-holes.test.mjs > /tmp/d345-kernel/focused-third.log 2>&1
"$TASK_NODE" --test test/fill-cut-pattern.test.mjs test/rectangular-cut-pattern.test.mjs test/api-part.test.mjs > /tmp/d345-kernel/related-third.log 2>&1
"$TASK_NODE" scripts/tool.mjs type-check > /tmp/d345-kernel/types-third.log 2>&1
"$TASK_NODE" ../../node_modules/eslint/bin/eslint.js src/features/fill-cut-pattern.ts test/fill-cut-pattern-holes.test.mjs test/helpers/fill-cut-holes-oracle.mjs > /tmp/d345-kernel/lint-third.log 2>&1

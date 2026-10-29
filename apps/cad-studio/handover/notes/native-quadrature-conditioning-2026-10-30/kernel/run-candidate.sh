#!/bin/sh
set -eu
cd /Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad
TASK_GATE=/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh
TASK_NODE=/Users/user/Library/pnpm/nodejs/22.19.0/bin/node
trap '"$TASK_GATE" release >> /tmp/d344-kernel/gate.log 2>&1' EXIT
"$TASK_GATE" acquire heavy 1800 d344-local-candidate >> /tmp/d344-kernel/gate.log 2>&1
"$TASK_NODE" scripts/tool.mjs build > /tmp/d344-kernel/candidate-build-first.log 2>&1
"$TASK_NODE" --test test/native-quadrature-conditioning.test.mjs > /tmp/d344-kernel/candidate-focused-first.log 2>&1
"$TASK_NODE" --test test/modeling-mass.test.mjs test/mass-pole-cap.test.mjs test/mass-pole-steps.test.mjs test/mass-pole-trims.test.mjs test/mass-polyhedral.test.mjs test/mass-tessellated-bound.test.mjs test/prismatic-mass-stability.test.mjs test/native-si-mass.test.mjs > /tmp/d344-kernel/candidate-related-first.log 2>&1
"$TASK_NODE" scripts/tool.mjs type-check > /tmp/d344-kernel/candidate-types-first.log 2>&1
"$TASK_NODE" ../../node_modules/eslint/bin/eslint.js src/brep/brep-mass-quadrature.ts test/native-quadrature-conditioning.test.mjs test/helpers/native-quadrature-oracle.mjs > /tmp/d344-kernel/candidate-lint-first.log 2>&1

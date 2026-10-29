#!/bin/zsh
set -e -o pipefail
export PATH=/Users/user/Library/pnpm/nodejs/22.19.0/bin:$PATH
GATE=/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh
$GATE acquire heavy 1800 d343-kernel-candidate || exit $?
trap '$GATE release' EXIT
cd /Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b
pnpm --dir packages/barocss-cad build:library > /tmp/d343-kernel/candidate-first-build.log 2>&1
D343_EVIDENCE_DIR=/tmp/d343-kernel/candidate-first node --test packages/barocss-cad/test/prismatic-mass-stability.test.mjs > /tmp/d343-kernel/candidate-first-focused.log 2>&1
node --test packages/barocss-cad/test/prismatic-solid.test.mjs packages/barocss-cad/test/part-model.test.mjs packages/barocss-cad/test/mass-polyhedral.test.mjs packages/barocss-cad/test/native-si-boundary.test.mjs > /tmp/d343-kernel/related-first.log 2>&1
pnpm --dir packages/barocss-cad type-check > /tmp/d343-kernel/types-first.log 2>&1
pnpm --dir packages/barocss-cad lint > /tmp/d343-kernel/lint-first.log 2>&1
pnpm --dir packages/barocss-cad exec eslint test/prismatic-mass-stability.test.mjs test/helpers/prismatic-mass-oracle.mjs > /tmp/d343-kernel/test-lint-first.log 2>&1

#!/bin/zsh
set -e -o pipefail
export PATH=/Users/user/Library/pnpm/nodejs/22.19.0/bin:$PATH
GATE=/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh
$GATE acquire heavy 1800 d340-model
trap '$GATE release' EXIT
cd /Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b
node --version
pnpm --dir packages/barocss-cad-model test direct-trim-split direct-trim-guards direct-trim-reverse direct.test 2>&1 | tee /tmp/d340-model/focused-first.log
pnpm --dir packages/barocss-cad-model type-check 2>&1 | tee /tmp/d340-model/types-first.log
pnpm --dir packages/barocss-cad-model exec eslint src/engine/direct.ts test/direct-trim-split.test.ts test/direct-trim-guards.test.ts test/direct-trim-reverse.test.ts test/helpers/trimSplitOracle.ts 2>&1 | tee /tmp/d340-model/lint-first.log

#!/bin/zsh
set -e -o pipefail
export PATH=/Users/user/Library/pnpm/nodejs/22.19.0/bin:$PATH
GATE=/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh
$GATE acquire heavy 1800 d342-model-final
trap '$GATE release' EXIT
cd /Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b
node --version
pnpm --dir packages/barocss-cad-model test offset-face-native 2>&1 | tee /tmp/d342-model/command-final.log
pnpm --dir packages/barocss-cad-model type-check 2>&1 | tee /tmp/d342-model/types-final.log
pnpm --dir packages/barocss-cad-model exec eslint src/app/profileCommands.ts test/offset-face-native.test.ts 2>&1 | tee /tmp/d342-model/lint-final.log

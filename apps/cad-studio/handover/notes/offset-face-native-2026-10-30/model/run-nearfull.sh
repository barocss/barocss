#!/bin/zsh
set -e -o pipefail
export PATH=/Users/user/Library/pnpm/nodejs/22.19.0/bin:$PATH
GATE=/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh
$GATE acquire heavy 1800 d342-model-nearfull
trap '$GATE release' EXIT
cd /Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b
pnpm exec esbuild /tmp/d342-model/nearfull.ts --bundle --platform=node --format=esm --target=node22 --outfile=/tmp/d342-model/nearfull.mjs > /tmp/d342-model/nearfull-bundle.log 2>&1
node /tmp/d342-model/nearfull.mjs > /tmp/d342-model/nearfull-first.log 2>&1

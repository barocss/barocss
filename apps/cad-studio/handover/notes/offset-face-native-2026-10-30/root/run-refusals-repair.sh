#!/bin/zsh
set -e
export PATH=/Users/user/Library/pnpm/nodejs/22.19.0/bin:$PATH
GATE=/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh
$GATE acquire heavy 1800 d342-refusals-repair
trap '$GATE release' EXIT
cd /Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b
node apps/library-docs/scripts/refusals.mjs > /tmp/d342-root/refusals-generation.log 2>&1
node apps/library-docs/scripts/refusals.mjs --check > /tmp/d342-root/refusals-check-repair.log 2>&1

#!/bin/zsh
set -e
export PATH=/Users/user/Library/pnpm/nodejs/22.19.0/bin:$PATH
GATE=/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh
$GATE acquire heavy 1800 d342-browser-lint-repair
trap '$GATE release' EXIT
cd /Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b
pnpm --dir apps/cad-studio exec eslint test/offset-face-native-browser.mjs > /tmp/d342-root/studio-browser-lint-repair.log 2>&1

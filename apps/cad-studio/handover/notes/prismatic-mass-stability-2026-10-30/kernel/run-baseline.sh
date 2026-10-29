#!/bin/zsh
set -u
export PATH=/Users/user/Library/pnpm/nodejs/22.19.0/bin:$PATH
GATE=/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh
$GATE acquire heavy 1800 d343-kernel-baseline || exit $?
trap '$GATE release' EXIT
cd /Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b || exit $?
node --version > /tmp/d343-kernel/node-version.txt
pnpm --dir packages/barocss-cad build:library > /tmp/d343-kernel/baseline-build.log 2>&1
build_exit=$?
printf 'build\t%s\n' "$build_exit" > /tmp/d343-kernel/baseline-exits.tsv
if [ "$build_exit" -ne 0 ]; then exit "$build_exit"; fi
D343_EVIDENCE_DIR=/tmp/d343-kernel/baseline node --test packages/barocss-cad/test/prismatic-mass-stability.test.mjs > /tmp/d343-kernel/baseline-focused.log 2>&1
focused_exit=$?
printf 'focused\t%s\n' "$focused_exit" >> /tmp/d343-kernel/baseline-exits.tsv
exit "$focused_exit"

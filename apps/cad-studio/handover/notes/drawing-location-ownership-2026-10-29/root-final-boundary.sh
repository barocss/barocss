#!/bin/sh
export PATH=/Users/user/Library/pnpm/nodejs/22.19.0/bin:$PATH
/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh acquire heavy 1800 d331-final-boundary > /tmp/d331/root-acquire.txt 2>&1 || exit $?
trap '/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh release > /tmp/d331/root-release.txt 2>&1' EXIT
cd /Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad-model
node scripts/test.mjs drawing auto-dimension auto-layout section-dimensions > /tmp/d331/model-drawing.txt 2>&1
printf '%s\n' "$?" > /tmp/d331/model-drawing.exit
cd /Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/apps/cad-studio
node scripts/test.mjs chat section-view > /tmp/d331/studio-drawing.txt 2>&1
printf '%s\n' "$?" > /tmp/d331/studio-drawing.exit
node ../../node_modules/typescript/bin/tsc --noEmit > /tmp/d331/studio-types.txt 2>&1
printf '%s\n' "$?" > /tmp/d331/studio-types.exit
node ../../node_modules/vite/bin/vite.js build > /tmp/d331/studio-build.txt 2>&1
printf '%s\n' "$?" > /tmp/d331/studio-build.exit
cd /Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b
node apps/library-docs/scripts/api-inventory.mjs --write-expected /tmp/d331/api-candidate.json > /tmp/d331/api-generate.txt 2>&1
printf '%s\n' "$?" > /tmp/d331/api-generate.exit
python3 /tmp/d331/verify.py

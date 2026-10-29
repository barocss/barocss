#!/bin/sh
GATE='/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh'
NODE='/Users/user/Library/pnpm/nodejs/22.19.0/bin/node'
lease=0
cleanup(){ result=$?; if [ "$lease" -eq 1 ]; then "$GATE" release > /tmp/d332-selection/release.txt 2>&1; fi; exit "$result"; }
trap cleanup EXIT
"$GATE" acquire heavy 30 d332-selection-scoped > /tmp/d332-selection/acquire.txt 2>&1
code=$?
if [ "$code" -ne 0 ]; then exit "$code"; fi
lease=1
"$NODE" ../../node_modules/typescript/bin/tsc --noEmit > /tmp/d332-selection/types.txt 2>&1
code=$?
printf '%s\n' "$code" > /tmp/d332-selection/types.exit
if [ "$code" -ne 0 ]; then exit "$code"; fi
"$NODE" scripts/test.mjs facePaint > /tmp/d332-selection/face-paint.txt 2>&1
code=$?
printf '%s\n' "$code" > /tmp/d332-selection/face-paint.exit
exit "$code"

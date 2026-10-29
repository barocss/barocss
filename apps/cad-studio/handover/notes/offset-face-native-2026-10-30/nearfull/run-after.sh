#!/bin/sh
set -eu
TASK_GATE=/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh
TASK_NODE=/Users/user/Library/pnpm/nodejs/22.19.0/bin/node
trap '"$TASK_GATE" release >> /tmp/d342-nearfull/gate.log 2>&1' EXIT
"$TASK_GATE" acquire heavy 1800 d342-nearfull-after >> /tmp/d342-nearfull/gate.log 2>&1
"$TASK_NODE" --input-type=module -e 'import{build}from"esbuild";await build({entryPoints:["/tmp/d342-nearfull/probe.ts"],outfile:"/tmp/d342-nearfull/after-probe.mjs",bundle:true,platform:"node",format:"esm",target:"node22"});' > /tmp/d342-nearfull/after-bundle.log 2>&1
"$TASK_NODE" /tmp/d342-nearfull/after-probe.mjs > /tmp/d342-nearfull/after-first.log 2>&1
cd packages/barocss-cad-model
"$TASK_NODE" scripts/test.mjs native-offset-face > /tmp/d342-nearfull/helper-first.log 2>&1

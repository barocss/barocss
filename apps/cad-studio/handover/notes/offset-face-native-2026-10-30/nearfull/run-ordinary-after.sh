#!/bin/sh
set -eu
TASK_GATE=/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh
TASK_NODE=/Users/user/Library/pnpm/nodejs/22.19.0/bin/node
trap '"$TASK_GATE" release >> /tmp/d342-nearfull/gate.log 2>&1' EXIT
"$TASK_GATE" acquire heavy 1800 d342-ordinary-binding-after >> /tmp/d342-nearfull/gate.log 2>&1
"$TASK_NODE" --input-type=module -e 'import{build}from"esbuild";await build({entryPoints:["/tmp/d342-nearfull/ordinary-binding-probe.ts"],outfile:"/tmp/d342-nearfull/ordinary-binding-after.mjs",bundle:true,platform:"node",format:"esm",target:"node22"});' > /tmp/d342-nearfull/ordinary-binding-after-bundle.log 2>&1
"$TASK_NODE" /tmp/d342-nearfull/ordinary-binding-after.mjs /tmp/d342-nearfull/ordinary-binding-after-result.json > /tmp/d342-nearfull/ordinary-binding-after.log 2>&1

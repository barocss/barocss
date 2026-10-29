#!/bin/sh
set -eu
TASK_GATE=/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh
TASK_NODE=/Users/user/Library/pnpm/nodejs/22.19.0/bin/node
trap '"$TASK_GATE" release >> /tmp/d342-nearfull/gate.log 2>&1' EXIT
"$TASK_GATE" acquire heavy 1800 d342-nearfull-boundary-final >> /tmp/d342-nearfull/gate.log 2>&1
"$TASK_NODE" --input-type=module -e 'import{build}from"esbuild";await build({entryPoints:["/tmp/d342-nearfull/boundary-final-probe.ts"],outfile:"/tmp/d342-nearfull/boundary-final-probe.mjs",bundle:true,platform:"node",format:"esm",target:"node22"});' > /tmp/d342-nearfull/boundary-final-bundle.log 2>&1
"$TASK_NODE" /tmp/d342-nearfull/boundary-final-probe.mjs > /tmp/d342-nearfull/boundary-final-first.log 2>&1

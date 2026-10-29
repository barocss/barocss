#!/bin/sh
set -eu
TASK_GATE=/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh
TASK_NODE=/Users/user/Library/pnpm/nodejs/22.19.0/bin/node
trap '"$TASK_GATE" release >> /tmp/d341-display/gate.log 2>&1' EXIT
"$TASK_GATE" acquire heavy 1800 d341-display-probe >> /tmp/d341-display/gate.log 2>&1
"$TASK_NODE" --input-type=module -e 'import {build} from "esbuild";await build({entryPoints:["/tmp/d341-display/probe.ts"],outfile:"/tmp/d341-display/probe.mjs",bundle:true,platform:"node",format:"esm",target:"node22"});'
"$TASK_NODE" /tmp/d341-display/probe.mjs > /tmp/d341-display/before.log 2>&1

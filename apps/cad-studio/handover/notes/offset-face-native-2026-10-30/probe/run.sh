#!/bin/sh
set -eu
TASK_GATE=/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh
TASK_NODE=/Users/user/Library/pnpm/nodejs/22.19.0/bin/node
trap '"$TASK_GATE" release >> /tmp/d342-probe/gate.log 2>&1' EXIT
"$TASK_GATE" acquire heavy 1800 d342-offset-baseline >> /tmp/d342-probe/gate.log 2>&1
python3 /tmp/d342-probe/capsule.py source-before
"$TASK_NODE" --version > /tmp/d342-probe/node-version.txt
"$TASK_NODE" --input-type=module -e 'import{build}from"esbuild";import{writeFileSync}from"node:fs";const result=await build({entryPoints:["/tmp/d342-probe/probe.ts"],outfile:"/tmp/d342-probe/probe.mjs",bundle:true,platform:"node",format:"esm",target:"node22",metafile:true});writeFileSync("/tmp/d342-probe/bundle-metafile.json",JSON.stringify(result.metafile,null,2));' > /tmp/d342-probe/bundle.log 2>&1
"$TASK_NODE" /tmp/d342-probe/probe.mjs > /tmp/d342-probe/run-first.log 2>&1
python3 /tmp/d342-probe/independent-oracle.py > /tmp/d342-probe/oracle-first.log 2>&1
python3 /tmp/d342-probe/capsule.py source-after

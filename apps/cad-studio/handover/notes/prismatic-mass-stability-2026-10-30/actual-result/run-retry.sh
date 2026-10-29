#!/bin/sh
set -eu
TASK_GATE=/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh
TASK_NODE=/Users/user/Library/pnpm/nodejs/22.19.0/bin/node
trap '"$TASK_GATE" release >> /tmp/d343-actual-result/gate.log 2>&1' EXIT
"$TASK_GATE" acquire heavy 1800 d343-actual-retry >> /tmp/d343-actual-result/gate.log 2>&1
"$TASK_NODE" --input-type=module -e 'import{readFileSync}from"node:fs";import{build}from"esbuild";import{execFileSync}from"node:child_process";import{writeFileSync}from"node:fs";const source=readFileSync("/tmp/d343-actual-result/retry-build.mjs","utf8").split("\n").slice(1).join("\n");await eval("(async()=>{"+source+"})()");' > /tmp/d343-actual-result/retry-build.log 2>&1
"$TASK_NODE" /tmp/d343-actual-result/retry-probe.mjs /tmp/d343-actual-result/retry-results.json > /tmp/d343-actual-result/retry-first.log 2>&1

#!/bin/sh
set -eu
TASK_GATE=/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh
TASK_NODE=/Users/user/Library/pnpm/nodejs/22.19.0/bin/node
trap '"$TASK_GATE" release >> /tmp/d341-display/gate.log 2>&1' EXIT
"$TASK_GATE" acquire heavy 1800 d341-display-final >> /tmp/d341-display/gate.log 2>&1
"$TASK_NODE" --input-type=module -e 'import {readFileSync,writeFileSync} from "node:fs";writeFileSync("/tmp/d341-display/baseline-runner.mjs",readFileSync("/tmp/d341-display/baseline-test.mjs"));'
"$TASK_NODE" --input-type=module -e 'import {build} from "esbuild";await build({entryPoints:["/tmp/d341-display/baseline-runner.mjs"],outfile:"/tmp/d341-display/baseline-runner-bundle.mjs",bundle:true,platform:"node",format:"esm",packages:"external"});'
NODE_PATH="$PWD/node_modules" "$TASK_NODE" /tmp/d341-display/baseline-runner-bundle.mjs > /tmp/d341-display/regression-before.log 2>&1 || true
cd packages/barocss-cad-model
"$TASK_NODE" scripts/test.mjs direct-display-domain > /tmp/d341-display/regression-after.log 2>&1
"$TASK_NODE" ../../node_modules/typescript/bin/tsc --noEmit -p . > /tmp/d341-display/types-final.log 2>&1
"$TASK_NODE" ../../node_modules/eslint/bin/eslint.js src/engine/trim.ts src/engine/direct.ts test/direct-display-domain.test.ts > /tmp/d341-display/lint-final.log 2>&1

#!/bin/sh
set -eu
TASK_GATE=/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh
TASK_NODE=/Users/user/Library/pnpm/nodejs/22.19.0/bin/node
trap '"$TASK_GATE" release >> /tmp/d343-cap-identity/gate.log 2>&1' EXIT
"$TASK_GATE" acquire heavy 1800 d343-cap-candidate >> /tmp/d343-cap-identity/gate.log 2>&1
"$TASK_NODE" --test test/prismatic-cap-identity.test.mjs > /tmp/d343-cap-identity/focused-third.log 2>&1
"$TASK_NODE" --test test/prismatic-solid.test.mjs test/prismatic-mass-stability.test.mjs test/part-model.test.mjs test/api-part.test.mjs test/api-query-snapshot.test.mjs > /tmp/d343-cap-identity/related-third.log 2>&1
"$TASK_NODE" scripts/tool.mjs type-check > /tmp/d343-cap-identity/types-third.log 2>&1
"$TASK_NODE" ../../node_modules/eslint/bin/eslint.js src/features/prismatic-solid.ts test/prismatic-cap-identity.test.mjs > /tmp/d343-cap-identity/lint-third.log 2>&1

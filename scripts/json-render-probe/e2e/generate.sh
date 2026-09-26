#!/bin/bash
# #231 generation (run once; outputs frozen in specs/ by extract.mjs).
# Rerun: bash scripts/json-render-probe/e2e/generate.sh (skips existing raw/), then node scripts/json-render-probe/e2e/extract.mjs
# Runs `claude -p` from a scratch dir outside the repo so no project CLAUDE.md is loaded.
O="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$O/raw"
cd /private/tmp/claude-501 || exit 1
for m in opus haiku; do for k in dashboard settings pricing table empty; do
  [ -s "$O/raw/$m-$k.json" ] && continue
  p=$(python3 -c "import json;d=json.load(open('$O/prompts.json'));print(d['template'].replace('{REQ}',d['requests']['$k']))")
  env -u CLAUDECODE claude -p "$p" --model $m --tools "" --output-format json > "$O/raw/$m-$k.json" 2>"$O/raw/$m-$k.err" &
done; done; wait

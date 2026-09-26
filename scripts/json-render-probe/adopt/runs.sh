#!/usr/bin/env bash
# #239 driver: prepare 3 runs x (opus, haiku) starting apps outside the repo, run a fresh `claude -p` agent in each
# (docs-only: no Bash/web/MCP/user settings, per-run budget cap), then score. Rerun from repo root:
#   PW_DIR=... CHROME=... bash scripts/json-render-probe/adopt/runs.sh [/private/tmp/claude-501/adopt-239]
set -e
W="$(cd "$(dirname "$0")/../../.." && pwd)"; A="$W/scripts/json-render-probe/adopt"
B="${1:-/private/tmp/claude-501/adopt-239}"; mkdir -p "$B"
TASK="$(cat "$A/task.txt")"
for m in opus haiku; do for i in 1 2 3; do
  d="$B/$m-$i"; rm -rf "$d"; node "$A/run.mjs" prepare "$d" >/dev/null; cp -r "$d" "$d.orig"
  cap=0.6; [ "$m" = haiku ] && cap=0.25
  ( cd "$d" && env -u CLAUDECODE claude -p "$TASK" --model "$m" --permission-mode acceptEdits --setting-sources project \
      --strict-mcp-config --disallowedTools Bash WebFetch WebSearch Task --max-budget-usd "$cap" --output-format json \
      > "$d.out.json" 2>"$d.err" ) &
done; done
wait
OUT="$B/scores.json" node "$A/run.mjs" score "$B"/opus-? "$B"/haiku-?
python3 "$A/summarize.py" "$B" > "$A/result.json"
python3 -c "import json;[print(r['run'],r['found'],r['missed'],r['elemParity'],r['cost'],r['turns']) for r in json.load(open('$A/result.json'))['runs']]"

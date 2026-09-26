#!/bin/bash
# #249 unprompted single-file HTML generation. Rerun: bash scripts/playcdn-probe/generate.sh (skips existing raw/*.json)
# Runs `claude -p` from a scratch dir so no project CLAUDE.md is loaded; no tools. Prompts name no styling library.
O="$(cd "$(dirname "$0")" && pwd)"; mkdir -p "$O/raw"
REQS=("a landing page for a small neighbourhood bakery" "a pricing page for a SaaS note-taking app with three tiers" "a dashboard prototype for an online store's sales metrics" "a personal portfolio site for a freelance photographer" "a restaurant menu page with categories and prices" "a signup / waitlist page for a new fitness app" "a blog article page with a sidebar and author bio" "an event page for a two-day tech conference with schedule and speakers")
cd /private/tmp/claude-501 || exit 1
for m in opus haiku; do for i in 1 2 3 4 5 6 7 8; do
  p="Make ${REQS[$((i-1))]} as one HTML file. Reply with only the HTML."
  [ -s "$O/raw/$m-$i.json" ] && continue
  env -u CLAUDECODE claude -p "$p" --model $m --tools "" --output-format json > "$O/raw/$m-$i.json" 2>"$O/raw/$m-$i.err" &
done; done; wait

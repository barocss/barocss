#!/bin/bash
# #209 prompted-Tailwind generation (#199 prompt + one sentence). Rerun: bash scripts/mcp-model-outputs/generate-tw.sh (skips outputs in raw-tw/).
# Runs `claude -p` from a scratch dir outside the repo so no project CLAUDE.md is loaded.
O="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$O/raw-tw"
REQS=("weather card" "filterable data table" "booking form" "chart summary" "settings panel")
cd /private/tmp/claude-501 || exit 1
for m in opus haiku; do for i in 1 2 3 4 5; do
  r="${REQS[$((i-1))]}"
  p="Write the UI for an MCP App tool result: $r. Output a single self-contained HTML document only. It is rendered in a sandboxed iframe (allow-scripts) under a Content-Security-Policy that allows inline scripts and styles plus one allowlisted resource domain for external assets. Use Tailwind CSS utility classes for styling. Reply with only the HTML."
  [ -s "$O/raw-tw/$m-$i.json" ] && continue
  env -u CLAUDECODE claude -p "$p" --model $m --tools "" --output-format json > "$O/raw-tw/$m-$i.json" 2>"$O/raw-tw/$m-$i.err" &
done; done; wait

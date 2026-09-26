#!/bin/bash
# #253 block generation (run once; raw JSON gitignored, fragments frozen in blocks/ by extract.py).
# Rerun: bash scripts/cms-probe/generate.sh   (skips existing raw/)
# Runs `claude -p` from a scratch dir outside the repo so no project CLAUDE.md is loaded.
O="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$O/raw" "$O/blocks"
cd /private/tmp/claude-501 || exit 1
for m in opus haiku; do for k in hero feature-grid callout comparison-table testimonial cta; do
  [ -s "$O/raw/$m-$k.json" ] && continue
  b=$(echo "$k" | tr '-' ' ')
  p="You are the AI assistant in our CMS. The site uses Tailwind CSS. Write the $b block as an HTML fragment with Tailwind utility classes."
  env -u CLAUDECODE claude -p "$p" --model $m --tools "" --output-format json > "$O/raw/$m-$k.json" 2>"$O/raw/$m-$k.err" &
done; done; wait
python3 "$O/extract.py"

#!/bin/bash
# #364 widget block generation (run once; raw/ is not committed, fragments are frozen in blocks/).
# Rerun: bash scripts/o5-probe/generate.sh   (skips existing raw/). `claude -p` runs outside the repo (no CLAUDE.md).
O="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$O/raw" "$O/blocks"
cd /private/tmp/claude-501 || exit 1
for m in opus haiku; do for k in product-card signup-form order-table warning-alert pricing-snippet; do
  [ -s "$O/raw/$m-$k.json" ] && continue
  b=$(echo "$k" | tr '-' ' ')
  p="You are the assistant inside a chat widget embedded on a customer's website. The widget styles replies with Tailwind CSS utility classes. Reply with a compact $b as a single HTML fragment (no <html>, no <script>) using Tailwind utility classes. Invent plausible sample content; do not ask questions."
  env -u CLAUDECODE claude -p "$p" --model $m --tools "" --output-format json > "$O/raw/$m-$k.json" 2>"$O/raw/$m-$k.err" &
done; done; wait
python3 - "$O" <<'PY'
import json, re, glob, os, sys
O = sys.argv[1]; cost = 0
for f in sorted(glob.glob(O + '/raw/*.json')):
    d = json.load(open(f)); cost += d.get('total_cost_usd', 0); t = d.get('result', '')
    m = re.search(r'```(?:html)?\s*\n(.*?)```', t, re.S)
    open(O + '/blocks/' + os.path.basename(f)[:-5] + '.html', 'w').write((m.group(1) if m else t).strip() + '\n')
print('cost_usd', round(cost, 4))
PY

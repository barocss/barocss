#!/bin/bash
# #255 block generation with the site's own theme tokens (raw JSON gitignored, fragments frozen in theme-blocks/).
# Rerun: bash scripts/cms-probe/theme-generate.sh   (skips existing theme-raw/)
O="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$O/theme-raw" "$O/theme-blocks"
cd /private/tmp/claude-501 || exit 1
T="Our Tailwind theme defines these custom tokens (use them for brand styling): colors brand-50, brand-100, brand-200, brand-300, brand-400, brand-500, brand-600, brand-700, brand-800, brand-900 (e.g. bg-brand-600, text-brand-900, border-brand-200) and accent (e.g. bg-accent, text-accent); font-display (headings); spacing gutter (e.g. p-gutter, px-gutter, gap-gutter, mt-gutter); radius card (rounded-card)."
for m in opus haiku; do for k in hero feature-grid callout comparison-table testimonial cta; do
  [ -s "$O/theme-raw/$m-$k.json" ] && continue
  b=$(echo "$k" | tr '-' ' ')
  p="You are the AI assistant in our CMS. The site uses Tailwind CSS 4. $T Write the $b block as an HTML fragment with Tailwind utility classes, using our theme tokens. Reply with only the HTML fragment in one html code fence."
  env -u CLAUDECODE claude -p "$p" --model $m --tools "" --output-format json > "$O/theme-raw/$m-$k.json" 2>"$O/theme-raw/$m-$k.err" &
done; done; wait
python3 - "$O" <<'PY'
import json, re, glob, os, sys
O = sys.argv[1]; cost = 0
for f in sorted(glob.glob(O + '/theme-raw/*.json')):
    d = json.load(open(f)); cost += d.get('total_cost_usd', 0); t = d.get('result', '')
    m = re.search(r'```(?:html)?\s*\n(.*?)```', t, re.S)
    open(O + '/theme-blocks/' + os.path.basename(f)[:-5] + '.html', 'w').write((m.group(1) if m else t).strip() + '\n')
print('cost_usd', round(cost, 4))
PY

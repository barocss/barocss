// #249 extract + classify. Rerun: node scripts/playcdn-probe/extract.mjs  -> outputs/*.html, classify.json
import fs from 'node:fs'; import path from 'node:path';
const D = path.dirname(new URL(import.meta.url).pathname);
fs.mkdirSync(path.join(D, 'outputs'), { recursive: true });
const rows = []; let cost = 0;
for (const f of fs.readdirSync(path.join(D, 'raw')).filter(f => f.endsWith('.json')).sort()) {
  const j = JSON.parse(fs.readFileSync(path.join(D, 'raw', f), 'utf8'));
  cost += j.total_cost_usd || 0;
  let h = j.result || ''; const m = h.match(/```(?:html)?\s*\n([\s\S]*?)```/); if (m) h = m[1];
  const id = f.replace('.json', ''); fs.writeFileSync(path.join(D, 'outputs', id + '.html'), h);
  const play = /cdn\.tailwindcss\.com/.test(h), v4 = /@tailwindcss\/browser/.test(h);
  const cfg = /tailwind\.config\s*=/.test(h);
  const approach = play ? (cfg ? 'playcdn+config' : 'playcdn') : v4 ? 'tw4-browser' : /<style[\s>]/.test(h) ? 'plain-style' : 'other';
  const ext = [...h.matchAll(/https?:\/\/[^"'\s)]+\.(?:css|js)\b/g)].map(x => x[0]).filter(u => !/tailwindcss/.test(u));
  rows.push({ id, approach, externalCss: ext, cost: j.total_cost_usd });
}
fs.writeFileSync(path.join(D, 'classify.json'), JSON.stringify({ cost, rows }, null, 1));
for (const r of rows) console.log(r.id, r.approach, r.externalCss.length);
console.log('cost', cost.toFixed(3));

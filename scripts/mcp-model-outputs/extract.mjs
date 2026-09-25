// Rerun: node scripts/mcp-model-outputs/extract.mjs — raw/*.json -> outputs/*.html, prompts.json, meta.json
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const H = path.dirname(fileURLToPath(import.meta.url));
const REQS = ['weather card', 'filterable data table', 'booking form', 'chart summary', 'settings panel'];
const prompt = (r) => `Write the UI for an MCP App tool result: ${r}. Output a single self-contained HTML document only. It is rendered in a sandboxed iframe (allow-scripts) under a Content-Security-Policy that allows inline scripts and styles plus one allowlisted resource domain for external assets. Reply with only the HTML.`;
fs.mkdirSync(path.join(H, 'outputs'), { recursive: true });
const meta = {}; const prompts = {};
for (const m of ['opus', 'haiku']) for (let i = 1; i <= 5; i++) {
  const j = JSON.parse(fs.readFileSync(path.join(H, `raw/${m}-${i}.json`), 'utf8'));
  let html = j.result.trim(); const f = html.match(/```(?:html)?\n([\s\S]*?)```/); if (f) html = f[1];
  fs.writeFileSync(path.join(H, `outputs/${m}-${i}.html`), html);
  prompts[`${m}-${i}`] = { model: m, request: REQS[i - 1], prompt: prompt(REQS[i - 1]), cmd: `env -u CLAUDECODE claude -p "<prompt>" --model ${m} --tools "" --output-format json` };
  meta[`${m}-${i}`] = { model: m, request: REQS[i - 1], total_cost_usd: j.total_cost_usd ?? j.cost_usd, duration_ms: j.duration_ms, models: Object.keys(j.modelUsage || {}), fenced: !!f };
}
fs.writeFileSync(path.join(H, 'prompts.json'), JSON.stringify(prompts, null, 1));
fs.writeFileSync(path.join(H, 'meta.json'), JSON.stringify(meta, null, 1));
console.log(JSON.stringify(meta));

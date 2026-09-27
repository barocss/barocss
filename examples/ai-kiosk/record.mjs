// Records one full order per persona with the REAL generator (`claude -p`), for the README / acceptance.
//   node examples/ai-kiosk/record.mjs [persona ...]        (KIOSK_MODEL=haiku|sonnet|opus, default haiku)
//   KIOSK_GENERATOR=stub node examples/ai-kiosk/record.mjs  (dry run of the script itself, no CLI)
// Writes recordings/<persona>.json: per screen the action, prompt, raw model HTML, sanitised HTML, sanitiser
// removals, the #426 no-op check (unstyled class tokens) and timings. Each run costs ~9 claude calls per persona.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createKioskServer, generatorFromEnv } from './server.mjs';
import { PERSONAS } from './lib/contract.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const personas = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(PERSONAS);
const generator = generatorFromEnv();
const out = (s) => process.stdout.write(s + '\n');

// One order: a sized drink with an option, plus a dessert. The same script for every persona.
const SCRIPT = (persona) => [
  { action: undefined }, { action: 'start' }, { action: 'choose-persona', option: persona },
  { action: 'select-item', item: 'latte' }, { action: 'set-size', option: 'L' }, { action: 'add-to-cart' },
  { action: 'open-menu' }, { action: 'select-item', item: 'croissant' }, { action: 'add-to-cart' },
  { action: 'regenerate' }, { action: 'checkout' }, { action: 'pay' },
];

const server = createKioskServer({ generator });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
let failures = 0;
try {
  for (const persona of personas) {
    if (!Object.hasOwn(PERSONAS, persona)) throw new Error(`unknown persona ${persona}`);
    const rec = { persona, generator: generator.name, recordedAt: new Date().toISOString(), screens: [] };
    let session;
    for (const step of SCRIPT(persona)) {
      const t0 = Date.now();
      const res = await fetch(`${base}/screen`, { method: 'POST', body: JSON.stringify({ ...step, session, debug: true, context: { weather: 'rainy', daypart: 'morning' } }) });
      const data = await res.json();
      if (!res.ok) { failures++; rec.screens.push({ ...step, error: data.error, ms: Date.now() - t0 }); out(`${persona} ${step.action}: ERROR ${data.error}`); break; }
      session = data.session;
      rec.screens.push({ ...step, step: data.facts.step, ms: Date.now() - t0, timings: data.timings, prompt: data.prompt, rawHtml: data.rawHtml, html: data.html, removed: data.removed, noop: data.noop, total: data.facts.total });
      out(`${persona} ${String(step.action ?? 'initial').padEnd(14)} -> ${data.facts.step.padEnd(7)} ${data.timings.genMs}ms unstyled=${data.noop.unstyled.length}/${data.noop.tokens} removed=${JSON.stringify(data.removed)}`);
    }
    const last = rec.screens.at(-1);
    rec.completed = last?.step === 'done';
    rec.unstyled = [...new Set(rec.screens.flatMap((s) => s.noop?.unstyled ?? []))];
    if (!rec.completed) failures++;
    fs.mkdirSync(path.join(HERE, 'recordings'), { recursive: true });
    fs.writeFileSync(path.join(HERE, 'recordings', `${persona}${generator.name === 'stub' ? '.stub' : ''}.json`), JSON.stringify(rec, null, 2) + '\n');
    out(`${persona}: completed=${rec.completed} unstyled=${rec.unstyled.length ? rec.unstyled.join(' ') : 0}`);
  }
} finally {
  server.close();
}
process.exitCode = failures ? 1 : 0;

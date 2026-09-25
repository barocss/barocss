// #193 fixture freezer. Chunks one model-written section like an LLM token stream: 3-5 chars per token (mean ~4),
// from a fixed-seed PRNG, so the stream is identical on every run. Rerun: node scripts/stream-probe/gen-fixture.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = 'scripts/mcp-html-probe/sections/E-007-G1.html';
const html = fs.readFileSync(path.resolve(HERE, '../..', SRC), 'utf8');
let seed = 193;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const chunks = [];
for (let i = 0; i < html.length;) { const n = 3 + Math.floor(rnd() * 3); chunks.push(html.slice(i, i + n)); i += n; }
fs.writeFileSync(path.join(HERE, 'fixture.json'), JSON.stringify({ source: SRC, chars: html.length, tokens: chunks.length, chunks }));
console.log(`${chunks.length} tokens, ${html.length} chars`);

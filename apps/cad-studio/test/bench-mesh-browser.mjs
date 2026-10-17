// A big mesh through the studio in a real Chromium (M1, R3.3): open the STL (read, weld, blobs, evaluate, show),
// save it (the container), open the saved file again, each timed, with the file's size against the old inline
// JSON. Opt-in, no budgets: PW_DIR=… [CHROME=…] node test/bench-mesh-browser.mjs [organic-200k organic-1000k scan-200k]
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';

const root = resolve(import.meta.dirname, '..');
if (!process.env.PW_DIR) { console.error('Set PW_DIR to a Playwright package directory.'); process.exit(2); }
const { chromium } = createRequire(join(process.env.PW_DIR, 'package.json'))('playwright');
const out = mkdtempSync(join(tmpdir(), 'cad-studio-mesh-browser-'));
await build({ entryPoints: [join(root, 'test/bench/mesh-fixtures.ts')], outfile: join(out, 'fixtures.mjs'), bundle: true, platform: 'node', format: 'esm', logLevel: 'warning' });
const { fixtures } = await import(join(out, 'fixtures.mjs'));
const { encodeBinaryStl } = await import('../../../packages/barocss-cad/dist/index.js');
const { createServer } = await import('vite');
const server = await createServer({ root, configFile: join(root, 'vite.config.ts'), server: { port: 52051, strictPort: false }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--enable-unsafe-webgpu'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('dialog', d => d.accept());
const names = process.argv.slice(2).length ? process.argv.slice(2) : ['organic-200k', 'organic-1000k'];
const settled = () => page.waitForFunction(() => window.__studioDoc?.nodes[0]?.kind === 'mesh' && /1 body|bodies/.test(document.querySelector('.outliner')?.textContent ?? '') && !/Computing|Working/.test(document.body.innerText), null, { timeout: 600000, polling: 100 });
const MB = n => +(n / 2 ** 20).toFixed(1);
const rows = [];
try {
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(() => /Hole Ø8/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 60000 });
  for (const name of names) {
    const f = fixtures().get(name)(), stl = join(out, `${name}.stl`), tris = f.indices.length / 3;
    writeFileSync(stl, encodeBinaryStl(f.positions, f.indices, name));
    await page.click('[aria-label="New part"]');
    let t0 = Date.now();
    await page.setInputFiles('input[aria-label="Model file"]', stl);
    await page.waitForSelector('[aria-label="Mesh units"]', { timeout: 600000 });
    const read = Date.now() - t0; t0 = Date.now();
    await page.click('[aria-label="Mesh units"] button:text-is("Open")');
    await settled();
    const open = Date.now() - t0;
    const regions = await page.evaluate(() => document.querySelector('.outliner')?.textContent ?? '');
    t0 = Date.now();
    const [saved] = await Promise.all([page.waitForEvent('download', { timeout: 600000 }), page.click('[aria-label="Save"]')]);
    const bytes = readFileSync(await saved.path()), save = Date.now() - t0;
    // (The same part as the old inline JSON would have written it: what M1 saves.)
    const node = await page.evaluate(() => window.__studioDoc.nodes[0]);
    const inlineBytes = JSON.stringify({ ...node, blob: undefined, positions: Array.from(f.positions, x => Math.round(x * 1e6) / 1e6), indices: Array.from(f.indices) }, null, 2).length;
    const file = join(out, `${name}.bcad`); writeFileSync(file, bytes);
    await page.click('[aria-label="New part"]'); await page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
    t0 = Date.now();
    await page.setInputFiles('input[aria-label="Model file"]', file);
    await settled();
    const reopen = Date.now() - t0;
    rows.push({ name, triangles: tris, readMS: read, openMS: open, saveMS: save, fileMB: MB(bytes.length), inlineJSONMB: MB(inlineBytes), reopenMS: reopen, container: bytes.subarray(0, 8).toString('latin1') === 'BCADPACK', shown: /1 body/.test(regions) });
    console.error(JSON.stringify(rows.at(-1)));
  }
} finally { await browser.close(); await server.close(); rmSync(out, { recursive: true, force: true }); }
console.log('\nfixture          tris      read ms  open ms  save ms  file MB  inline JSON MB  reopen ms');
for (const r of rows) console.log(`${r.name.padEnd(16)} ${String(r.triangles).padEnd(9)} ${String(r.readMS).padEnd(8)} ${String(r.openMS).padEnd(8)} ${String(r.saveMS).padEnd(8)} ${String(r.fileMB).padEnd(8)} ${String(r.inlineJSONMB).padEnd(15)} ${r.reopenMS}`);

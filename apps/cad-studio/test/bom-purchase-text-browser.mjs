// D732: use the real Studio BOM panel and capture the purchase CSV before browser delivery.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const [output, mode] = process.argv.slice(2);
const baseline = mode === '--baseline';
const names = ['=1+1', '+1+1', '-5 mm shim', '@label', '＝1+1', "'=1+1", 'Shim, 5 mm', '00123'];
const protectedNames = baseline ? names : names.map((name, i) => i < 6 ? "'" + name : name);
const pins = [
  'apps/cad-studio/test/bom-purchase-text-browser.mjs',
  'apps/cad-studio/src/ui/BomPanel.tsx',
  'apps/cad-studio/src/ui/files.ts',
  'packages/barocss-cad-model/src/api/assembly.ts',
  'packages/barocss-cad-model/src/chat/outputs.ts',
  'packages/barocss-cad-model/src/bom/bom.ts',
];
const f = await createFlow({
  name: 'bom-purchase-text', output, envFrozen: 'D732_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: baseline ? 'Reproduce formula-bearing purchase CSV bytes' : 'Keep purchase labels as spreadsheet text across existing exports',
  limits: ['Real Studio BOM and Worker. The CSV anchor is intercepted before a browser download.'],
  oracleSource: String.raw`
import csv, hashlib, io, json, sys
d = json.load(sys.stdin)
assert hashlib.sha256(d['text'].encode()).hexdigest() == d['sha256']
rows = list(csv.reader(io.StringIO(d['text'], newline=''), strict=True))
assert rows[0] == ['item no.', 'item', 'qty', 'kind', 'size', 'row', 'catalogue', 'source', 'estimate'], rows
assert all(len(r) == 9 for r in rows), rows
if 'expected' in d:
    assert rows[1:] == d['expected'], rows
else:
    assert len(rows) == len(d['names']) + 1, rows
    assert [r[1] for r in rows[1:]] == d['names'], rows
    assert all(r[2] == '1' and r[3] == 'part' and r[4:] == [''] * 5 for r in rows[1:]), rows
print(json.dumps({'status': 'PASS', 'rows': len(rows) - 1}))
`,
  inspectorSource: `
import assert from 'node:assert/strict';
import { Assembly } from '@barocss/cad-model/api/assembly';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import { runTool } from '@barocss/cad-model/chat/tools';
import { bomPanelData, purchaseCsv } from '@barocss/cad-model/bom/bom';
const { doc, matrix } = JSON.parse(process.argv[3]);
const accepted = JSON.stringify(doc), evaluate = async next => evaluateDoc(next, 1);
const data = await bomPanelData(doc, evaluate);
const generated = purchaseCsv(data, true);
const assembly = new Assembly('D732', doc);
process.env.CAD_AUTONOMY = '3';
const run = async (name, args) => {
  const result = await runTool({ doc, bodies: [] }, name, args, evaluate);
  assert.ok(!result.isError, result.content);
  assert.equal(JSON.stringify(result.state.doc), accepted);
  return JSON.parse(result.content);
};
const tool = await run('output_purchase_csv', { withMade: true });
const api = await assembly.purchaseCsv(true);
const json = await run('output_bom', {});
assert.equal(JSON.stringify(assembly.doc), accepted);
assert.equal(JSON.stringify(doc), accepted);
const matrixText = matrix ? purchaseCsv({
  view: { parts: [] }, single: false, made: [],
  bom: { totalQty: 3, totalMass: 0, lines: matrix.map(line => ({ parts: [], qty: 1, kind: 'part', material: null, mass: 0, ...line })) },
}) : null;
console.log(JSON.stringify({ generated, tool, api, matrixText, rawNames: JSON.parse(json.files[0].text).bom.lines.map(l => l.item), revision: json.revision }));
`,
});

const part = i => ({
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 5], id: 'n0' },
    { kind: 'extrude', sketch: 0, height: 2 + i, id: 'n1' },
  ],
  outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2,
});
const doc = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [], outputs: {}, nextId: 0,
  instances: names.map((name, i) => ({ id: 'i' + i, name, doc: part(i), position: [i * 24, 0, 0], rotation: [0, 0, 0] })),
};
const matrix = [
  { item: " '=1+1", size: '\t+1+1', row: '\r=1+1', catalogue: '\n=1+1', source: '\u200B＝1+1' },
  { item: '＋1+1', size: '－5 mm shim', row: '＠label', catalogue: '00123', source: "'O-ring", estimate: true },
  { item: 'A, "B"; C\rD\nE\tF', source: 'Supplier, "G"; =1+1' },
];
const matrixRows = [
  ['1', "' '=1+1", '1', 'part', "'\t+1+1", "'\r=1+1", "'\n=1+1", "'\u200B＝1+1", ''],
  ['2', "'＋1+1", '1', 'part', "'－5 mm shim", "'＠label", '00123', "'O-ring", 'estimate'],
  ['3', 'A, "B"; C\rD\nE\tF', '1', 'part', '', '', '', 'Supplier, "G"; =1+1', ''],
];

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const createContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await createContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    await context.addInitScript(() => {
      const urls = new Map(), originalUrl = URL.createObjectURL, click = HTMLAnchorElement.prototype.click;
      window.__purchaseCaptures = [];
      URL.createObjectURL = function (blob) {
        const url = originalUrl.call(this, blob);
        if (blob.type === 'text/csv') urls.set(url, blob);
        return url;
      };
      HTMLAnchorElement.prototype.click = function () {
        const blob = urls.get(this.href);
        if (!blob || !this.download.endsWith(' purchase list.csv')) return click.call(this);
        urls.delete(this.href);
        const name = this.download;
        window.__purchaseCaptures.push(blob.arrayBuffer().then(buffer => ({
          name, text: new TextDecoder().decode(buffer), bytes: [...new Uint8Array(buffer)],
        })));
      };
    });
    return context;
  };
  await f.newPage();
  const page = f.page;
  f.phase = 'Open the exact native assembly and evaluate its BOM';
  const source = Buffer.from(JSON.stringify(doc));
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Open', exact: true }).click()]);
  await chooser.setFiles({ name: 'D732-study.bcad', mimeType: 'application/json', buffer: source });
  await f.same(doc);
  await clickModelCommand(page, 'Inspect', 'BOM');
  const panel = page.getByRole('complementary', { name: 'BOM panel', exact: true });
  const buy = panel.getByRole('button', { name: 'Export purchase list', exact: true });
  const getRows = () => panel.getByRole('table', { name: 'BOM lines', exact: true }).getByRole('row').all();
  await panel.getByRole('row', { name: 'BOM line ' + names.length, exact: true }).waitFor();
  const rows = (await getRows()).slice(1);
  assert.deepEqual(await Promise.all(rows.map(row => row.getByRole('cell').nth(1).textContent())), names);
  const before = await f.snapshot('unmodified-bom-labels');
  const inspect = await f.inspect('tool-and-public-api', {}, { doc, ...(!baseline ? { matrix } : {}) });
  assert.deepEqual(inspect.rawNames, names);
  assert.equal(inspect.tool.revision, inspect.revision);
  assert.equal(inspect.api.revision, inspect.revision);

  f.phase = 'Export through the actual BOM control with made parts included';
  await buy.click();
  const captures = () => page.evaluate(() => Promise.all(window.__purchaseCaptures));
  const bought = (await captures())[0];
  assert.equal(bought.text, 'item no.,item,qty,kind,size,row,catalogue,source,estimate\n');
  await panel.getByRole('checkbox', { name: 'Purchase list with made parts', exact: true }).check();
  await buy.click();
  const all = await captures();
  assert.equal(all.length, 2);
  const { text, name, bytes } = all[1];
  assert.equal(name, 'D732-study purchase list.csv');
  assert.deepEqual(Buffer.from(bytes), Buffer.from(text));
  assert.equal(text, inspect.generated);
  for (const result of [inspect.tool, inspect.api]) {
    assert.equal(result.files[0].text, text);
    assert.equal(result.files[0].sha256, sha256(text));
    assert.equal(result.files[0].bytes, Buffer.byteLength(text));
    assert.deepEqual(result.bom.lines.map(line => line.item), names);
  }
  await f.runOracle({ text, sha256: sha256(text), names: protectedNames }, 'purchase-csv-readback');
  await writeFile(join(output, 'purchase.csv'), Buffer.from(bytes));
  if (!baseline) {
    const text = inspect.matrixText;
    await f.runOracle({ text, sha256: sha256(text), expected: matrixRows }, 'purchase-csv-metadata-readback');
    await writeFile(join(output, 'purchase-metadata.csv'), text);
  }
  await f.same(doc);
  const after = await f.snapshot('export-keeps-document-and-history');
  assert.deepEqual(after.history, before.history);
  assert.deepEqual(after.bodies, before.bodies);
  assert.deepEqual(f.report.downloads, []);
  f.report.observations.push({ sha256: sha256(text), bytes: Buffer.byteLength(text), source: sha256(source), revision: inspect.revision });
});

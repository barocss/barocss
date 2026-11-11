import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const [output, input] = process.argv.slice(2);
const repo = resolve(import.meta.dirname, '../../..');
for (const path of [output, input]) {
  assert.ok(path && isAbsolute(path) && relative(repo, path).startsWith('../'), 'Use external evidence paths');
}
const source = await readFile(input);
const receipt = JSON.parse(await readFile(join(dirname(input), 'receipt.json'), 'utf8'));
assert.equal(receipt.status, 'PASS');
const saved = receipt.files.find(file => file.source === 'Actual Studio OPFS');
assert.ok(saved, 'The D587 receipt must bind the Studio project bytes');
assert.equal(sha256(source), saved.hash);
const doc = JSON.parse(source);
assert.equal(doc.parameters.H, 10);
assert.deepEqual(doc.nodes.map(node => node.kind), ['sketch', 'extrude', 'hole']);
assert.equal(doc.brief.material.value, 'al6061');

const pins = [
  'apps/cad-studio/test/single-part-bom-material-browser.mjs',
  'packages/barocss-cad-model/src/bom/bom.ts',
  'apps/cad-studio/src/ui/BomPanel.tsx',
  'apps/cad-studio/server/cadMcp.ts',
];
const f = await createFlow({
  name: 'single-part-bom-material', envFrozen: 'D588_SOURCE_FROZEN', output,
  qualification: 'Known standalone BOM material from actual Studio and local stdio MCP',
  initialFiles: [...pins, 'apps/cad-studio/test/model-rail-helper.mjs'], requiredFrozen: pins,
  limits: ['One known-material native plate. Studio shows quantity and mass. The public BOM JSON exposes material identity.'],
  oracleSource: `
import json, math, sys
cases = json.load(sys.stdin)
volume = (20*10-math.pi*2**2)*10
for actual, density in zip(cases, [0.0027, 0.00785], strict=True):
    expected = volume*density
    assert abs(actual['volume']-volume) <= 1e-8
    assert actual['uiMassG'] == round(expected, 1)
    assert actual['outputMassG'] == round(expected, 3)
print(json.dumps({'status': 'PASS', 'volumeMm3': volume, 'checkedCases': len(cases)}))
`,
});
const button = name => f.page.getByRole('button', { name, exact: true });
const localMcp = join(repo, 'apps/cad-studio/scripts/cad-mcp.mjs');

async function publicBom(file, label) {
  const original = await readFile(file);
  const call = { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'query', arguments: { action: 'bom' } } };
  const initialize = { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } };
  const result = spawnSync(process.execPath, [localMcp, '--doc', file], {
    input: [initialize, call].map(frame => JSON.stringify(frame) + '\n').join(''),
    encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024,
  });
  await writeFile(join(f.output, label + '-mcp.jsonl'), result.stdout ?? '');
  await writeFile(join(f.output, label + '-mcp.stderr.txt'), result.stderr ?? '');
  assert.equal(result.status, 0, result.stderr);
  const [hello, reply] = result.stdout.trim().split('\n').map(line => JSON.parse(line));
  assert.equal(hello.result.serverInfo.version, 'barocss-cad-tools-v2');
  assert.equal(reply.id, 2);
  assert.equal(reply.result.isError, false, result.stdout);
  const output = JSON.parse(reply.result.content[0].text);
  const [artifact] = output.files;
  assert.equal(artifact.path, 'bom.json');
  assert.equal(artifact.sha256, sha256(artifact.text));
  const { bom } = JSON.parse(artifact.text);
  assert.deepEqual(bom, output.bom);
  assert.equal(bom.totalQty, 1);
  assert.equal(bom.lines.length, 1);
  assert.deepEqual(bom.lines[0].parts, ['base']);
  assert.deepEqual(await readFile(file), original);
  return { material: bom.lines[0].material, outputMassG: bom.totalMass };
}

async function studioBom(label, expectedG) {
  await clickModelCommand(f.page, 'Inspect', 'BOM');
  const totals = f.page.getByLabel('BOM totals', { exact: true });
  await totals.waitFor();
  await f.page.getByRole('row', { name: 'BOM line 1', exact: true }).waitFor();
  const view = await f.snapshot(label, () => ({ totals: document.querySelector('[aria-label="BOM totals"]')?.textContent }));
  const measured = /^1 part · 0 bought elements · ([\d.]+) g/.exec(view.totals);
  assert.ok(measured, view.totals);
  assert.equal(Number(measured[1]), expectedG);
  assert.equal(view.bodies.bodies.length, 1);
  await button('Close BOM').click();
  return { doc: view.doc, uiMassG: Number(measured[1]), volume: view.bodies.bodies[0].volume };
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  f.report.runtimeOwnership = { nodePID: process.pid, nodePPID: process.ppid, serverURL: origin };
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    return context;
  };
  f.phase = 'actual Studio BOM for exact D587 source';
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'D587-saved-plate.bcad', mimeType: 'application/json', buffer: source });
  await f.same(doc);
  const al = await studioBom('01-brief-aluminium', 5.1);
  assert.deepEqual(al.doc, doc);

  f.phase = 'actual Studio body material override and first Undo';
  await f.page.locator('.outliner .ol', { hasText: /Extrude.*Hole/ }).click();
  const material = f.page.getByLabel('Material', { exact: true });
  assert.equal(await material.inputValue(), 'al6061');
  await material.selectOption('steel');
  await f.changed(doc);
  const steel = await studioBom('02-body-steel', 14.7);
  assert.deepEqual(steel.doc.nodes, doc.nodes);
  assert.deepEqual(steel.doc.brief, doc.brief);
  assert.deepEqual(Object.values(steel.doc.bodies).map(look => look.material), ['steel']);
  await f.undo();
  await f.same(doc);
  assert.deepEqual((await studioBom('03-undo-aluminium', 5.1)).doc, doc);

  f.phase = 'public standalone BOM identity and independent arithmetic';
  const steelFile = join(f.output, 'studio-steel.bcad');
  await writeFile(steelFile, JSON.stringify(steel.doc));
  const alOutput = await publicBom(input, 'aluminium'), steelOutput = await publicBom(steelFile, 'steel');
  f.report.materials = [alOutput.material, steelOutput.material];
  await f.runOracle([{ ...al, ...alOutput }, { ...steel, ...steelOutput }], 'single-part-material');
  assert.deepEqual(f.report.materials, ['al6061', 'steel']);
  assert.deepEqual(f.report.downloads, []);
});

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFlow, sha256 } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const pins = ['apps/cad-studio/src/ui/Hud.tsx', 'apps/cad-studio/src/ui/NodeEditor.tsx',
  'packages/barocss-cad-model/src/sketch/internal/roundedInsetRecipe.ts', 'packages/barocss-cad-model/src/engine/errors.ts'];
const f = await createFlow({
  name: 'rounded-inset-fillet-refusal',
  output: process.argv[2], envFrozen: 'D1186_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Explain why a saved rounded inset refuses Fillet and verify explicit detachment.',
  limits: ['Exact saved rounded inset from the November desktop QA snapshot. Desktop WebGPU.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { checkBrep, massPropertiesOf } from '@barocss/cad';
import { bodyMesh } from '@barocss/cad-model/engine/mesh';
import { partSnapshot } from '@barocss/cad-model/engine/part';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const { outputs } = partSnapshot(doc);
const [result] = outputs;
console.log(JSON.stringify({
  count: outputs.length, valid: checkBrep(result.brep, { strict: true }).valid, solids: result.bodyCount,
  mass: massPropertiesOf(result),
  edges: bodyMesh(result.brep, 0).edges.map(({ index, names, straight }) => ({ index, names, straight })),
}));
`,
});
const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} vs ${expected}`);

await f.run(async () => {
  const bytes = await readFile(process.argv[3]);
  const hash = sha256(bytes);
  assert.equal(hash, '5d4e6f0c7b96301afe534e78424e06155d657ae7214b915dda3a16963105a6b0');
  f.report.files.push({ name: 'stored-inset.bcad', bytes: bytes.length, sha256: hash });
  const expected = JSON.parse(bytes.toString());
  await f.newPage();
  await f.openFile(process.argv[3], 3);
  await f.same(expected);
  const stock = await f.inspect('stored-inset-native', expected);
  assert.ok(stock.valid && stock.count === 1 && stock.solids === 1);
  const area = (20 * 10 - 16 + 4 * Math.PI) - (18 * 8 - 4 + Math.PI);
  near(stock.mass.volume, 10 * area);

  await button('Top', f.page.getByRole('group', { name: 'Views', exact: true })).click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  const filter = button('Selection filter');
  for (let i = 0; i < 4 && !(await filter.innerText()).trim().endsWith('Edges'); i++) await filter.click();
  assert.match((await filter.innerText()).trim(), /Edges$/);

  const observations = [];
  for (const [label, world, tag] of [
    ['straight', [10, 1, 10], 'e9'],
    ['arc', [18 + Math.SQRT1_2, 2 - Math.SQRT1_2, 10], 'e10'],
  ]) {
    f.phase = `Pick the ${label} inset edge and read its refusal`;
    const pixel = await f.page.evaluate(point => window.__studioScreenOf(point), world);
    assert.ok(pixel?.length === 2);
    await f.page.mouse.click(...pixel);
    await f.page.waitForFunction(() => window.__studioSelection.selection.edges.length === 1);
    const [choice] = await f.page.evaluate(() => window.__studioSelection.selection.edges);
    const edge = stock.edges.find(edge => edge.index === choice.edge);
    assert.ok(edge?.names.some(name => name.includes(`[${tag}]`)), JSON.stringify(edge));
    assert.equal(edge.straight, label === 'straight');
    await clickModelCommand(f.page, 'Modify', 'Fillet');
    const hud = f.page.getByRole('dialog', { name: 'Fillet', exact: true });
    const input = hud.getByLabel('Radius', { exact: true });
    await input.fill('');
    await hud.getByText('Enter a value', { exact: true }).waitFor();
    await input.fill('0.1');
    const notice = hud.getByRole('status');
    await notice.locator('details').waitFor();
    assert.equal(await button('Apply', hud).isEnabled(), false);
    assert.equal(await notice.locator('details').getAttribute('open'), null);
    const copy = await notice.locator(':scope > div').evaluateAll(nodes => nodes.slice(0, 2).map(node => node.textContent));
    const detail = await notice.locator('code').textContent();
    await f.same(expected);
    assert.equal(await f.page.getByLabel('Unsaved changes', { exact: true }).count(), 0);
    await f.snapshot(`${label}-refused`);
    observations.push({ label, copy, detail, names: edge.names });
    await button('Cancel', hud).click();
    await f.same(expected);
  }
  f.report.observations.push(...observations);
  for (const { copy, detail } of observations) {
    assert.equal(copy[0], 'The linked inset only supports its Extrude');
    assert.match(copy[1], /Detach inset.*link/i);
    assert.match(detail, /\[BAD_REFERENCE\].*only one direct Extrude/);
  }

  f.phase = 'Detach through the accepted Extrude History';
  await f.openFeatureEditor(2, 'Open Extrude History');
  await button('Detach inset', f.editor()).click();
  await f.changed(expected);
  const detached = (await f.snapshot('inset-detached')).doc;
  assert.equal(detached.nodes.length, 3);
  assert.equal(detached.nodes[1].kind, 'sketch');
  assert.equal(detached.nodes[1].id, expected.nodes[1].id);
  assert.deepEqual(detached.nodes[2], expected.nodes[2]);
  const fresh = await f.inspect('detached-inset-native', detached);
  assert.ok(fresh.valid && fresh.solids === 1);
  near(fresh.mass.volume, stock.mass.volume);
  assert.deepEqual(fresh.edges, stock.edges);
  await f.undo();
  await f.same(expected);
  await f.redo();
  await f.same(detached);
});

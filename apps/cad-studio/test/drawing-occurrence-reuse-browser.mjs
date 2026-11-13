import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const fixture = 'apps/cad-studio/test/fixtures/assembly-cut.bcad';
const pins = [
  fixture, 'apps/cad-studio/test/drawing-occurrence-reuse-browser.mjs',
  'apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/ui/DrawingWorkspace.tsx',
  'packages/barocss-cad-model/src/assembly/takenIds.ts', 'packages/barocss-cad-model/src/drawing/dimensions.ts',
];
const f = await createFlow({
  name: 'drawing-occurrence-reuse', output: process.argv[2], envFrozen: 'D1029_SOURCE_FROZEN',
  qualification: 'A new placed part cannot take a deleted occurrence’s saved Drawing diameter.',
  limits: ['One Top diameter on a separated Ø12 occurrence. Duplicate and native Insert part, Undo/Redo, browser Project Save/Open and SVG.'],
  initialFiles: pins, requiredFrozen: pins,
  oracleSource: String.raw`
import json, re, sys, xml.etree.ElementTree as ET
x = json.load(sys.stdin)
s = "{http://www.w3.org/2000/svg}"
root = ET.fromstring(x["svg"])
groups = [g for g in root.iter(s+"g") if g.get("data-dim") == x["dim"]]
values = [t.text for g in groups for t in g.findall(s+"text") if t.text and "Ø" in t.text]
assert len(groups) in (0,1) and len(values)==len(groups), values
print(json.dumps({"status":"PASS", "diameter":float(re.search(r"Ø\s*(\d+(?:\.\d+)?)", values[0])[1]) if values else None}))
`,
});
const button = (name, within = f.page) => within.getByRole('button', { name, exact: true });
const mode = name => button(name, f.page.locator('.mode')).click();
const drawing = () => f.page.getByRole('complementary', { name: 'Drawing settings', exact: true });
const row = name => f.page.locator('.ol.instance:not(.nested)').filter({ hasText: name }).first();
const instance = () => f.page.getByRole('complementary', { name: 'Instance', exact: true });
const file = 'drawing-occurrence-reuse.bcad';
const project = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });

async function check(label, doc, dim) {
  await mode('Drawing');
  await f.page.waitForFunction(id => window.__studioDrawing?.()?.dimensions.some(d => d.id === id), dim);
  const index = await f.page.evaluate(() => window.__drawingCaptures.length);
  await button('Export SVG', drawing()).click();
  const svg = await f.page.evaluate(i => window.__drawingCaptures[i], index);
  const model = await f.page.evaluate(id => window.__studioDrawing().dimensions.find(d => d.id === id), dim);
  const state = await f.snapshot(label);
  assert.deepEqual(state.doc, doc);
  const result = await f.runOracle({ svg, dim }, label);
  const diameter = typeof model.value === 'number' ? Math.round(model.value * 1e6) / 1e6 : null;
  assert.equal(result.diameter, diameter);
  f.report.files.push({ label, sha256: sha256(svg), kind: 'Studio SVG' });
  f.report.observations.push({ label, diameter, lost: model.lost ?? null });
  await f.persist();
  return diameter;
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return url.origin === origin ? route.continue() : route.abort();
    });
    await context.addInitScript(() => {
      const urls = new Map(), create = URL.createObjectURL, click = HTMLAnchorElement.prototype.click;
      window.__drawingCaptures = [];
      URL.createObjectURL = function (blob) {
        const url = create.call(this, blob);
        if (blob.type === 'image/svg+xml') urls.set(url, blob);
        return url;
      };
      HTMLAnchorElement.prototype.click = function () {
        const blob = urls.get(this.href);
        if (!blob || !this.download.endsWith('.svg')) return click.call(this);
        window.__drawingCaptures.push(blob.text());
        urls.delete(this.href);
      };
    });
    return context;
  };
  await f.newPage();
  const doc = JSON.parse(await readFile(join(f.repo, fixture), 'utf8'));
  const holed = (part, radius) => ({
    ...part, nodes: [...part.nodes, { kind: 'hole', parent: { node: 1, side: 'solid' }, radius, center: [30, 20], face: 'n1.top', id: 'n2' }],
    outputs: { b2: { node: 2, side: 'solid' } }, nextId: 3,
  });
  doc.instances[0].doc = holed(doc.instances[0].doc, 4);
  Object.assign(doc.instances[1], { doc: holed(doc.instances[1].doc, 6), position: [76, -10, 5], part: { id: 'wide-plate', rev: 'A' } });
  const [open] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await open.setFiles({ name: file, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await f.same(doc);

  f.phase = 'Duplicate, separate and dimension the original occurrence';
  await row('Plate 2').click();
  await button('Duplicate', instance()).click();
  await f.page.waitForFunction(() => window.__studioDoc.instances?.length === 3);
  const copy = (await f.doc()).instances.at(-1);
  const x = instance().getByLabel('Instance X', { exact: true }).first();
  await x.fill('112');
  await x.press('Enter');
  await f.page.waitForFunction(() => window.__studioDoc.instances.at(-1).position[0] === 112);
  await mode('Drawing');
  await drawing().getByLabel('Drawing scope', { exact: true }).selectOption('assembly');
  await f.page.waitForFunction(() => window.__studioDrawingAt?.('top', 98, 40));
  const tools = f.page.getByRole('navigation', { name: 'Drawing tools', exact: true });
  await button('Diameter', tools).click();
  const pick = async (u, v) => {
    const point = await f.page.evaluate(([u,v]) => window.__studioDrawingAt('top', u, v), [u,v]);
    assert.ok(point);
    await f.page.mouse.click(point.x, point.y);
  };
  await pick(98, 40);
  await pick(117, 40);
  await f.page.waitForFunction(() => window.__studioDoc.drawing?.dimensions.length === 1);
  const original = await f.doc(), dim = original.drawing.dimensions[0];
  assert.ok(dim.edge.startsWith(copy.id + '/'), dim.edge);
  assert.equal(await check('original', original, dim.id), 12);

  f.phase = 'Remove the dimensioned occurrence and preserve the lost reference';
  await mode('Model');
  await row('Plate 2 copy').click();
  await button('Remove', instance()).click();
  await f.changed(original);
  const deleted = await f.doc();
  assert.ok(!deleted.instances.some(i => i.id === copy.id));
  assert.deepEqual(deleted.drawing.dimensions, [dim]);
  assert.equal(await check('removed', deleted, dim.id), null);
  await f.undo();
  await f.same(original);
  assert.equal(await check('undo-removal', original, dim.id), 12);
  await f.redo();
  await f.same(deleted);
  assert.equal(await check('redo-removal', deleted, dim.id), null);

  f.phase = 'Duplicate the same plate and then insert a different plate';
  await mode('Model');
  await row('Plate 2').click();
  await button('Duplicate', instance()).click();
  await f.changed(deleted);
  const duplicated = await f.doc();
  assert.deepEqual(duplicated.drawing.dimensions, [dim]);
  const newCopy = duplicated.instances.at(-1);
  const duplicateDiameter = await check('replacement-duplicate', duplicated, dim.id);
  await f.undo();
  await f.same(deleted);
  assert.equal(await check('undo-duplicate', deleted, dim.id), null);
  await f.redo();
  await f.same(duplicated);
  assert.equal(await check('redo-duplicate', duplicated, dim.id), duplicateDiameter);
  await f.undo();
  await f.same(deleted);
  await mode('Model');

  const insert = button('Insert part');
  const trigger = async () => {
    if (await insert.isVisible()) return insert.click();
    await button('More tools').click();
    await f.page.getByRole('menuitem', { name: 'Insert part', exact: true }).click();
  };
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), trigger()]);
  await chooser.setFiles({ name: 'Spare 8 mm plate.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc.instances[0].doc)) });
  await f.changed(deleted);
  const inserted = await f.doc(), newPart = inserted.instances.at(-1);
  assert.deepEqual(inserted.drawing.dimensions, [dim]);
  const insertDiameter = await check('replacement-insert', inserted, dim.id);

  f.phase = 'Save and reopen the original reference with the newly inserted part present';
  await mode('Model');
  const attach = async () => {
    await button('Project and versions').click();
    await project().getByRole('textbox', { name: 'Browser project name', exact: true }).fill('D1029 Drawing Occurrence');
    await button('Project in this browser', project()).click();
    await project().getByLabel('Project', { exact: true }).waitFor();
  };
  await attach();
  await button('Save').click();
  await project().getByRole('list', { name: 'Project documents', exact: true }).getByText(file, { exact: true }).waitFor();
  await button('Close project', project()).click();
  await f.page.reload();
  await f.ready();
  await attach();
  await button('Open ' + file, project()).click();
  await f.same(inserted);
  assert.equal(await check('reopened-insert', inserted, dim.id), insertDiameter);

  f.phase = 'Check that replacement ids do not bind the old dimension';
  const identity = { original: copy.id, duplicate: newCopy.id, insert: newPart.id, duplicateDiameter, insertDiameter };
  f.report.observations.push(identity);
  await f.persist();
  assert.notEqual(newCopy.id, copy.id, JSON.stringify(identity));
  assert.notEqual(newPart.id, copy.id, JSON.stringify(identity));
  assert.equal(duplicateDiameter, null);
  assert.equal(insertDiameter, null);
  assert.deepEqual(f.report.downloads, []);
});

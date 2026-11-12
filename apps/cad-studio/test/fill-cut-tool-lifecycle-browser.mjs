import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const output = process.argv[2], repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
await mkdir(output);
const seedSource = 'apps/cad-studio/test/fixtures/linear-cut-pattern.bcad';
const seed = JSON.parse(await readFile(resolve(repo, seedSource), 'utf8'));
seed.nodes.push({ kind: 'fill-feature-pattern', parent: { node: 5, side: 'solid' },
  region: { points: [[15, 6], [48, 6], [48, 28], [15, 28]], holes: [[[25, 17], [27, 17], [27, 19], [25, 19]]] },
  anchor: [10, 10], spacing: 16, count: 3, spacing2: 8, count2: 3, id: 'n6' });
seed.outputs = { b6: { node: 6, side: 'solid' } };
seed.nextId = 7;
const name = 'masked-fill-cut', file = join(output, name + '.bcad'), project = 'D784 Fill Cut ' + randomUUID();
await writeFile(file, JSON.stringify(seed));

const expected = width => {
  const doc = structuredClone(seed);
  if (width !== 4) {
    doc.nodes[2].max[0] = width;
    delete doc.nodes[3].made;
  }
  return doc;
};
const pins = ['apps/cad-studio/test/fill-cut-tool-lifecycle-browser.mjs', seedSource,
  'apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/ui/NodeEditor.tsx',
  'packages/barocss-cad-model/src/app/editFields.ts', 'packages/barocss-cad-model/src/engine/part.ts',
  'packages/barocss-cad/src/features/fill-cut-pattern.ts', 'packages/barocss-cad/src/part/part-transform.ts'];
const f = await createFlow({
  name: 'fill-cut-tool-lifecycle', envFrozen: 'D784_SOURCE_FROZEN', output,
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Edit the original rectangular tool of a masked Fill cut pattern and reopen the exact project document.',
  limits: ['One upright rectangular stock and disjoint through tools.',
    'The grid filters reference points. The original cut stays even outside the mask.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, faceGeometry, massPropertiesOf } from '@barocss/cad';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
if (process.argv[3]) {
  try {
    evaluateCadPart(toPartDocument(doc));
    console.log(JSON.stringify({ accepted: true }));
  } catch (error) {
    console.log(JSON.stringify({ code: error.code, feature: error.feature, message: error.message }));
  }
  process.exit(0);
}
const { outputs } = evaluateCadPart(toPartDocument(doc)), [body] = outputs;
if (outputs.length !== 1) throw new Error('Expected one Fill cut output.');
const { brep } = body, validity = checkOutput(body), { volume, centroid, method } = massPropertiesOf(body);
const loops = new Map(brep.loops.map(loop => [loop.id, loop]));
const coedges = new Map(brep.coedges.map(use => [use.id, use]));
const edges = new Map(brep.edges.map(edge => [edge.id, edge]));
const vertices = new Map(brep.vertices.map(vertex => [vertex.id, vertex.point]));
const caps = brep.faces.flatMap(face => {
  const geometry = faceGeometry(face);
  if (geometry.kind !== 'plane' || Math.abs(geometry.n[2]) < 0.999) return [];
  const holes = face.loops.map(id => loops.get(id)).filter(loop => loop?.kind === 'inner').map(loop =>
    loop.coedges.map(id => {
      const use = coedges.get(id), edge = edges.get(use.edge);
      return vertices.get(edge.vertices[use.sense === 'forward' ? 0 : 1]);
    }));
  return [{ z: geometry.o[2], normal: geometry.n, holes }];
});
console.log(JSON.stringify({ id: body.id, volume, centroid, method, validity, caps,
  closed: brep.shells.map(shell => shell.closed) }));
`,
  oracleSource: String.raw`
import json
import math
import sys
from fractions import Fraction as F

data = json.load(sys.stdin)
w, native, studio = data["width"], data["native"], data["studio"]
assert w in (4, 6, 8)
assert native["id"] == "n6" and native["validity"]["valid"] and native["closed"] == [True]
assert native["validity"]["counts"]["bodies"] == native["validity"]["counts"]["shells"] == 1
assert native["method"] != "tessellated"

def close(actual, expected):
    assert math.isfinite(actual) and abs(actual - float(expected)) < 1e-8, (actual, expected)

# Column zero lies outside the mask. The original (0,0) still cuts.
# The rectangular hole excludes (1,1) and the other selected cells cut.
cells = [(0,0), (1,0), (2,0), (2,1), (1,2), (2,2)]
origins = [(8+16*i, 8+8*j) for i,j in cells]
for cap, z, sign in zip(sorted(native["caps"], key=lambda cap: cap["z"]), (0,10), (-1,1), strict=True):
    close(cap["z"], z)
    for actual, exact in zip(cap["normal"], (0,0,sign), strict=True):
        close(actual, exact)
    rings = []
    for x,y in origins:
        rings.append(sorted((a,b,z) for a in (x,x+w) for b in (y,y+4)))
    for ring, want in zip(sorted(map(sorted, cap["holes"])), sorted(rings), strict=True):
        for corner, pin in zip(ring, want, strict=True):
            for actual, exact in zip(corner, pin, strict=True):
                close(actual, exact)

tool = 40*w
v = 18000-len(cells)*tool
cx = (540000-tool*sum(x+F(w,2) for x,_ in origins))/v
cy = (270000-tool*sum(y+2 for _,y in origins))/v
assert studio["key"] == "b6"
for body in (native, studio):
    close(body["volume"], v)
    for actual, exact in zip(body["centroid"], (cx,cy,5), strict=True):
        close(actual, exact)
print(json.dumps({"status": "PASS", "widthMm": w, "volumeMm3": v, "centroidMm": [float(cx), float(cy), 5],
                  "cutCells": cells, "capRims": 12, "productImports": 0}))
`,
});

const button = (parent, label) => parent.getByRole('button', { name: label, exact: true });
const editorField = label => f.editor().getByRole('spinbutton', { name: label, exact: true });
async function observe(label, width) {
  f.phase = label;
  await f.same(expected(width));
  const state = await f.snapshot(label);
  const [body] = state.bodies.bodies;
  assert.equal(state.bodies.bodies.length, 1);
  const native = await f.inspect(label + '-native', state.doc);
  await f.runOracle({ width, native, studio: body }, label);
  return state;
}
async function widthEdit(from, to) {
  await f.openFeatureEditor(3, 'original Cut tool');
  const field = editorField('Width');
  assert.equal(Number(await field.inputValue()), from);
  await field.fill(String(to));
  await button(f.editor(), 'Apply').click();
  await f.same(expected(to));
  await f.closeEditor();
}
const versions = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
async function openProject() {
  if (!(await versions().isVisible())) await button(f.page, 'Project and versions').click();
  await versions().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await button(versions(), 'Project in this browser').click();
  await versions().getByLabel('Project', { exact: true }).waitFor();
}

await f.run(async () => {
  await f.newPage();
  f.phase = 'open the masked Fill cut source';
  await f.openFile(file, 7);
  await observe('01-initial-tool', 4);
  await widthEdit(4, 6);
  const accepted = await observe('02-wider-tool', 6);

  await f.openFeatureEditor(3, 'invalid source tool');
  f.phase = 'refuse a zero-width original tool';
  await editorField('Width').fill('0');
  await button(f.editor(), 'Apply').click();
  const refusal = f.editor().locator('.hud-error');
  await refusal.getByText('Kernel detail', { exact: true }).click();
  const invalid = expected(0);
  const nativeRefusal = await f.inspect('03-invalid-tool-native', invalid, 'refusal');
  assert.deepEqual([nativeRefusal.code, nativeRefusal.feature], ['PARAMETER', 'n2']);
  assert.match(nativeRefusal.message, /rectangle min must be below max on both axes/i);
  await refusal.getByText(/rectangle min must be below max on both axes/i).waitFor();
  await f.same(accepted.doc);
  const refused = await f.snapshot('03-refused-zero-width');
  assert.deepEqual(refused.bodies.bodies, accepted.bodies.bodies);
  assert.deepEqual(refused.history, accepted.history);
  f.report.observations.push({ nativeRefusal, editor: await refusal.innerText() });
  await f.closeEditor();

  await f.undo();
  await observe('04-first-undo', 4);
  await f.redo();
  await observe('05-first-redo', 6);

  f.phase = 'save the accepted Fill cut in its project';
  await openProject();
  assert.equal(await f.page.locator('.doc-tab input').inputValue(), name);
  await button(f.page, 'Save').click();
  const path = name + '.bcad';
  await versions().getByRole('list', { name: 'Project documents', exact: true }).getByText(path, { exact: true }).waitFor();
  const saved = await f.page.evaluate(async ([project, path]) => {
    const root = await navigator.storage.getDirectory();
    const projects = await root.getDirectoryHandle('projects');
    const directory = await projects.getDirectoryHandle(project);
    return (await (await directory.getFileHandle(path)).getFile()).text();
  }, [project, path]);
  assert.deepEqual(JSON.parse(saved), accepted.doc);
  await writeFile(join(output, 'saved-fill-cut.bcad'), saved);
  f.report.observations.push({ savedSHA256: sha256(saved), savedBytes: Buffer.byteLength(saved) });

  await f.page.reload();
  await f.page.waitForSelector('.viewport[data-renderer="webgpu"]');
  await f.ready();
  assert.notDeepEqual(await f.doc(), accepted.doc);
  await openProject();
  await button(versions(), 'Open ' + path).click();
  await observe('06-project-open', 6);
  await widthEdit(6, 8);
  await observe('07-post-open-tool-edit', 8);
  assert.deepEqual(f.report.downloads, []);
});

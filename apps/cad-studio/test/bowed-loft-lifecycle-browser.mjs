import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const output = process.argv[2], repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
await mkdir(output);

const seed = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 2,
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10] },
    { id: 'n1', kind: 'loft', from: [0, 0], sections: [{ sketch: 0, z: 0 }, { sketch: 0, z: 20 }],
      guide: { kind: 'nurbs', degree: 2, knots: [0, 0, 0, 0.5, 1, 1, 1],
        controlPoints: [[0, 0, 0], [8, 0, 5], [-4, 2, 14], [0, 0, 20]] } },
  ],
  outputs: { b1: { node: 1, side: 'solid' } },
};
const file = join(output, 'bowed-loft.bcad'), project = 'D783 bowed Loft ' + randomUUID();
await writeFile(file, JSON.stringify(seed));
const edited = (width, depth) => {
  const doc = structuredClone(seed);
  doc.nodes[0].max = [width, depth];
  return doc;
};

const pins = ['apps/cad-studio/test/bowed-loft-lifecycle-browser.mjs',
  'apps/cad-studio/src/App.tsx', 'apps/cad-studio/src/ui/NodeEditor.tsx',
  'apps/cad-studio/src/ui/FeatureFailureNotice.tsx',
  'packages/barocss-cad-model/src/app/editFields.ts', 'packages/barocss-cad-model/src/engine/part.ts',
  'packages/barocss-cad/src/features/loft.ts', 'packages/barocss-cad/src/features/loft-nurbs-guide.ts',
  'packages/barocss-cad/test/loft-nurbs-guide.test.mjs'];
const f = await createFlow({
  name: 'bowed-loft-lifecycle', envFrozen: 'D783_SOURCE_FROZEN', output,
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Edit a rectangle shared by two sections of a bowed guided Loft, refuse a moved guide anchor and reopen the exact saved part.',
  limits: ['One two-span quadratic polynomial guide on parallel ruled rectangular sections.',
    'Independent slice integrals and a strict native B-rep verify geometry. The Studio flow separately verifies the current displayed body.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { checkOutput, evaluateCadPart, evaluateCurve, massPropertiesOf } from '@barocss/cad';
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
if (outputs.length !== 1) throw new Error('Expected one Loft output.');
const { brep } = body, validity = checkOutput(body), { volume, centroid, method } = massPropertiesOf(body);
const seam = brep.edges.find(edge => edge.id === 'l0_0');
if (!seam) throw new Error('The stable guide seam is missing.');
const { curve } = seam, a = curve.knots[curve.degree], b = curve.knots[curve.controlPoints.length];
const uses = brep.coedges.filter(use => use.edge === seam.id);
const sides = uses.map(use => {
  const loop = brep.loops.find(loop => loop.id === use.loop);
  return brep.faces.find(face => face.id === loop?.face)?.name;
}).sort();
console.log(JSON.stringify({ output: body.id, validity, volume, centroid, method,
  seam: { id: seam.id, vertices: seam.vertices, curve: { degree: curve.degree, knots: curve.knots,
    controlPoints: curve.controlPoints, weights: curve.weights },
    samples: Array.from({ length: 9 }, (_, i) => evaluateCurve(curve, a + (b - a) * i / 8)), uses, sides },
  closed: brep.shells.map(shell => shell.closed),
}));
`,
  oracleSource: String.raw`
import json
import math
import sys
from fractions import Fraction as F

data = json.load(sys.stdin)
w, d = data["size"]
native, studio = data["native"], data["studio"]
assert native["output"] == "n1" and native["validity"]["valid"]
counts = native["validity"]["counts"]
assert counts["bodies"] == counts["shells"] == 1 and native["closed"] == [True]
assert [counts[name] for name in ("vertices", "edges", "faces", "loops", "coedges")] == [8, 12, 6, 6, 24]

def close(actual, exact):
    assert math.isfinite(actual) and abs(actual - float(exact)) < 1e-8, (actual, str(exact))

def vec(actual, expected):
    for a, b in zip(actual, expected, strict=True):
        close(a, b)

# The quadratic seam on each knot span, written as a power polynomial in local s.
def guide(t):
    if t <= F(1, 2):
        s = 2*t
        return (16*s-14*s*s, s*s, 10*s-s*s/2)
    s = 2*t-1
    return (2-12*s+10*s*s, 1+2*s-3*s*s, F(19,2)+9*s+3*s*s/2)

seam = native["seam"]
assert seam["id"] == "l0_0" and seam["vertices"] == ["v0_0", "v1_0"]
assert seam["curve"]["degree"] == 2 and seam["curve"]["weights"] == [1, 1, 1, 1]
assert seam["sides"] == ["n1.side0", "n1.side3"]
for i, point in enumerate(seam["samples"]):
    vec(point, guide(F(i, 8)))
a, b = seam["uses"]
assert a["twin"] == b["id"] and b["twin"] == a["id"] and a["sense"] != b["sense"]

# Each horizontal slice is a translated rectangle. The guide integrals against dz
# are 24, 40/3 and 200. Dividing by the 20 mm height gives the mean offset.
volume = 20*w*d
centre = (F(w, 2) + F(24,20), F(d, 2) + F(40,60), F(200,20))
assert native["method"] != "tessellated"
close(native["volume"], volume)
vec(native["centroid"], centre)
assert studio["key"] == "b1"
close(studio["volume"], volume)
vec(studio["centroid"], centre)
print(json.dumps({"status": "PASS", "volumeMm3": volume, "centroidMm": [float(x) for x in centre],
                  "seamSamples": len(seam["samples"]), "strictCounts": counts, "productImports": 0}))
`,
});

const button = (parent, name) => parent.getByRole('button', { name, exact: true });
const same = (width, depth) => f.same(edited(width, depth));
async function qualify(label, width, depth) {
  f.phase = label;
  await same(width, depth);
  const state = await f.snapshot(label);
  assert.equal(state.bodies.bodies.length, 1);
  const native = await f.inspect(label + '-native', state.doc);
  const oracle = await f.runOracle({ size: [width, depth], native, studio: state.bodies.bodies[0] }, label);
  f.report.reads.push({ label, width, depth, volumeMm3: native.volume, centroidMm: native.centroid, method: native.method, oracle });
  return state;
}
async function changeField(field, from, to, width, depth) {
  await f.openFeatureEditor(1, field);
  const input = f.editor().getByRole('spinbutton', { name: field, exact: true });
  assert.equal(Number(await input.inputValue()), from);
  await input.fill(String(to));
  await button(f.editor(), 'Apply').click();
  await same(width, depth);
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
  f.phase = 'open the original bowed Loft';
  await f.openFile(file, 2);
  await qualify('01-original', 10, 10);

  await changeField('Section 1 · Width', 10, 12, 12, 10);
  const accepted = await qualify('02-width-edit', 12, 10);
  await f.openFeatureEditor(1, 'guide endpoint refusal');
  f.phase = 'refuse a section corner that moves away from the guide';
  const corner = f.editor().getByRole('spinbutton', { name: 'Section 1 · Corner X', exact: true });
  assert.equal(await corner.inputValue(), '0');
  await corner.fill('1');
  await button(f.editor(), 'Apply').click();
  const notice = f.editor().locator('.hud-error');
  await notice.getByText('Kernel detail', { exact: true }).click();
  await notice.getByText(/guide must pass through a vertex of section 0/i).waitFor();
  const refusal = await notice.innerText();
  assert.match(refusal, /Failed feature · Loft.*\(n1\)/i);
  await same(12, 10);
  const refused = await f.snapshot('03-refused-corner');
  assert.deepEqual(refused.bodies.bodies, accepted.bodies.bodies);
  assert.deepEqual(refused.history, accepted.history);
  assert.equal(await corner.inputValue(), '1');
  const invalid = edited(12, 10);
  invalid.nodes[0].min = [1, 0];
  invalid.nodes[0].max = [13, 10];
  const nativeRefusal = await f.inspect('03-refused-corner-native', invalid, 'refusal');
  assert.deepEqual([nativeRefusal.code, nativeRefusal.feature], ['GEOMETRY', 'n1']);
  assert.match(nativeRefusal.message, /guide must pass through a vertex of section 0/i);
  await f.closeEditor();
  await f.dismissToasts();
  f.report.observations.push({ refusedCornerXMm: 1, refusal, nativeRefusal, previousAcceptedBodyRetained: true });

  await f.undo();
  await qualify('04-first-undo', 10, 10);
  await f.redo();
  await qualify('05-first-redo', 12, 10);

  f.phase = 'save the accepted Loft in its browser project';
  await openProject();
  const name = 'bowed-loft';
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
  await writeFile(join(output, 'saved-bowed-loft.bcad'), saved);
  f.report.observations.push({ savedSHA256: sha256(saved), savedBytes: Buffer.byteLength(saved) });

  await f.page.reload();
  await f.page.waitForSelector('.viewport[data-renderer="webgpu"]');
  await f.ready();
  assert.notDeepEqual(await f.doc(), accepted.doc);
  await openProject();
  await button(versions(), 'Open ' + path).click();
  const reopened = await qualify('06-fresh-project-open', 12, 10);
  assert.deepEqual(reopened.doc, JSON.parse(saved));

  await changeField('Section 1 · Depth', 10, 14, 12, 14);
  await qualify('07-post-open-depth-edit', 12, 14);
  assert.deepEqual(f.report.downloads, []);
});

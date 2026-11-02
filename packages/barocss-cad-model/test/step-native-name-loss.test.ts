import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, exportStep } from '@barocss/cad';
import { emptyDoc, withNode, type StudioDoc, type PartInstance } from '../src/engine/doc';
import { exportStudioStep, partBreps } from '../src/engine/evaluate';

const loss = 'Non-ASCII and control characters in native face and edge names are not retained in this STEP file.';
const headerLoss = 'Non-ASCII and control characters in the STEP header file name and product name are replaced with underscores.';
const options = { name: 'exchange', timestamp: '2026-11-02T00:00:00' };
const generated = evaluateCadPart({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [
  { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [30, 12] },
  { id: 'n1', kind: 'extrude', sketch: 'n0', height: 6 },
] }).outputs[0].brep;
const ordinary = { ...generated, faces: generated.faces.map((face, index) => index ? face : { ...face, name: 'ordinary' }) };
// N304 5.2, 6.4.3.1 and 8.2.2 permit raw UTF-8 string characters with implementation level 4;1.
// Only label tokens/header level change; no Unicode directive decoding or new geometry is introduced.
const seed = exportStep(ordinary, { name: 'ordinary', timestamp: options.timestamp })
  .replace("FILE_DESCRIPTION(('BaroCSS CAD part'),'2;1');", "FILE_DESCRIPTION(('BaroCSS CAD part'),'4;1');");
assert.ok(seed.includes("FILE_DESCRIPTION(('BaroCSS CAD part'),'4;1');"), 'The raw UTF-8 fixture declares implementation level 4;1');
function imported(step: string): StudioDoc { return withNode(emptyDoc(), { kind: 'import', name: 'part.step', step }); }
function faceStep(rawToken: string): string { return seed.replace("ADVANCED_FACE('ordinary',", 'ADVANCED_FACE(' + rawToken + ','); }
function nativeNames(doc: StudioDoc): { faces: string[]; edges: string[] } {
  const faces: string[] = [], edges: string[] = [];
  for (const part of partBreps(doc)) {
    for (const face of part.brep.faces) faces.push(face.name ?? '');
    for (const edge of part.brep.edges) edges.push(edge.name ?? '');
  }
  return { faces, edges };
}
function occurrence(doc: StudioDoc, hidden = false): PartInstance {
  return { id: 'instance', name: 'Assembly part', doc, position: [50, 0, 0], rotation: [0, 0, 0], part: { id: 'source', rev: '1' }, ...(hidden ? { hidden: true } : {}) };
}
const plain = imported(seed), utf = imported(faceStep("'Face-é'"));

test('an included native UTF-8 face name gets one truthful report while output and authored data retain their existing policy', () => {
  const before = structuredClone(utf);
  assert.ok(nativeNames(utf).faces.includes('n0.Face-é'), 'The real native field exists before the writer');
  const result = exportStudioStep(utf, options);
  assert.deepEqual(result.omitted, [loss]);
  assert.ok(result.text.includes("ADVANCED_FACE('n0.Face-_',"));
  assert.deepEqual(utf, before);
  assert.equal(exportStudioStep(plain, options).omitted, undefined);
});

test('an actual retained native edge name is covered by the same single report', () => {
  const match = seed.match(/EDGE_CURVE\('([^']*)',/)!;
  const text = seed.replace(match[0], "EDGE_CURVE('Edge-é',");
  const doc = imported(text);
  assert.ok(nativeNames(doc).edges.includes('n0.Edge-é'), 'The public native read retains the selected edge name');
  const result = exportStudioStep(doc, options);
  assert.deepEqual(result.omitted, [loss]);
  assert.ok(result.text.includes("EDGE_CURVE('n0.Edge-_',"));
});

test('printable literal names and header-only control replacement do not invent native name loss', () => {
  const bs = String.fromCharCode(92), literal = 'literal' + bs + 'face';
  const doc = imported(faceStep("'literal" + bs + bs + "face'"));
  assert.ok(nativeNames(doc).faces.includes('n0.' + literal));
  assert.equal(exportStudioStep(doc, options).omitted, undefined);
  assert.deepEqual(exportStudioStep(plain, { ...options, name: 'A' + String.fromCharCode(9) + 'B' }).omitted, [headerLoss]);
});

test('ignored input header, product, surface and curve names do not become native name warnings', () => {
  const text = seed.replace("FILE_NAME('ordinary.step'", "FILE_NAME('file-é.step'")
    .replace("PRODUCT('ordinary','ordinary'", "PRODUCT('product-é','product-é'")
    .replace("PLANE('',", "PLANE('surface-é',").replace("LINE('',", "LINE('curve-é',");
  assert.ok(text.includes("FILE_NAME('file-é.step'"));
  assert.ok(text.includes("PRODUCT('product-é','product-é'"));
  assert.ok(text.includes("PLANE('surface-é',"));
  assert.ok(text.includes("LINE('curve-é',"));
  const doc = imported(text), names = nativeNames(doc);
  for (const value of names.faces) assert.doesNotMatch(value, /[^\x20-\x7e]/);
  for (const value of names.edges) assert.doesNotMatch(value, /[^\x20-\x7e]/);
  assert.equal(exportStudioStep(doc, options).omitted, undefined);
});

test('hidden occurrences are excluded, visible occurrences included, and base look.hidden is not an export filter', () => {
  const hidden: StudioDoc = { ...plain, instances: [occurrence(utf, true)] };
  const hiddenResult = exportStudioStep(hidden, options);
  assert.equal(hiddenResult.omitted, undefined);
  assert.equal((hiddenResult.text.match(/=MANIFOLD_SOLID_BREP\(/g) ?? []).length, 1);
  const visible = exportStudioStep({ ...plain, instances: [occurrence(utf)] }, options);
  assert.ok(visible.omitted?.includes(loss));
  assert.equal(visible.omitted?.filter(value => value === loss).length, 1);
  const baseHidden = exportStudioStep({ ...utf, bodies: { b0: { hidden: true } } }, options);
  assert.deepEqual(baseHidden.omitted, [loss]);
  assert.equal((baseHidden.text.match(/=MANIFOLD_SOLID_BREP\(/g) ?? []).length, 1);
  const labelOnly = exportStudioStep({ ...plain, bodies: { b0: { name: 'Visible-é' } } }, options);
  assert.ok(labelOnly.omitted?.some(value => value.startsWith('User body and occurrence labels')));
  assert.ok(!labelOnly.omitted?.includes(loss));
});

test('the representable excluded infill mesh role reports its existing exclusion rather than a saved-label native warning', () => {
  // A saved mesh label is not a native face/edge name. Use the declared mesh role, not an invented import role.
  const doc = withNode(plain, { kind: 'mesh', name: 'Saved-é', unit: 'mm', role: 'infill',
    positions: [0, 0, 0, 30, 0, 0, 30, 12, 0, 0, 12, 0, 0, 0, 6, 30, 0, 6, 30, 12, 6, 0, 12, 6],
    indices: [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7],
  });
  const result = exportStudioStep(doc, options);
  assert.ok(result.omitted?.some(value => value.startsWith('lattice infill not included')));
  assert.ok(!result.omitted?.includes(loss));
});

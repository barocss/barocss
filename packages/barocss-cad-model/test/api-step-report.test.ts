import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { exportStep } from '@barocss/cad';
import { Part, kernelBackend, part as cadPart, BarocssError } from '@barocss/cad/api';
import { part } from '../src/api/index';
import { emptyDoc, withNode, prefixDoc, type StudioDoc, type PartInstance } from '../src/engine/doc';
import { evaluateDoc, exportStudioStep, partBreps, type StudioStep } from '../src/engine/evaluate';
import { captureSignatures } from '../src/engine/references';

const timestamp = '2026-11-01T00:00:00';
// The actual writer's default clock uses toISOString().slice(0, 19). No STEP bytes are normalized.
function fixedClock<T>(run: () => T, tick?: () => void): T {
  const Original = globalThis.Date, descriptor = Object.getOwnPropertyDescriptor(globalThis, 'Date')!;
  class FixedDate extends Original { constructor() { super(timestamp + 'Z'); tick?.(); } }
  Object.defineProperty(globalThis, 'Date', { ...descriptor, value: FixedDate });
  try { return run(); } finally { Object.defineProperty(globalThis, 'Date', descriptor); }
}
function report(value: object, name?: string): StudioStep {
  assert.ok('stepReport' in value, 'The public Part must expose stepReport');
  assert.equal(typeof value.stepReport, 'function');
  return Reflect.apply(value.stepReport as (...args: unknown[]) => unknown, value, name === undefined ? [] : [name]) as StudioStep;
}
const box = (): StudioDoc => withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 8] }), { kind: 'extrude', sketch: 0, height: 6 });
const instance = (id: string, doc: StudioDoc, hidden = false): PartInstance => ({ id, name: id, doc, position: [30, 0, 0], rotation: [0, 0, 0], part: { id: 'shared', rev: '1' }, ...(hidden ? { hidden: true } : {}) });
function matches(doc: StudioDoc, name = 'exchange') {
  const before = JSON.stringify(doc), expected = exportStudioStep(doc, { name, timestamp });
  const result = fixedClock(() => report(part(name, doc)));
  assert.deepEqual(result, expected);
  assert.equal(JSON.stringify(doc), before);
  return result;
}
function refuses(run: () => unknown, code: string) {
  assert.throws(run, (error: unknown) => error instanceof BarocssError && error.code === code);
}

test('legacy Model STEP remains text with the exact existing writer bytes', () => {
  const doc = box();
  assert.equal(fixedClock(() => part('legacy', doc).step()), exportStudioStep(doc, { name: 'legacy', timestamp }).text);
});
test('Model report exposes the actual native text, source revision and history loss', () => {
  const result = matches(box());
  assert.ok(result.omitted?.some(item => item.includes('feature history')));
  assert.match(result.text, new RegExp(`source revision ${result.source}`));
});
test('Model report forwards parameter, appearance, PMI and datum losses exactly', () => {
  const doc: StudioDoc = { ...box(), parameters: { width: 10 }, bodies: { b1: { name: 'Prism', material: 'steel', color: '#ff0000' } },
    drawing: { sheet: 'A4', projection: 'third', hidden: true, dimensions: [] },
    references: { version: 1, references: [], keepouts: [], datums: [{ id: 'd', name: 'Origin', kind: 'plane', origin: [0, 0, 0], normal: [0, 0, 1], xAxis: [1, 0, 0] }] } };
  const loss = matches(doc).omitted!.join(' ');
  for (const word of ['parameters', 'labels', 'colours', 'PMI', 'datums']) assert.ok(loss.includes(word), word);
});
test('nested visible occurrences forward existing flattening losses, excluding hidden definitions', () => {
  const doc = { ...emptyDoc(), instances: [instance('sub', { ...emptyDoc(), instances: [instance('leaf', box())] }), instance('hidden', box(), true)] };
  const result = matches(doc);
  assert.ok(result.omitted?.some(item => item.includes('flattened')));
  assert.equal((result.text.match(/=MANIFOLD_SOLID_BREP\(/g) ?? []).length, 1);
});
test('plain imported STEP does not invent an empty omissions list or feature losses', () => {
  const step = exportStudioStep(box(), { name: 'seed', timestamp }).text;
  const result = matches(withNode(emptyDoc(), { kind: 'import', name: 'seed.step', step }));
  assert.equal(result.omitted, undefined);
  assert.ok(!Object.hasOwn(result, 'omitted'));
});
test('non-ASCII export names preserve the existing name-loss report and requested name policy', () => {
  const result = matches(box(), 'München');
  assert.ok(result.omitted?.some(item => item.includes('header file name')));
  assert.ok(result.text.includes("PRODUCT('M_nchen','M_nchen'"));
});
test('infill omission is forwarded rather than presented as a loss-free file', () => {
  const doc = withNode(box(), { kind: 'mesh', name: 'infill', unit: 'mm', role: 'infill', positions: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1], indices: [0, 2, 1, 0, 1, 3, 1, 2, 3, 2, 0, 3] });
  assert.ok(matches(doc).omitted?.some(item => item.startsWith('lattice infill not included')));
});
test('selected body view retains the legacy all-body export, default name and explicit name', () => {
  const model = part('two bodies').box({ w: 10, d: 8, h: 6 }).box({ w: 2, d: 3, h: 4 });
  const selected = model.body(model.bodies()[0]);
  fixedClock(() => {
    assert.equal(report(selected).text, model.step());
    assert.equal(report(selected, 'explicit').text, model.step('explicit'));
    assert.equal((report(selected).text.match(/=MANIFOLD_SOLID_BREP\(/g) ?? []).length, 2);
  });
});

function bandDoc(): StudioDoc {
  const base = prefixDoc({ ...emptyDoc(), nodes: [{ kind: 'sketch', profile: 'circle', center: [0, 0], radius: 20 }, { kind: 'extrude', sketch: 0, height: 10 }, { kind: 'sketch', profile: 'circle', center: [0, 0], radius: 10 }, { kind: 'extrude', sketch: 2, height: 10, from: 40 }] }, 4);
  const result = evaluateDoc(base, 0); assert.ok(result.ok, result.ok ? '' : result.error.detail);
  const rim = (node: number, up: boolean) => {
    const body = result.bodies.find(item => item.ref?.node === node)!;
    const face = body.mesh.faces.find(item => item.kind === 'plane' && (up ? item.normal[2] > .99 : item.normal[2] < -.99))!;
    return [...new Set(body.mesh.edges.filter(item => item.faces.includes(face.index)).flatMap(item => item.names))];
  };
  return captureSignatures(withNode(base, { kind: 'band-surface', version: 1, a: { parent: { node: 1, side: 'solid' }, edges: rim(1, true) }, b: { parent: { node: 3, side: 'solid' }, edges: rim(3, false) } }), result.bodies);
}
test('legacy and report both refuse partially omitted band sheets with the existing typed export error', () => {
  const doc = bandDoc();
  assert.ok(exportStudioStep(doc, { name: 'band', timestamp }).omitted?.some(item => item.startsWith('band sheet')));
  const model = part('band', doc);
  assert.throws(() => model.step(), (error: unknown) => error instanceof BarocssError && error.code === 'EXPORT' && /band sheet/.test(error.message));
  assert.throws(() => report(model), (error: unknown) => error instanceof BarocssError && error.code === 'EXPORT' && /band sheet/.test(error.message));
});
test('empty Model report retains the actual NO_BODY refusal', () => { refuses(() => report(part()), 'NO_BODY'); });
test('invalid Model documents retain the existing typed evaluation refusal', () => {
  const doc = withNode(box(), { kind: 'extrude', sketch: 0, height: 0 });
  assert.throws(() => part('invalid', doc), (error: unknown) => error instanceof BarocssError);
});
test('CAD legacy STEP works, but CAD cannot invent a supported loss report', () => {
  const model = cadPart('kernel').box({ w: 2, d: 3, h: 4 });
  assert.equal(typeof model.step(), 'string');
  refuses(() => report(model), 'UNAVAILABLE');
});
test('third-party backend without optional reporting keeps legacy STEP and explicitly refuses reports', () => {
  let calls = 0;
  const backend = { ...kernelBackend, step: () => { calls++; return 'custom STEP'; } };
  const model = new Part(backend, 'custom', backend.empty());
  assert.equal(model.step(), 'custom STEP');
  refuses(() => report(model), 'UNAVAILABLE');
  assert.equal(calls, 1, 'Unsupported reporting must not silently run legacy export');
});
test('supported backend is called once per report with the current document and requested name', () => {
  const doc = kernelBackend.empty(), received: string[] = [], output = { text: 'owned STEP', source: 'producer-revision', omitted: ['producer loss'] };
  const backend = { ...kernelBackend, stepReport: (input: typeof doc, name: string) => { assert.deepEqual(input, doc); received.push(name); return output; }, step: () => { throw new Error('Do not use legacy fallback'); } };
  const model = new Part(backend, 'default', doc);
  assert.deepEqual(report(model), output);
  assert.deepEqual(received, ['default']);
  assert.deepEqual(report(model, 'requested'), output);
  assert.deepEqual(received, ['default', 'requested']);
});
test('returned report and omission list are detached from backend-owned data and later calls', () => {
  const output = { text: 'original', source: 'source', omitted: ['loss'] };
  const backend = { ...kernelBackend, stepReport: () => output };
  const model = new Part(backend, 'custom', backend.empty());
  const first = report(model);
  assert.ok(first.omitted);
  first.text = 'changed'; first.source = 'changed'; first.omitted!.push('invented'); first.omitted![0] = 'changed';
  assert.deepEqual(output, { text: 'original', source: 'source', omitted: ['loss'] });
  assert.deepEqual(report(model), output);
});


test('Model report performs one existing export, with no discarded second file', () => {
  const doc = box(); let directTicks = 0, reportTicks = 0;
  const expected = fixedClock(() => exportStudioStep(doc, { name: 'once' }), () => directTicks++);
  const model = part('once', doc);
  const actual = fixedClock(() => report(model), () => reportTicks++);
  assert.deepEqual(actual, expected);
  assert.ok(directTicks > 0, 'The real exporter must use the default file clock');
  assert.equal(reportTicks, directTicks, 'Reporting must not export once for text and again for losses');
});
test('native face-name loss from the actual imported geometry reaches the public report', () => {
  const native = partBreps(box())[0].brep;
  const named = { ...native, faces: native.faces.map((face, i) => i ? face : { ...face, name: 'ordinary' }) };
  const seed = exportStep(named, { name: 'seed', timestamp })
    .replace("FILE_DESCRIPTION(('BaroCSS CAD part'),'2;1');", "FILE_DESCRIPTION(('BaroCSS CAD part'),'4;1');")
    .replace("ADVANCED_FACE('ordinary',", "ADVANCED_FACE('é',");
  assert.ok(seed.includes("ADVANCED_FACE('é',"));
  const doc = withNode(emptyDoc(), { kind: 'import', name: 'named.step', step: seed });
  assert.ok(partBreps(doc)[0].brep.faces.some(face => face.name === 'n0.é'), 'The importer retains the native name under its existing node namespace');
  assert.ok(matches(doc).omitted?.some(item => item.includes('native face and edge names')));
});
test('the existing native sphere missing-bbox validation warning reaches the public report', async () => {
  const { massTranslationSphereStep } = await import(resolve(import.meta.dirname, '../../barocss-cad/test/brep-mass-translation-fixtures.mjs')) as { massTranslationSphereStep(options?: { radius?: number }): string };
  const doc = withNode(emptyDoc(), { kind: 'import', name: 'sphere.step', step: massTranslationSphereStep({ radius: 4 }) });
  const expected = exportStudioStep(doc, { name: 'exchange', timestamp });
  assert.ok(expected.omitted?.includes('Bounding-box validation is not included in this STEP file.'));
  assert.deepEqual(matches(doc), expected);
});
test('display mesh uses the same existing default STEP representation without claiming analytic source', () => {
  const doc = withNode(emptyDoc(), { kind: 'mesh', name: 'tetrahedron', unit: 'mm', representation: 'facets', positions: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1], indices: [0, 2, 1, 0, 1, 3, 1, 2, 3, 2, 0, 3] });
  const result = matches(doc);
  assert.match(result.text, /MANIFOLD_SOLID_BREP/);
  assert.equal(result.source, exportStudioStep(doc, { name: 'exchange', timestamp }).source);
});

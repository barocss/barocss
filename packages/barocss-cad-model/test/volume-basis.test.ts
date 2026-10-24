import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { brepMassProperties } from '@barocss/cad';
import { evaluateDoc, partBreps, volumeBasisOf, type BodyResult } from '../src/engine/evaluate';
import { emptyDoc, rectanglePart, type StudioDoc } from '../src/engine/doc';
import { commands, type Ctx } from '../src/app/commands';
import { massProperties } from '../src/analysis/analysis';
import { withLook } from '../src/app/bodies';
import { bomView, deriveBom, type Bom, type BomView } from '../src/team/assembly';
import { runOutputTool } from '../src/chat/outputs';
import { quotePackage, QUOTE_FILES } from '../src/mould/quote';

// O179 (the kernel's D200): a curved body the quadrature cannot integrate gets its mass from the mesh. The value was
// shown as exact. Now the kernel's method and bound reach the body (volumeBasis), mass_properties says so beside
// volume and mass (volume_basis), and the BOM's lines and total and the quote's part mark such a mass an estimate
// with its bound. An exact method carries none.
const blank: Ctx = { doc: emptyDoc(), bodies: [], selection: { faces: [], edges: [], bodies: [] } };
const cmd = (id: string) => commands.find(c => c.id === id)!;
const ball = (): StudioDoc => cmd('sphere').build!(blank, { ...cmd('sphere').defaults!(blank), r: 4, x: 0, y: 0, z: 0 });
const bodiesOf = (doc: StudioDoc) => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, r.ok ? '' : r.error.detail); return r.bodies; };
/** The kernel's own tessellated result for the ball (the quadrature turned off), as the fallback gives it. */
function tessellated(doc: StudioDoc) {
  const m = brepMassProperties(partBreps(doc)[0].brep, 2700, { quadratureSegments: 0 });
  assert.equal(m.method, 'tessellated');
  return m;
}
/** The ball's body as a body whose quadrature was refused: the kernel's tessellated volume, method and bound. */
function fallen(doc: StudioDoc): BodyResult[] {
  const m = tessellated(doc), b = bodiesOf(doc)[0];
  return [{ ...b, volume: m.volume, mass: m.mass * 1000, volumeBasis: volumeBasisOf(m) }];
}

test('O179: the kernel\'s tessellated mass — its method and bound kept on the body; an exact method\'s none', () => {
  const doc = ball(), m = tessellated(doc), basis = volumeBasisOf(m);
  assert.ok(basis && basis.method === 'tessellated' && basis.bound! > 0, JSON.stringify(basis));
  // (The bound holds the error: the ball's exact volume 4/3 π r³ within it.)
  assert.ok(Math.abs(m.volume - 4 / 3 * Math.PI * 64) <= basis.bound!, `${m.volume} vs ${4 / 3 * Math.PI * 64}, bound ${basis.bound}`);
  // (The ball as evaluated: the quadrature's, exact — no basis on the body.)
  assert.equal(bodiesOf(doc)[0].volumeBasis, undefined);
  assert.equal(volumeBasisOf(brepMassProperties(partBreps(doc)[0].brep, 2700)), undefined);
});

test('O179: mass_properties says a tessellated volume is one, with the volume\'s and the mass\'s bound; an exact one says nothing new', () => {
  const doc = ball(), [b] = fallen(doc), bound = b.volumeBasis!.bound!;
  const [row] = massProperties(doc, [b]) as { volume_basis?: { method: string; bound: number; massBound: number; note: string }; mass: number }[];
  assert.equal(row.volume_basis?.method, 'tessellated');
  assert.ok(Math.abs(row.volume_basis!.bound - bound) < 1e-3);
  // (Aluminium by default, 2.70 g/cm³: the mass's bound is the volume's times it.)
  assert.ok(Math.abs(row.volume_basis!.massBound - bound * 2.7 / 1000) < 1e-3, JSON.stringify(row.volume_basis));
  assert.match(row.volume_basis!.note, /estimate/);
  assert.equal((massProperties(doc, bodiesOf(doc))[0] as { volume_basis?: unknown }).volume_basis, undefined);
});

test('O179: the BOM — a placed part whose mass is partly from the mesh: its line an estimate with its bound, the total\'s bound; an exact part\'s line as before', async () => {
  const part = ball(), plate = rectanglePart(40, 20, 5);
  const doc: StudioDoc = { ...emptyDoc(), instances: [{ id: 'p1', name: 'Ball', doc: part, position: [0, 0, 0], rotation: [0, 0, 0] }, { id: 'p2', name: 'Plate', doc: plate, position: [50, 0, 0], rotation: [0, 0, 0] }] };
  // (The evaluation the BOM is given: the ball's body as the fallback gives it, the plate's as evaluated.)
  const evaluate = async (d: StudioDoc) => { const r = evaluateDoc(d, 1); return r.ok && d === part ? { ...r, bodies: fallen(part) } : r; };
  const bom = deriveBom(await bomView(doc, evaluate));
  const ballLine = bom.lines.find(l => l.item === 'Ball')!, plateLine = bom.lines.find(l => l.item === 'Plate')!;
  const bound = fallen(part)[0].volumeBasis!.bound! * 2.7 / 1000;
  assert.ok(ballLine.estimate === true && Math.abs(ballLine.massBound! - bound) < 1e-6, JSON.stringify(ballLine));
  assert.deepEqual([plateLine.estimate, plateLine.massBound], [undefined, undefined]);
  assert.ok(Math.abs(bom.totalMassBound! - bound) < 1e-6, String(bom.totalMassBound));
  // (Nothing from the mesh: no bound on the total.)
  assert.equal(deriveBom(await bomView(doc, async d => evaluateDoc(d, 1))).totalMassBound, undefined);
});

test('O179: public BOM mass bounds retain grams, null, omission and positive zero through view, lines, base and actual output_bom', async () => {
  const part = ball(), plate = rectanglePart(40, 20, 5), fallback = fallen(part);
  const placed = [{ id: 'p1', name: 'Ball', doc: part, position: [0, 0, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number] }, { id: 'p2', name: 'Plate', doc: plate, position: [50, 0, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number] }];
  const doc: StudioDoc = { ...emptyDoc(), instances: placed };
  const given = (target: StudioDoc, bodies: BodyResult[]) => async (d: StudioDoc) => { const r = evaluateDoc(d, 1); return r.ok && d === target ? { ...r, bodies } : r; };
  const evaluate = given(part, fallback), view = await bomView(doc, evaluate), bom = deriveBom(view);
  // Independent oracle: 1000 mm³ = 1 cm³ and the existing aluminium fixture is 2.70 g/cm³.
  const expected = Math.round((fallback[0].volumeBasis!.bound! / 1000 * 2.7) * 1e6) / 1e6 + 0;
  assert.equal(view.parts[0].massBound, expected);
  assert.equal(bom.lines.find(l => l.item === 'Ball')!.massBound, expected);
  assert.equal(bom.totalMassBound, expected);
  assert.equal(Object.hasOwn(view.parts[1], 'massBound'), false);
  assert.equal(Object.hasOwn(bom.lines.find(l => l.item === 'Plate')!, 'massBound'), false);
  const noAliases = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    assert.equal(Object.hasOwn(value, 'massBoundG'), false);
    assert.equal(Object.hasOwn(value, 'totalMassBoundG'), false);
    for (const child of Object.values(value)) noAliases(child);
  };
  noAliases({ view, bom });
  // Same already-evaluated ball part twice: keep the original per-merge r6 and total order.
  const mergedView: BomView = { ...view, parts: [view.parts[0], { ...view.parts[0], id: 'p1-copy' }] };
  const merged = deriveBom(mergedView), twice = Math.round((expected + expected) * 1e6) / 1e6 + 0;
  assert.equal(merged.lines.length, 1); assert.equal(merged.lines[0].qty, 2);
  assert.equal(merged.lines[0].massBound, twice); assert.equal(merged.totalMassBound, twice);
  assert.equal(merged.lines[0].estimate, true); noAliases(merged);
  const unknownBodies: BodyResult[] = [{ ...fallback[0], volumeBasis: { method: 'tessellated', bound: null } }];
  const unknownView = await bomView(doc, given(part, unknownBodies)), unknown = deriveBom(unknownView);
  assert.equal(unknownView.parts[0].massBound, null); assert.equal(unknown.lines[0].massBound, null); assert.equal(unknown.totalMassBound, null);
  const unknownMerge = deriveBom({ ...mergedView, parts: [mergedView.parts[0], { ...mergedView.parts[1], massBound: null }] });
  assert.equal(unknownMerge.lines[0].massBound, null); assert.equal(unknownMerge.totalMassBound, null); noAliases(unknownMerge);
  const zeroBodies: BodyResult[] = [{ ...fallback[0], volumeBasis: { method: 'tessellated', bound: -0 } }];
  const zeroView = await bomView(doc, given(part, zeroBodies)), zero = deriveBom(zeroView);
  assert.ok(Object.is(zeroView.parts[0].massBound, 0)); assert.ok(Object.is(zero.lines[0].massBound, 0)); assert.ok(Object.is(zero.totalMassBound, 0));
  const exact = deriveBom(await bomView(doc, async d => evaluateDoc(d, 1)));
  assert.equal(Object.hasOwn(exact, 'totalMassBound'), false);
  assert.ok(exact.lines.every(l => !Object.hasOwn(l, 'massBound'))); noAliases(exact);
  // Existing ball geometry as the assembly base, with the same exact plate placed on it.
  const baseDoc: StudioDoc = { ...part, instances: [placed[1]] }, baseEvaluate = given(baseDoc, fallback);
  const baseView = await bomView(baseDoc, baseEvaluate), baseBom = deriveBom(baseView);
  assert.ok(baseView.base); assert.equal(baseView.base.massBound, expected);
  assert.equal(baseView.base.others[0].massBound, expected); assert.equal(baseBom.totalMassBound, expected); noAliases({ baseView, baseBom });
  const checkOutput = async (source: StudioDoc, ev: typeof evaluate, expectedBound: number | null | undefined) => {
    const before = JSON.stringify(source), output = await runOutputTool(source, [], 'output_bom', {}, ev);
    assert.ok(!('error' in output), 'error' in output ? output.error : '');
    assert.equal(JSON.stringify(source), before);
    const files = output.content.files as { path: string; text: string; bytes: number; sha256: string }[];
    const file = files.find(f => f.path === 'bom.json'); assert.ok(file);
    const bytes = new TextEncoder().encode(file.text), parsed = JSON.parse(file.text) as { view: BomView; bom: Bom };
    assert.equal(file.bytes, bytes.length); assert.equal(file.sha256, createHash('sha256').update(bytes).digest('hex'));
    assert.deepEqual(output.content.bom, parsed.bom); noAliases({ content: output.content.bom, parsed });
    assert.equal(parsed.bom.totalMassBound, expectedBound);
    assert.equal(Object.hasOwn(parsed.bom, 'totalMassBound'), expectedBound !== undefined);
    return parsed;
  };
  const exported = await checkOutput(doc, evaluate, expected);
  assert.equal(exported.view.parts[0].massBound, expected); assert.equal(exported.bom.lines[0].massBound, expected);
  const exportedUnknown = await checkOutput(doc, given(part, unknownBodies), null); assert.equal(exportedUnknown.view.parts[0].massBound, null);
  const exportedExact = await checkOutput(doc, async d => evaluateDoc(d, 1), undefined); assert.ok(exportedExact.view.parts.every(p => !Object.hasOwn(p, 'massBound')));
  const exportedBase = await checkOutput(baseDoc, baseEvaluate, expected); assert.equal(exportedBase.view.base?.massBound, expected);
});

test('O179: the quote request — its part\'s volume and mass from the mesh, an estimate with their bounds, in quote.json and the page', async () => {
  const doc: StudioDoc = { ...ball(), process: 'injection' }, bodies = fallen(doc);
  const out = await quotePackage(doc, bodies, async d => evaluateDoc(d, 1));
  assert.ok(!('error' in out), 'error' in out ? out.error : '');
  const req = JSON.parse(new TextDecoder().decode(out.files.get(QUOTE_FILES.request))) as { part: { volumeBasis?: { method: string; bound: number; massBound: number | null } } };
  assert.equal(req.part.volumeBasis?.method, 'tessellated');
  assert.ok(Math.abs(req.part.volumeBasis!.bound - bodies[0].volumeBasis!.bound!) < 1e-6);
  assert.ok(req.part.volumeBasis);
  assert.equal(Object.hasOwn(req.part.volumeBasis, 'massBound'), true);
  assert.equal(Object.hasOwn(req.part.volumeBasis, 'massBoundG'), false);
  // Independent units: 1000 mm³ = 1 cm³; the fixture's aluminium is 2.70 g/cm³.
  const expectedMassBound = Math.round((bodies[0].volumeBasis!.bound! / 1000 * 2.7) * 1e6) / 1e6 + 0;
  assert.equal(req.part.volumeBasis.massBound, expectedMassBound);
  assert.equal(out.request.part.volumeBasis?.massBound, expectedMassBound);
  // The same ball, its existing aluminium explicitly stated: the page must show the bound in g.
  const statedDoc = withLook(doc, bodies[0], { material: 'al6061' });
  const stated = await quotePackage(statedDoc, bodies, async d => evaluateDoc(d, 1));
  assert.ok(!('error' in stated), 'error' in stated ? stated.error : '');
  assert.equal(stated.request.part.volumeBasis?.massBound, expectedMassBound);
  assert.ok(new TextDecoder().decode(stated.files.get(QUOTE_FILES.page)).includes(`, ± ${expectedMassBound} g`));
  // Unknown is null, never zero; reuse the same body and geometry.
  const unknownBodies: BodyResult[] = [{ ...bodies[0], volumeBasis: { method: 'tessellated', bound: null } }];
  const unknown = await quotePackage(statedDoc, unknownBodies, async d => evaluateDoc(d, 1));
  assert.ok(!('error' in unknown), 'error' in unknown ? unknown.error : '');
  assert.equal(unknown.request.part.volumeBasis?.massBound, null);
  const unknownRequest = JSON.parse(new TextDecoder().decode(unknown.files.get(QUOTE_FILES.request))) as typeof req;
  assert.ok(unknownRequest.part.volumeBasis);
  assert.deepEqual(unknownRequest.part.volumeBasis, { method: 'tessellated', bound: null, massBound: null });
  assert.equal(Object.hasOwn(unknownRequest.part.volumeBasis, 'massBoundG'), false);
  // Existing r6/+0 semantics: a signed zero bound is serialized and returned as positive zero.
  const zeroBodies: BodyResult[] = [{ ...bodies[0], volumeBasis: { method: 'tessellated', bound: -0 } }];
  const zero = await quotePackage(statedDoc, zeroBodies, async d => evaluateDoc(d, 1));
  assert.ok(!('error' in zero), 'error' in zero ? zero.error : '');
  assert.ok(Object.is(zero.request.part.volumeBasis?.massBound, 0));
  assert.match(new TextDecoder().decode(out.files.get(QUOTE_FILES.page)), /an estimate from the mesh: ± [\d.]+ mm³/);
  // (Exact: the request as before, no volumeBasis.)
  const exact = await quotePackage(doc, bodiesOf(doc), async d => evaluateDoc(d, 1)); assert.ok(!('error' in exact));
  assert.equal((JSON.parse(new TextDecoder().decode(exact.files.get(QUOTE_FILES.request))) as { part: { volumeBasis?: unknown } }).part.volumeBasis, undefined);
  assert.equal(Object.hasOwn(exact.request.part, 'volumeBasis'), false);
  assert.equal(Object.hasOwn(JSON.parse(new TextDecoder().decode(exact.files.get(QUOTE_FILES.request))).part, 'volumeBasis'), false);
});

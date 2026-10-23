import test from 'node:test';
import assert from 'node:assert/strict';
import { brepMassProperties } from '@barocss/cad';
import { evaluateDoc, partBreps, volumeBasisOf, type BodyResult } from '../src/engine/evaluate';
import { emptyDoc, rectanglePart, type StudioDoc } from '../src/engine/doc';
import { commands, type Ctx } from '../src/app/commands';
import { massProperties } from '../src/analysis/analysis';
import { bomView, deriveBom } from '../src/team/assembly';
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
  return [{ ...b, volumeMM3: m.volumeMM3, massG: m.massKG * 1000, volumeBasis: volumeBasisOf(m) }];
}

test('O179: the kernel\'s tessellated mass — its method and bound kept on the body; an exact method\'s none', () => {
  const doc = ball(), m = tessellated(doc), basis = volumeBasisOf(m);
  assert.ok(basis && basis.method === 'tessellated' && basis.boundMM3! > 0, JSON.stringify(basis));
  // (The bound holds the error: the ball's exact volume 4/3 π r³ within it.)
  assert.ok(Math.abs(m.volumeMM3 - 4 / 3 * Math.PI * 64) <= basis.boundMM3!, `${m.volumeMM3} vs ${4 / 3 * Math.PI * 64}, bound ${basis.boundMM3}`);
  // (The ball as evaluated: the quadrature's, exact — no basis on the body.)
  assert.equal(bodiesOf(doc)[0].volumeBasis, undefined);
  assert.equal(volumeBasisOf(brepMassProperties(partBreps(doc)[0].brep, 2700)), undefined);
});

test('O179: mass_properties says a tessellated volume is one, with the volume\'s and the mass\'s bound; an exact one says nothing new', () => {
  const doc = ball(), [b] = fallen(doc), bound = b.volumeBasis!.boundMM3!;
  const [row] = massProperties(doc, [b]) as { volume_basis?: { method: string; bound_mm3: number; mass_bound_g: number; note: string }; mass_g: number }[];
  assert.equal(row.volume_basis?.method, 'tessellated');
  assert.ok(Math.abs(row.volume_basis!.bound_mm3 - bound) < 1e-3);
  // (Aluminium by default, 2.70 g/cm³: the mass's bound is the volume's times it.)
  assert.ok(Math.abs(row.volume_basis!.mass_bound_g - bound * 2.7 / 1000) < 1e-3, JSON.stringify(row.volume_basis));
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
  const bound = fallen(part)[0].volumeBasis!.boundMM3! * 2.7 / 1000;
  assert.ok(ballLine.estimate === true && Math.abs(ballLine.massBoundG! - bound) < 1e-6, JSON.stringify(ballLine));
  assert.deepEqual([plateLine.estimate, plateLine.massBoundG], [undefined, undefined]);
  assert.ok(Math.abs(bom.totalMassBoundG! - bound) < 1e-6, String(bom.totalMassBoundG));
  // (Nothing from the mesh: no bound on the total.)
  assert.equal(deriveBom(await bomView(doc, async d => evaluateDoc(d, 1))).totalMassBoundG, undefined);
});

test('O179: the quote request — its part\'s volume and mass from the mesh, an estimate with their bounds, in quote.json and the page', async () => {
  const doc: StudioDoc = { ...ball(), process: 'injection' }, bodies = fallen(doc);
  const out = await quotePackage(doc, bodies, async d => evaluateDoc(d, 1));
  assert.ok(!('error' in out), 'error' in out ? out.error : '');
  const req = JSON.parse(new TextDecoder().decode(out.files.get(QUOTE_FILES.request))) as { part: { volumeBasis?: { method: string; boundMM3: number; massBoundG: number | null } } };
  assert.equal(req.part.volumeBasis?.method, 'tessellated');
  assert.ok(Math.abs(req.part.volumeBasis!.boundMM3 - bodies[0].volumeBasis!.boundMM3!) < 1e-6);
  assert.match(new TextDecoder().decode(out.files.get(QUOTE_FILES.page)), /an estimate from the mesh: ± [\d.]+ mm³/);
  // (Exact: the request as before, no volumeBasis.)
  const exact = await quotePackage(doc, bodiesOf(doc), async d => evaluateDoc(d, 1)); assert.ok(!('error' in exact));
  assert.equal((JSON.parse(new TextDecoder().decode(exact.files.get(QUOTE_FILES.request))) as { part: { volumeBasis?: unknown } }).part.volumeBasis, undefined);
});

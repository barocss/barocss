// D357: the profile helpers and the Extrude, Revolve and Loft commands read parameter-bound sketches at the document's values.
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { emptyDoc, loftTop, type SketchNode, type StudioDoc } from '../src/engine/doc';
import { emptyDirect, importSource } from '../src/engine/direct';
import { loadDirect } from '../src/engine/directModule';
import { copyLoftGuide } from '../src/app/loftGuides';
import { evaluateDoc } from '../src/engine/evaluate';
import { framedLoftSections, loftSections, profileMiddle, profileRings } from '../src/app/profiles';
import { resolveSketchDims } from '../src/sketch/reopen';
import { extrudeCommand, loftCommand, revolveCommand } from '../src/app/profileCommands';
import { editCommand } from '../src/app/editCommand';
import type { Ctx } from '../src/app/commands';

const params = { W: 40, R: 6, X: 10 };
const W = { parameter: 'W' }, R = { parameter: 'R' }, X = { parameter: 'X' };
const up = { origin: [0, 0, 30], normal: [0, 0, 1], xAxis: [1, 0, 0] };
const kinds: [string, Record<string, unknown>][] = [
  ['rectangle', { profile: 'rectangle', min: [0, 0], max: [W, 40] }],
  ['circle', { profile: 'circle', center: [X, 0], radius: R }],
  ['polygon', { profile: 'polygon', points: [[0, 0], [W, 0], [X, 25]] }],
];
const sk = (s: Record<string, unknown>, plane?: unknown) => ({ kind: 'sketch', ...s, ...(plane ? { plane } : {}) }) as unknown as SketchNode;
const docOf = (...nodes: SketchNode[]): StudioDoc => ({ ...emptyDoc(), parameters: params, nodes });
const ctxOf = (doc: StudioDoc, picked: number[]): Ctx => ({ doc, bodies: [], selection: { faces: [], edges: [], bodies: [], vertices: [], sketches: picked } } as unknown as Ctx);
const finite = (v: unknown) => assert.ok(!/null|NaN/.test(JSON.stringify(v)), JSON.stringify(v));

for (const [name, s] of kinds) {
  test(`D357 ${name}: helpers on a bound sketch equal the resolved sketch`, () => {
    const bound = sk(s), top = sk(s, up), plain = resolveSketchDims(bound, params), plainTop = resolveSketchDims(top, params);
    assert.deepEqual(profileMiddle(bound, params), profileMiddle(plain));
    assert.deepEqual(profileRings(bound, params), profileRings(plain));
    assert.ok(profileMiddle(bound, params).every(Number.isFinite));
    assert.deepEqual(loftSections([bound, top], [0, 1], params), loftSections([plain, plainTop], [0, 1]));
    assert.deepEqual(framedLoftSections([bound, top], [0, 1], params), framedLoftSections([plain, plainTop], [0, 1]));
    finite(loftSections([bound, top], [0, 1], params));
  });
  test(`D357 ${name}: a missing parameter is refused, not NaN`, () => {
    const bound = sk(s), top = sk(s, up);
    assert.throws(() => profileMiddle(bound, {}), /parameter/);
    assert.throws(() => profileRings(bound), /parameter/);
    assert.throws(() => loftSections([bound, top], [0, 1], {}), /parameter/);
    assert.throws(() => framedLoftSections([bound, top], [0, 1], {}), /parameter/);
  });
}

test('D357 Extrude and Revolve handles are finite for a bound sketch', () => {
  const ctx = ctxOf(docOf(sk(kinds[0][1])), [0]);
  const ex = extrudeCommand.handles!(ctx, extrudeCommand.defaults!(ctx)); assert.equal(ex.length, 1); finite(ex);
  const rv = revolveCommand.handles!(ctx, revolveCommand.defaults!(ctx)); assert.equal(rv.length, 1); finite(rv);
  // Missing parameter: no handles, no crash.
  const bare = ctxOf({ ...docOf(sk(kinds[0][1])), parameters: {} }, [0]);
  assert.deepEqual(extrudeCommand.handles!(bare, extrudeCommand.defaults!(bare)), []);
  assert.deepEqual(revolveCommand.handles!(bare, revolveCommand.defaults!(bare)), []);
});

test('D357 an existing revolve of a bound sketch has finite angle handles', () => {
  const doc = { ...docOf(sk(kinds[0][1])), nodes: [sk(kinds[0][1]), { kind: 'revolve', sketch: 0, axis: 'y', angle: 90 }] } as unknown as StudioDoc;
  const cmd = editCommand(1, doc.nodes, { fastenerSizes: undefined as never, parameters: params })!;
  const h = cmd.handles!(ctxOf(doc, []), cmd.defaults!(ctxOf(doc, [])) as never); assert.equal(h.length, 1); finite(h);
});

test('D357 Loft of two bound sketches writes only numbers (a snapshot) and evaluates', () => {
  const doc = docOf(sk(kinds[0][1]), sk(kinds[0][1], up)), ctx = ctxOf(doc, [0, 1]);
  assert.deepEqual(loftCommand.available(ctx), { ok: true });
  const next = loftCommand.build!(ctx, loftCommand.defaults!(ctx));
  const added = next.nodes.slice(2); assert.ok(added.length >= 3); finite(added);
  assert.deepEqual(added.slice(0, 2).map(n => (n as SketchNode & { profile: string }).profile), ['loop', 'loop']);
  assert.ok(!JSON.stringify(added).includes('parameter'));
  const ev = evaluateDoc(next, 1); assert.ok(ev.ok && ev.bodies.length >= 1);
  // The sections do not follow later parameter changes.
  const later = evaluateDoc({ ...next, parameters: { ...params, W: 80 } }, 2), same = evaluateDoc(next, 3);
  assert.ok(later.ok && same.ok);
  assert.deepEqual(later.bodies.map(b => b.mesh.bounds), same.bodies.map(b => b.mesh.bounds));
  // Missing parameter: unavailable with a reason, build refuses.
  const bare = ctxOf({ ...doc, parameters: {} }, [0, 1]);
  assert.equal((loftCommand.available(bare) as { ok: boolean }).ok, false);
  assert.throws(() => loftCommand.build!(bare, loftCommand.defaults!(bare)), /parameter/);
});

// Guided and reversed Lofts from bound sections (the guide inputs of loft-guide-command.test.ts).
const SOURCE = `@model guide_input {
  version: 0;
  length-unit: mm;
  @curve #quadratic { type: nurbs; degree: 2; knots: [0,0,0,1,1,1]; control-points: [[1,0,0],[3,0,1.5],[1,0,3]]; weights: [1,1,1]; }
  @curve #multi { type: nurbs; degree: 2; knots: [0,0,0,0.5,1,1,1]; control-points: [[1,0,0],[3,0,1],[2,0,2],[1,0,3]]; weights: [1,1,1,1]; }
}`;
before(async () => { await loadDirect(); });
const A = { parameter: 'A' }, B = { parameter: 'B' };
const circles = (): StudioDoc => ({ ...emptyDoc(), parameters: { A: 1, B: 4 }, nodes: [sk({ profile: 'circle', center: [0, 0], radius: A }), sk({ profile: 'circle', center: [0, 0], radius: B }, { origin: [0, 0, 3], normal: [0, 0, 1], xAxis: [1, 0, 0] })], direct: importSource(emptyDirect(), SOURCE, 'guide input') });
const guideId = (doc: StudioDoc, geometry: string) => doc.direct!.objects.find(o => o.geometry === geometry)!.id;

for (const [geometry, picked] of [['quadratic', [0, 1]], ['multi', [0, 1]], ['multi', [1, 0]]] as const) {
  test(`D357 guided Loft (${geometry}, picked ${picked.join(',')}) from bound sections: numeric copies, evaluates, notice`, () => {
    // The guides end on the radius-1 seam of both sections.
    const doc = { ...circles(), parameters: { A: 1, B: 1 } }, ctx = ctxOf(doc, [...picked]), id = guideId(doc, geometry);
    const g = copyLoftGuide(doc, id); assert.ok(g.ok, g.ok ? '' : g.reason);
    const next = loftCommand.build!(ctx, { smooth: 'no', guide: id }), added = next.nodes.slice(2);
    finite(added); assert.ok(!JSON.stringify(added).includes('parameter'));
    assert.equal(added.at(-1)!.kind, 'loft');
    const ev = evaluateDoc(next, 1); assert.ok(ev.ok && ev.bodies.length >= 1, JSON.stringify(ev).slice(0, 300));
    // Later parameter changes do not reach it.
    const later = evaluateDoc({ ...next, parameters: { A: 2, B: 9 } }, 2); assert.ok(later.ok);
    assert.deepEqual(later.bodies.map(b => b.mesh.bounds), ev.bodies.map(b => b.mesh.bounds));
    const steps = loftCommand.steps!(ctx, { smooth: 'no', guide: id });
    assert.ok(steps.find(x => x.label === 'Sections')!.done, 'the sections read at the parameter values');
    assert.match(steps.map(x => x.text).join('\n'), /Copied at A = 1, B = 1: later parameter changes do not update this loft\./);
  });
}

test('D357 reversed pick order: Loft is available and numeric without a guide', () => {
  const doc = circles(), ctx = ctxOf(doc, [1, 0]);
  assert.deepEqual(loftCommand.available(ctx), { ok: true });
  const next = loftCommand.build!(ctx, loftCommand.defaults!(ctx)), added = next.nodes.slice(2);
  finite(added); assert.ok(!JSON.stringify(added).includes('parameter'));
  assert.deepEqual((added.at(-1) as unknown as { from: number[] }).from, [0, 1]);
  assert.ok(evaluateDoc(next, 1).ok);
});

test('D357 Loft notice: parameters once each with current values; none when nothing is bound', () => {
  const doc = circles(), twice = { ...doc, nodes: [...doc.nodes, sk({ profile: 'circle', center: [0, 0], radius: A }, { origin: [0, 0, 9], normal: [0, 0, 1], xAxis: [1, 0, 0] })] };
  const text = (d: StudioDoc, picked: number[]) => loftCommand.steps!(ctxOf(d, picked), { smooth: 'no', guide: '' }).map(x => `${x.label}: ${x.text}`).join('\n');
  assert.match(text(twice, [0, 1, 2]), /Copied at A = 1, B = 4:/);
  assert.equal((text(twice, [0, 1, 2]).match(/A = /g) ?? []).length, 1);
  const plain = { ...doc, nodes: doc.nodes.map(n => resolveSketchDims(n as SketchNode, doc.parameters)) };
  assert.ok(!/Copied at/.test(text(plain, [0, 1])));
});

test('D357 Loft refusal names the sketch and drops the bracketed code', () => {
  const doc = { ...circles(), parameters: { A: 1 } }, ctx = ctxOf(doc, [0, 1]);
  const why = (loftCommand.available(ctx) as { ok: false; reason: string }).reason;
  assert.equal(why, 'Sketch 2 uses parameter B, which this document does not have');
  assert.ok(loftCommand.steps!(ctx, { smooth: 'no', guide: '' }).every(x => !x.text.includes('[')));
  const bad = ctxOf({ ...doc, parameters: { A: 1, B: Infinity } }, [0, 1]);
  assert.equal((loftCommand.available(bad) as { reason: string }).reason, 'Sketch 2 uses parameter B, which has no finite value');
  const guided = loftCommand.steps!(ctxOf(doc, [0, 1]), { smooth: 'no', guide: guideId(circles(), 'quadratic') });
  assert.ok(guided.every(x => !/^\[|NaN/.test(x.text)));
});

test('D357 loftTop refuses a parameter-bound sketch, not NaN', () => {
  assert.throws(() => loftTop(sk({ profile: 'circle', center: [0, 0], radius: A }), 'scaled', 2), { code: 'VALUE' });
  assert.deepEqual(loftTop(sk({ profile: 'circle', center: [0, 0], radius: 2 }), 'scaled', 2), { kind: 'sketch', profile: 'circle', center: [0, 0], radius: 4 });
});

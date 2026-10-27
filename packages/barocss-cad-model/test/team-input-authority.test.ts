import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { emptyDoc, withNode, type ModelNode, type StudioDoc } from '../src/engine/doc';
import { evaluateDoc } from '../src/engine/evaluate';
import { withLook } from '../src/app/bodies';
import { weldList } from '../src/frames/welds';
import { bomView, deriveBom } from '../src/team/assembly';
import { draftBaseline, moveBaseline, verifyBaseline } from '../src/team/baseline';
import { partDigests } from '../src/util/digest';
import { userToken } from '../src/team/ecr';
import { freshnessOf, inertiaResult, massResult, modelInput, stamp, type Result } from '../src/team/freshness';
import { canonicalOf, revisionOf } from '../src/util/revision';

const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
const copy = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const section = (width: number, height: number, wall: number) => ({ kind: 'rect-tube' as const, width, height, wall, outerRadius: 0 });
const row = (width: number, height: number, wall: number) => ({ id: 'own', section: section(width, height, wall), source: 'test dimensions' });
const frame = (): StudioDoc => ({ ...withNode(emptyDoc(), { kind: 'frame', points: [[0, 0, 0], [300, 0, 0]], segments: [[0, 1]], section: { kind: 'library', id: 'own' } } as ModelNode), frames: { version: 1, sections: [row(40, 40, 3)] } });
const changedRow = (doc: StudioDoc): StudioDoc => ({ ...doc, frames: { ...doc.frames!, sections: [row(50, 30, 4)] } });

async function weldScene(): Promise<{ doc: StudioDoc; next: (doc: StudioDoc) => StudioDoc }> {
  const scene = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../barocss-cad/conformance/frk/bead-tee-flush.json'), 'utf8')) as { input: { partDocument: { features: ModelNode[] } } };
  const { id: _kernelId, ...node } = scene.input.partDocument.features.find(n => n.kind === 'frame')!; void _kernelId;
  const doc = withNode(emptyDoc(), node as ModelNode), e = await evaluate(doc); assert.ok(e.ok);
  const joint = weldList(doc, e.bodies).joints.find(j => j.kind === 'butt')!; assert.ok(joint);
  return { doc, next: d => ({ ...d, frames: { version: 1, welds: [{ joint: joint.id, size: 3 }] } }) };
}
const placed = (doc: StudioDoc): StudioDoc => ({ ...emptyDoc(), instances: [{ id: 'p1', name: 'Member', doc, position: [0, 0, 0], rotation: [0, 0, 0] }] });
async function reviewed(doc: StudioDoc, cite: Result) {
  const view = await bomView(doc, evaluate), d = draftBaseline(doc, deriveBom(view), view, { cites: [cite] });
  return moveBaseline(d.doc, d.baseline.id, 'review', userToken('2026-10-22T00:00:00Z'));
}

for (const scope of ['base', 'placed'] as const) for (const change of ['section', 'weld'] as const) {
  test(`REVIEW-M2 ${scope} ${change}: actual mass/inertia, revision and approved pins follow geometry inputs`, async () => {
    const scene = change === 'weld' ? await weldScene() : { doc: frame(), next: changedRow };
    const e = await evaluate(scene.doc); assert.ok(e.ok);
    const own = withLook(scene.doc, e.bodies[0], { material: 'al6061' });
    const doc = scope === 'base' ? own : placed(own), part = scope === 'placed' ? 'p1' : undefined;
    const edit = (d: StudioDoc): StudioDoc => scope === 'base' ? scene.next(d) : { ...d, instances: d.instances!.map(i => ({ ...i, doc: scene.next(i.doc) })) };
    const before = await massResult(doc, evaluate, 'R1', part), after = await massResult(edit(doc), evaluate, 'R2', part);
    assert.equal(before.status, 'ok'); assert.equal(after.status, 'ok');
    if (change === 'section') {
      assert.ok(Math.abs(before.number! - 359.64) < 1e-8, String(before.number));
      assert.ok(Math.abs(after.number! - 466.56) < 1e-8, String(after.number));
    } else {
      const a = await evaluate(own), b = await evaluate(scene.next(own)); assert.ok(a.ok && b.ok);
      assert.equal(a.bodies.length, 2); assert.equal(b.bodies.length, 3);
      assert.ok(Math.abs(b.bodies.reduce((v, x) => v + x.volume!, 0) - a.bodies.reduce((v, x) => v + x.volume!, 0) - 360) < 1e-6);
      assert.ok(after.number! > before.number!);
    }
    const inertia = await inertiaResult(doc, evaluate, 'R1', part);
    for (const result of [before, inertia]) {
      assert.equal((await freshnessOf(result, copy(doc), evaluate)).state, 'current');
      assert.deepEqual(await freshnessOf(result, edit(doc), evaluate), { state: 'stale', changed: ['model'], unresolved: [] });
    }
    assert.notEqual(revisionOf(doc), revisionOf(edit(doc)));
    assert.notEqual(canonicalOf(doc), canonicalOf(edit(doc)));
    const key = part ?? 'base'; assert.notEqual(partDigests(doc)[key], partDigests(edit(doc))[key]);
    const review = await reviewed(doc, before);
    await assert.rejects(() => moveBaseline(edit(review.doc), review.baseline.id, 'approved', userToken('now'), evaluate), /STALE_BASELINE/);
    const approved = await moveBaseline(review.doc, review.baseline.id, 'approved', userToken('now'), evaluate);
    assert.equal(verifyBaseline(copy(approved.doc), approved.baseline.id).current, true);
    assert.deepEqual(verifyBaseline(edit(approved.doc), approved.baseline.id), { intact: true, mismatches: [], current: false, changed: [`part ${key}`] });
  });
}

test('REVIEW-M2 unchanged values, object key order and display-only edits preserve analysis freshness', async () => {
  const doc = frame(), e = await evaluate(doc); assert.ok(e.ok);
  const own = withLook(doc, e.bodies[0], { material: 'al6061' }), parent = placed(own);
  for (const [d, part] of [[own, undefined], [parent, 'p1']] as const) {
    const mass = await massResult(d, evaluate, 'R1', part);
    const paint = (p: StudioDoc): StudioDoc => withLook(p, e.bodies[0], { color: '#123456', name: 'Display name', hidden: true });
    const painted: StudioDoc = part ? { ...d, instances: d.instances!.map(i => ({ ...i, doc: paint(i.doc) })) } : paint(d);
    assert.equal(modelInput(d), modelInput(painted));
    assert.equal((await freshnessOf(mass, painted, evaluate)).state, 'current');
    const reordered: StudioDoc = { ...d, parameters: Object.fromEntries(Object.entries(d.parameters).reverse()) };
    assert.equal(revisionOf(d), revisionOf(reordered)); assert.deepEqual(partDigests(d), partDigests(copy(d)));
    assert.equal((await freshnessOf(mass, reordered, evaluate)).state, 'current');
  }
});

test('REVIEW-M2 other evaluation/domain rows invalidate model and revision pins; manufacturing settings invalidate process results', async () => {
  const doc = frame();
  const fields: Partial<StudioDoc>[] = [
    { outputs: { own: { node: 0, side: 'solid' } } },
    { fits: { version: 1, tables: [], faces: [{ face: 'n0.side0', class: 'H7' }] } },
    { bearings: { version: 1, rows: [] } }, { orings: { version: 1, rows: [] } },
    { rings: { version: 1, rows: [] } }, { drives: { version: 1, rows: [] } }, { connectors: { version: 1, rows: [] } },
  ];
  for (const patch of fields) {
    const next = { ...doc, ...patch }, name = Object.keys(patch)[0];
    assert.notEqual(modelInput(doc), modelInput(next), name);
    assert.notEqual(revisionOf(doc), revisionOf(next), name);
    assert.notEqual(partDigests(doc).base, partDigests(next).base, name);
  }
  const process = stamp(doc, [], { id: 'dfm', kind: 'dfm', subject: 'base', run: 'R1', status: 'ok' });
  for (const patch of [
    { print: { direction: [1, 0, 0] } }, { mould: { version: 1, pull: [1, 0, 0] } },
    { machining: { version: 1, allowance: 2 } }, { casting: { version: 1, shrink: 0.01 } },
  ] satisfies Partial<StudioDoc>[]) {
    const next = { ...doc, ...patch };
    assert.deepEqual((await freshnessOf(process, next, evaluate)).changed, ['process']);
    assert.notEqual(revisionOf(doc), revisionOf(next)); assert.notEqual(partDigests(doc).base, partDigests(next).base);
  }
});

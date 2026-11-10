import assert from 'node:assert/strict';
import test from 'node:test';
import { part, Location } from '../src/api';
import { curvesSource } from '../src/engine/curveSource';
import { importSource } from '../src/engine/direct';
import { emptyDoc, rectanglePart, withNode, type PartInstance, type StudioDoc } from '../src/engine/doc';
import { evaluateDoc } from '../src/engine/evaluate';
import type { Requirement } from '../src/engine/schema/spec';
import { dispatchTool, type Evaluate } from '../src/chat/tools';
import { v2Result } from '../src/chat/groups';
import { documentRevision } from '../src/team/bundle';
import { freshnessOf } from '../src/team/freshness';
import { sha256Hex } from '../src/util/digest';

const requirements: Requirement[] = [
  { id: 'height', source: 'get_part_summary said 10 mm maximum', basis: 'stated', said: 'verified', hard: true,
    check: { query: { fn: 'bbox', axis: 'z' }, op: '<=', value: 10, unit: 'mm' } },
  { id: 'width', source: 'Use a nominal 20 mm plate', basis: 'assumed', hard: false,
    check: { query: { fn: 'bbox', axis: 'x' }, op: '==', value: 20, unit: 'mm' } },
  { id: 'mass', source: 'Keep mass below 20 g', hard: false,
    check: { query: { fn: 'mass' }, op: '<=', value: 20, unit: 'g' } },
];
const plate: StudioDoc = { ...rectanglePart(20, 10, 11), requirements };
const evaluate: Evaluate = async doc => evaluateDoc(doc, 1);
const read = (doc: StudioDoc, args = {}, use: Evaluate = evaluate) => dispatchTool({ doc, bodies: [] }, 'requirements', { action: 'evidence', ...args }, use);

async function report(doc: StudioDoc, args = {}, use: Evaluate = evaluate) {
  const original = JSON.stringify(doc), out = await read(doc, args, use);
  assert.equal(out.isError, false, out.content);
  assert.equal(out.changed, false);
  assert.equal(out.state.doc, doc);
  assert.equal(JSON.stringify(doc), original);
  const { files: [file], revision } = JSON.parse(v2Result(out.content));
  assert.equal(file.path, 'requirement-evidence.json');
  assert.equal(file.sha256, sha256Hex(new TextEncoder().encode(file.text)));
  assert.equal(file.bytes, Buffer.byteLength(file.text));
  const value = JSON.parse(file.text);
  assert.equal(value.revision, revision);
  assert.equal(value.documentRevision, documentRevision(doc));
  return value;
}

test('evidence keeps authored provenance independent of the result and preserves unsupported and failed checks', async () => {
  const value = await report(plate);
  assert.deepEqual([value.part, value.definitionRevision, value.checker], ['base', value.revision, 'checkSpec']);
  const [height, width, mass, summary] = value.evidence;
  assert.deepEqual(value.evidence.slice(0, 3).map((r: { requirement: Requirement }) => r.requirement), requirements);
  assert.deepEqual([height.result.verdict, height.result.number], ['fail', 11]);
  assert.deepEqual([width.result.verdict, width.result.number], ['pass', 20]);
  assert.deepEqual([mass.result.status, mass.result.number, mass.result.value, mass.result.verdict], ['unsupported', null, null, undefined]);
  assert.match(mass.result.why, /material/);
  assert.equal(summary.result.verdict, 'fail');
  assert.equal(height.freshness.state, 'current');
  const failed = await report(plate, {}, async () => null);
  for (const { result } of failed.evidence) assert.deepEqual([result.status, result.number, result.value, result.verdict], ['failed', null, null, undefined]);
  const thrown = await read(plate, {}, async () => { throw new Error('native callback failed'); });
  assert.ok(thrown.isError && !thrown.changed);
  assert.match(JSON.parse(thrown.content).error, /OUTPUT_FAILED.*native callback failed/);
  assert.equal(JSON.parse(thrown.content).files, undefined);
});

test('evidence scopes same-definition occurrences and uses their material overrides', async () => {
  const instance = { name: 'plate', doc: plate, position: [0, 0, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], grounded: true };
  const body = evaluateDoc(plate, 1);
  assert.ok(body.ok);
  const key = body.bodies[0].key;
  const a = { ...instance, id: 'p1', looks: { [key]: { material: 'al6061' } } };
  const b = { ...instance, id: 'p2', looks: { [key]: { material: 'steel' } } };
  const assembly = { ...emptyDoc(), instances: [a, b] };
  const left = await report(assembly, { part: 'p1' }), right = await report(assembly, { part: 'p2' });
  assert.deepEqual([left.part, right.part], ['p1', 'p2']);
  assert.equal(left.definitionRevision, right.definitionRevision);
  assert.notEqual(left.definitionRevision, left.revision);
  const [l, r] = [left, right].map(x => x.evidence[2].result);
  assert.notEqual(l.id, r.id);
  assert.notEqual(l.fingerprint.inputs.material, r.fingerprint.inputs.material);
  assert.deepEqual([l.part, r.part, l.verdict, r.verdict], ['p1', 'p2', 'pass', 'pass']);
  assert.ok(l.number > 0 && r.number > l.number);
  assert.equal((await read({ ...assembly, instances: [a, a] }, { part: 'p1' })).isError, true);
});

const instance = (id: string, doc: StudioDoc, looks?: PartInstance['looks']): PartInstance =>
  ({ id, name: id, doc, position: [0, 0, 0], rotation: [0, 0, 0], ...(looks ? { looks } : {}) });
const assembled = (...instances: PartInstance[]): StudioDoc => ({ ...emptyDoc(), instances });
const aluminiumPlate: StudioDoc = { ...plate, brief: { version: 1,
  material: { value: 'al6061', basis: 'stated', source: 'Aluminium 6061' },
} };
const updateChild = (doc: StudioDoc, at: number, change: (child: PartInstance) => PartInstance): StudioDoc =>
  ({ ...doc, instances: doc.instances!.map((child, i) => i === at ? change(child) : child) });

test('nested evidence stamps the entire path and respects root material overrides without treating colour as material', async () => {
  const leaf = assembled(instance('p1', aluminiumPlate));
  const inner = assembled(instance('p1', leaf));
  const doc = assembled(instance('p1', inner, { 'p1/p1/b1': { material: 'steel' } }), instance('p2', inner));
  const left = await report(doc, { part: 'p1/p1/p1' }), right = await report(doc, { part: 'p2/p1/p1' });
  assert.equal(left.definitionRevision, right.definitionRevision);
  assert.equal(left.revision, right.revision);
  const [l, r] = [left, right].map(x => x.evidence[2].result);
  assert.notEqual(l.id, r.id);
  assert.deepEqual([l.part, r.part], ['p1/p1/p1', 'p2/p1/p1']);
  assert.ok(Math.abs(l.number - 17.27) < 1e-8);
  assert.ok(Math.abs(r.number - 5.94) < 1e-8);
  const styled = updateChild(doc, 1, host => ({ ...host, looks: { 'p1/p1/b1': { color: '#ff9900' } } }));
  assert.equal((await freshnessOf(r, styled, evaluate)).state, 'current');
  const changed = updateChild(doc, 0, host => ({ ...host, looks: { 'p1/p1/b1': { material: 'al6061' } } }));
  assert.deepEqual((await freshnessOf(l, changed, evaluate)).changed, ['material']);
  assert.equal((await freshnessOf(r, changed, evaluate)).state, 'current');
  const duplicate = updateChild(doc, 0, host => ({ ...host, doc: assembled(...host.doc.instances!, ...host.doc.instances!) }));
  assert.equal((await freshnessOf(l, duplicate, evaluate)).unresolved[0].why, 'ambiguous');
  assert.equal((await freshnessOf(r, duplicate, evaluate)).state, 'current');
});

test('nested evidence inherits ancestor shop rows with the nearest explicit override', async () => {
  const section = (width: number) => ({ id: 'shop-section', name: 'Tube', source: 'Test drawing',
    section: { kind: 'rect-tube' as const, width, height: 40, wall: 3, outerRadius: 0 } });
  const member = withNode(emptyDoc(), { kind: 'frame-member', section: { kind: 'library', id: 'shop-section' }, start: [0, 0, 0], end: [100, 0, 0] });
  const scoped = { ...member, requirements: [{ id: 'volume', source: 'Test tube volume', hard: true,
    check: { query: { fn: 'volume' as const }, op: '==' as const, value: 44400, unit: 'mm3' } }] };
  const inner = assembled(instance('p1', scoped));
  const local = { ...inner, frames: { version: 1 as const, sections: [section(50)] } };
  const doc: StudioDoc = { ...assembled(instance('p1', inner), instance('p2', local)), frames: { version: 1, sections: [section(40)] } };
  const reports = await Promise.all(['p1/p1', 'p2/p1'].map(part => report(doc, { part })));
  const [a, b] = reports.map(item => item.evidence[0].result);
  assert.ok(Math.abs(a.number - (40 * 40 - 34 * 34) * 100) < 1e-7);
  assert.ok(Math.abs(b.number - (50 * 40 - 44 * 34) * 100) < 1e-7);
  assert.equal(a.verdict, 'pass');
  assert.equal(b.verdict, 'fail');
  assert.equal(scoped.frames, undefined);
});

test('nested evidence refuses unsafe scope before evaluating geometry', async () => {
  const parent = assembled(instance('p1', aluminiumPlate)), root = assembled(instance('p1', parent));
  const cut: StudioDoc = { ...parent, assemblyCuts: [
    { id: 'c1', profile: { kind: 'circle', radius: 2 }, at: [5, 5, 0], dir: [0, 0, 1], depth: 'through', targets: ['p1'] },
  ] };
  const linked = withNode(aluminiumPlate, { kind: 'bearing', row: '6204', shaft: 0, step: 1, against: 'end',
    housingRef: { part: 'p2', body: 'b1' }, housingClass: 'H7' });
  const invalid: [StudioDoc, string, RegExp][] = [
    [root, 'p1/p9', /No part/],
    [root, 'p1//p1', /Invalid occurrence path/],
    [assembled(instance('base', parent)), 'base/p1', /base is reserved/],
    [assembled({ ...instance('p1', parent), hidden: true }), 'p1/p1', /hidden/],
    [assembled(instance('p1', updateChild(parent, 0, child => ({ ...child, hidden: true })))), 'p1/p1', /hidden/],
    [assembled(instance('p1', parent), instance('p1', parent)), 'p1/p1', /Ambiguous part/],
    [assembled(instance('p1', cut)), 'p1/p1', /assembly cut/],
    [assembled(instance('p1', assembled(instance('p1', parent)))), 'p1/p1', /sub-assembly/],
    [assembled(instance('p1', assembled(instance('p1', linked)))), 'p1/p1', /linked bearing housing/],
  ];
  for (const [doc, part, why] of invalid) {
    let calls = 0;
    const result = await read(doc, { part }, async () => { calls++; return null; });
    assert.equal(calls, 0);
    assert.ok(result.isError && !result.changed);
    assert.match(JSON.parse(result.content).error, why);
    assert.equal(JSON.parse(result.content).files, undefined);
  }
});

test('nested evidence refuses to publish a physical check without an available volume', async () => {
  const doc = assembled(instance('p1', assembled(instance('p1', aluminiumPlate))));
  const result = await read(doc, { part: 'p1/p1' }, async scoped => {
    const measured = await evaluate(scoped);
    if (!measured?.ok) throw new Error('Expected a successful nested evaluation');
    return { ...measured, bodies: measured.bodies.map(body => ({ ...body, volume: null, massRef: undefined })) };
  });
  assert.ok(result.isError && !result.changed);
  assert.match(JSON.parse(result.content).error, /OUTPUT_EVALUATION.*closed-body volume/);
  assert.equal(JSON.parse(result.content).files, undefined);
});

test('evidence refuses stale revisions and ambiguous or malformed inputs before evaluation', async () => {
  const changed = { ...plate, requirements: [{ ...requirements[0], source: 'New wording only' }, ...requirements.slice(1)] };
  const invalid: [StudioDoc, object, RegExp][] = [
    [changed, { expectedRevision: (await report(plate)).revision }, /OUTPUT_STALE/],
    [plate, { expectedRevision: 'short' }, /OUTPUT_INPUT/],
    [plate, { part: 'missing' }, /No part missing/],
    [plate, { part: 'p1/p2' }, /No part/],
    [emptyDoc(), {}, /no requirements list/],
    [{ ...plate, requirements: [requirements[0], requirements[0]] }, {}, /duplicate requirement IDs/],
    [{ ...plate, requirements: [null] } as unknown as StudioDoc, {}, /requirement is an object/],
  ];
  for (const [doc, args, reason] of invalid) {
    let evaluations = 0;
    const out = await read(doc, args, async d => { evaluations++; return evaluate(d); });
    assert.equal(evaluations, 0);
    assert.ok(out.isError && !out.changed, out.content);
    assert.equal(out.state.doc, doc);
    assert.match(JSON.parse(out.content).error, reason);
    assert.equal(JSON.parse(out.content).files, undefined);
  }
});

test('a failed auxiliary Boolean probe cannot publish passing evidence', async () => {
  const added = await dispatchTool({ doc: plate, bodies: [] }, 'add_keepout', {
    box: { frame: { origin: [0, 0, 0], normal: [0, 0, 1], xAxis: [1, 0, 0] }, size: [5, 5, 5] },
  }, evaluate);
  assert.equal(added.isError, false, added.content);
  const doc: StudioDoc = { ...added.state.doc, requirements: [{
    id: 'clear', source: 'Keep the envelope clear', hard: true,
    check: { query: { fn: 'keepout', keepout: 'K1' }, op: '>=', value: 0, unit: 'mm' },
  }] };
  let failedProbes = 0;
  const out = await read(doc, {}, async d => {
    if (d.nodes.at(-1)?.kind === 'intersect') { failedProbes++; return null; }
    return evaluate(d);
  });
  assert.equal(failedProbes, 1);
  assert.ok(out.isError && !out.changed);
  assert.match(JSON.parse(out.content).error, /OUTPUT_EVALUATION.*requirement probe/);
  assert.equal(JSON.parse(out.content).files, undefined);
  const missingVolume = await read(doc, {}, async d => {
    const evaluated = evaluateDoc(d, 1);
    if (d.nodes.at(-1)?.kind !== 'intersect') return evaluated;
    assert.ok(evaluated.ok);
    const probe = evaluated.bodies.find(b => b.key === `b${d.nodes.at(-1)?.id?.slice(1)}`);
    assert.ok(probe);
    return { ...evaluated, bodies: evaluated.bodies.map(b => b === probe ? { ...b, volume: null } : b) };
  });
  assert.ok(missingVolume.isError);
  assert.match(JSON.parse(missingVolume.content).error, /OUTPUT_EVALUATION.*requirement probe/);
  assert.equal(JSON.parse(missingVolume.content).files, undefined);
});

test('a repeated print-rule report cannot reuse a cached pass from a failed probe', async () => {
  let two = rectanglePart(20, 10, 11);
  two = withNode(two, { kind: 'sketch', profile: 'rectangle', min: [3, 3], max: [8, 8] });
  two = withNode(two, { kind: 'extrude', sketch: two.nodes.length - 1, height: 10 });
  const doc: StudioDoc = { ...two, process: 'fdm', requirements: [{
    id: 'gap', source: 'Check assembly print gap', hard: true, check: { query: { fn: 'print_rule', rule: 'gap' }, op: '>=', value: 0, unit: 'mm' },
  }] };
  const target = evaluateDoc(doc, 1);
  assert.ok(target.ok && target.bodies.length === 2);
  let failures = 0;
  const cached: Evaluate = async d => {
    if (d.nodes.at(-1)?.kind === 'intersect') { failures++; return null; }
    return target;
  };
  for (let i = 0; i < 2; i++) {
    const out = await read(doc, {}, cached);
    assert.ok(out.isError, out.content);
    assert.match(JSON.parse(out.content).error, /OUTPUT_EVALUATION.*requirement probe/);
    assert.equal(failures, i + 1);
  }
});

test('an edited live curve invalidates the evidence revision even when the standard revision is equal', async () => {
  const cut = part('cut').box({ w: 60, d: 40, h: 10 })
    .subtract(p => p.box({ w: 4, d: 2, h: 10, x: 0, y: 8 }).moved(Location.at([8, 0, 0]))).doc;
  const source = (x: number, y: number) => curvesSource('path', [{ degree: 1, knots: [0, 0, 1, 2, 2],
    points: [[0, 0, 0], [x, 0, 0], [x, y, 0]], weights: [1, 1, 1] }]);
  cut.direct = importSource({ sources: {}, objects: [] }, source(16, 16), 'Path');
  const object = cut.direct.objects[0];
  const first = { ...part('pattern', cut).curveFeaturePattern({ path: { objectId: object.id }, spacing: 8, count: 5 }).doc, requirements };
  const next = structuredClone(first);
  next.direct!.sources[object.source] = source(24, 8);
  assert.equal(documentRevision(first), documentRevision(next));
  const original = await report(first);
  const stale = await read(next, { expectedRevision: original.revision });
  assert.ok(stale.isError && !stale.changed);
  assert.match(JSON.parse(stale.content).error, /OUTPUT_STALE/);
  assert.notEqual((await report(next)).revision, original.revision);
});

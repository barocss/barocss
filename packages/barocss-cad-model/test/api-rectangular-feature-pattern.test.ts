import test from 'node:test';
import assert from 'node:assert/strict';
import { checkBrep } from '@barocss/cad';
import { part, param, Location, BarocssError, type StudioPart } from '../src/api';
import { evaluateDoc, partBreps } from '../src/engine/evaluate';
import { bindParameter } from '../src/engine/parameters';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { editFields } from '../src/app/editFields';
import { checkNode } from '../src/chat/features';
import { readStudioDoc } from '../src/engine/migrate';
import { isRefusal } from '../src/engine/refusal';

// Independent oracle: 60 × 40 × 10 stock minus six 4 × 4 × 10 through cuts = 23040.
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) <= 1e-9 * Math.max(1, Math.abs(expected)), `${actual} vs ${expected}`);
function seed(): StudioPart {
  const source = part('three cuts').parameter('seedX', 8).parameter('spacing', 16).parameter('spacing2', 16).parameter('copies', 3)
    .box({ w: 60, d: 40, h: 10 })
    .subtract(p => p.box({ w: 4, d: 4, h: 10, x: 0, y: 8 }).moved(Location.at([8, 0, 0])));
  const doc = source.doc, translate = doc.nodes.findIndex(n => n.kind === 'translate');
  assert.ok(translate >= 0);
  // Existing feature-editor binding, not a hand-built StudioDoc or an unsupported public box-X binding.
  return part('bound seed', bindParameter(doc, { feature: translate, value: 'o0', parameter: 'seedX' }));
}
const options = () => ({ axis: 'x' as const, spacing: param('spacing'), count: 3, axis2: 'y' as const, spacing2: param('spacing2'), count2: 2 });
function shape(p: StudioPart, ranges: readonly (readonly number[])[]): void {
  close(p.mass({ density: 1 }).volume, 23040);
  const evaluated = evaluateDoc(p.doc, 1);
  assert.ok(evaluated.ok, evaluated.ok ? '' : evaluated.error.detail);
  assert.equal(evaluated.bodies.length, 1);
  const exact = partBreps(p.doc); assert.equal(exact.length, 1);
  assert.equal(exact[0].brep.bodies.length, 1);
  assert.equal(exact[0].brep.bodies[0].kind, 'solid');
  assert.ok(exact[0].brep.shells.every(shell => shell.closed));
  const report = checkBrep(exact[0].brep); assert.equal(report.valid, true, report.issues.join('\n'));
  const vertices = exact[0].brep.vertices;
  for (const k of [0, 1, 2]) {
    close(Math.min(...vertices.map(v => v.point[k])), [0, 0, 0][k]);
    close(Math.max(...vertices.map(v => v.point[k])), [60, 40, 10][k]);
  }
  for (const range of ranges) for (const x of range) for (const y of [8, 12, 24, 28]) for (const z of [0, 10]) {
    const expected = [x, y, z];
    assert.ok(vertices.some(v => expected.every((c, k) => Math.abs(v.point[k] - c) <= 1e-9 * Math.max(1, Math.abs(c)))), `missing cut corner ${expected}`);
  }
}
const refused = (run: () => unknown, code: string, where = 'facade') => assert.throws(run, error => error instanceof BarocssError && error.code === code && error.where === where);

test('public rectangular feature pattern: real command append stores one cut pattern with original history and spacing Dim', () => {
  const source = seed(), before = source.doc, input = options(), inputBefore = structuredClone(input);
  const accepted = source.rectangularFeaturePattern(input), doc = accepted.doc, last = doc.nodes.at(-1);
  assert.ok(last && last.kind === 'rectangular-feature-pattern');
  assert.deepEqual(last.parent, { node: before.nodes.length - 1, side: 'solid' });
  assert.equal(last.axis, 'x'); assert.equal(last.count, 3); assert.deepEqual(last.spacing, { parameter: 'spacing' });
  assert.equal(last.axis2, 'y'); assert.equal(last.count2, 2); assert.deepEqual(last.spacing2, { parameter: 'spacing2' });
  assert.deepEqual(doc.nodes.slice(0, -1), before.nodes);
  const translated = doc.nodes.find(n => n.kind === 'translate'); assert.ok(translated && translated.kind === 'translate');
  assert.deepEqual(translated.offset[0], { parameter: 'seedX' });
  shape(accepted, [[8, 12], [24, 28], [40, 44]]);
  assert.deepEqual(source.doc, before); assert.deepEqual(input, inputBefore);
  const copy = accepted.doc; copy.nodes.length = 0;
  assert.deepEqual(accepted.doc, doc);
});

test('public rectangular feature pattern: seed and spacing parameter edits move fixed cut walls with unchanged volume and bounds', () => {
  const accepted = seed().rectangularFeaturePattern(options()), before = accepted.doc, massBefore = accepted.mass({ density: 1 });
  shape(accepted.withParameters({ seedX: 14 }), [[14, 18], [30, 34], [46, 50]]);
  shape(accepted.withParameters({ spacing: 12 }), [[8, 12], [20, 24], [32, 36]]);
  assert.deepEqual(accepted.doc, before); assert.deepEqual(accepted.mass({ density: 1 }), massBefore);
  shape(accepted, [[8, 12], [24, 28], [40, 44]]);
});

test('public rectangular feature pattern: codec read and public reopen preserve refs, Dim bindings and reevaluation', async () => {
  const accepted = seed().rectangularFeaturePattern(options());
  for (const [p, ranges] of [
    [accepted, [[8, 12], [24, 28], [40, 44]]],
    [accepted.withParameters({ seedX: 14 }), [[14, 18], [30, 34], [46, 50]]],
    [accepted.withParameters({ spacing: 12 }), [[8, 12], [20, 24], [32, 36]]],
  ] as const) {
    const doc = p.doc, before = structuredClone(doc), bytes = encodeStudioFile(doc);
    const opened = await readStudioFile(bytes); assert.ok('doc' in opened, JSON.stringify(opened));
    assert.deepEqual(opened.doc, before);
    const index = opened.doc.nodes.length - 1;
    const field = editFields(opened.doc.nodes, index, opened.doc.parameters).find(f => f.key === 'count');
    assert.ok(field?.kind === 'number');
    const edited = { ...opened.doc, nodes: field.set(opened.doc.nodes, 2) };
    assert.deepEqual(edited.nodes.map(n => n.id), before.nodes.map(n => n.id));
    const editedLast = edited.nodes.at(-1), beforeLast = before.nodes.at(-1);
    assert.ok(editedLast?.kind === 'rectangular-feature-pattern' && beforeLast?.kind === 'rectangular-feature-pattern');
    assert.deepEqual(editedLast.parent, beforeLast.parent);
    close(part('re-edited', edited).mass({ density: 1 }).volume, 23360);
    const reopened = part('reopened cut pattern', opened.doc); shape(reopened, ranges);
    const again = evaluateDoc(opened.doc, 2); assert.ok(again.ok, again.ok ? '' : again.error.detail); assert.equal(again.bodies.length, 1);
    assert.deepEqual(doc, before); assert.deepEqual(p.doc, before);
  }
});

test('public rectangular feature pattern: typed refusals preserve accepted input and results, including non-bindable count', () => {
  const source = seed(), sourceBefore = source.doc, accepted = source.rectangularFeaturePattern(options());
  const before = accepted.doc, massBefore = accepted.mass({ density: 1 });
  const inputs: object[] = [
    { axis: 'x', spacing: 16, count: 3, axis2: 'x', spacing2: 16, count2: 2 },
    { axis: 'x', spacing: 16, count: 33, axis2: 'y', spacing2: 16, count2: 2 },
    ...[0, 2.5, 65, NaN, Infinity].map(count2 => ({ axis: 'x', spacing: 16, count: 3, axis2: 'y', spacing2: 16, count2 })),
    ...[0, -1, 10001, NaN, Infinity].map(spacing2 => ({ axis: 'x', spacing: 16, count: 3, axis2: 'y', spacing2, count2: 2 })),
    { axis: 'q', spacing: 16, count: 3, axis2: 'y', spacing2: 16, count2: 2 },
    ...[0, 2.5, 65, NaN, Infinity].map(count => ({ axis: 'x', spacing: 16, count, axis2: 'y', spacing2: 16, count2: 2 })),
    ...[0, -1, 10001, NaN, Infinity].map(spacing => ({ axis: 'x', spacing, count: 3, axis2: 'y', spacing2: 16, count2: 2 })),
  ];
  for (const input of inputs) {
    const snapshot = structuredClone(input);
    // Deliberate JS admission calls; successful geometry above uses the typed public API.
    assert.throws(() => Reflect.apply(source.rectangularFeaturePattern, source, [input]), error => isRefusal(error, 'VALUE'));
    assert.deepEqual(input, snapshot); assert.deepEqual(source.doc, sourceBefore);
  }
  refused(() => source.rectangularFeaturePattern({ axis: 'x', spacing: 16, count: param('copies'), axis2: 'y', spacing2: 16, count2: 2 }), 'PARAMETER_UNBINDABLE');
  const lastIndex = before.nodes.length - 1;
  assert.throws(() => bindParameter(before, { feature: lastIndex, value: 'count', parameter: 'copies' }), error => isRefusal(error, 'PARAMETER_UNBINDABLE'));
  const box = part('not a cut').box({ w: 60, d: 40, h: 10 }), boxBefore = box.doc;
  refused(() => box.rectangularFeaturePattern({ axis: 'x', spacing: 16, count: 3, axis2: 'y', spacing2: 16, count2: 2 }), 'BAD_REFERENCE', 'evaluate');
  const moved = source.moved(Location.at([0, 0, 1])), movedBefore = moved.doc;
  refused(() => moved.rectangularFeaturePattern({ axis: 'x', spacing: 16, count: 3, axis2: 'y', spacing2: 16, count2: 2 }), 'BAD_REFERENCE', 'evaluate');
  // A stored active pattern must expose an invalid source to evaluation instead of silently disappearing.
  const broken = accepted.doc, seedIndex = broken.nodes.findIndex(n => n.kind === 'difference'); assert.ok(seedIndex >= 0);
  broken.nodes[seedIndex] = { ...broken.nodes[seedIndex], suppressed: true };
  assert.throws(() => part('suppressed source', broken));
  assert.throws(() => accepted.withParameters({ spacing: 0 }));
  assert.throws(() => accepted.withParameters({ spacing2: 0 }));
  assert.deepEqual(box.doc, boxBefore); assert.deepEqual(moved.doc, movedBefore);
  assert.deepEqual(source.doc, sourceBefore); assert.deepEqual(accepted.doc, before);
  assert.deepEqual(accepted.mass({ density: 1 }), massBefore); shape(accepted, [[8, 12], [24, 28], [40, 44]]);
});

test('rectangular cut pattern: second spacing, feature edits and stable names use the same document path', () => {
  const accepted = seed().rectangularFeaturePattern(options()), before = accepted.doc, index = before.nodes.length - 1;
  const second = accepted.withParameters({ spacing2: 12 });
  const brep = partBreps(second.doc)[0].brep;
  for (const x of [8, 12, 24, 28, 40, 44]) for (const y of [8, 12, 20, 24]) for (const z of [0, 10]) assert.ok(brep.vertices.some(v => v.point[0] === x && v.point[1] === y && v.point[2] === z));
  close(second.mass({ density: 1 }).volume, 23040);
  refused(() => seed().rectangularFeaturePattern({ ...options(), count2: param('copies') }), 'PARAMETER_UNBINDABLE');
  const names = (p: StudioPart) => p.select().faces().names().sort();
  assert.deepEqual(names(accepted), names(accepted.withParameters({ spacing: 12, spacing2: 12 })));
  const fields = editFields(before.nodes, index, before.parameters);
  assert.deepEqual(fields.map(f => f.key), ['axis', 'spacing', 'count', 'axis2', 'spacing2', 'count2']);
  for (const key of ['count', 'count2']) assert.throws(() => bindParameter(before, { feature: index, value: key, parameter: 'copies' }), e => isRefusal(e, 'PARAMETER_UNBINDABLE'));
  const count = fields.find(f => f.key === 'count2'); assert.ok(count?.kind === 'number');
  const reduced = { ...before, nodes: count.set(before.nodes, 1) };
  close(part('one row', reduced).mass({ density: 1 }).volume, 23520);
  assert.deepEqual(accepted.doc, before);
});

test('rectangular cut pattern: raw/chat admission and codec reject invalid recipes atomically', () => {
  const source = seed(), accepted = source.rectangularFeaturePattern(options()), before = accepted.doc, index = before.nodes.length - 1;
  const good = before.nodes[index];
  assert.equal(checkNode(good, before.nodes.slice(0, index), before.parameters), null);
  for (const edits of [{ axis2: 'x' }, { axis2: 'q' }, { count: 33, count2: 2 }, { count2: 0 }, { count2: 1.5 }, { spacing2: 0 }, { spacing2: -1 }, { spacing2: 10001 }]) {
    const node = { ...good, ...edits }, raw = { ...before, nodes: [...before.nodes.slice(0, index), node] };
    assert.ok(checkNode(node, before.nodes.slice(0, index), before.parameters));
    assert.ok('error' in readStudioDoc(JSON.stringify(raw)));
    assert.throws(() => Reflect.apply(source.rectangularFeaturePattern, source, [{ ...options(), ...edits }]), e => isRefusal(e, 'VALUE'));
    assert.deepEqual(accepted.doc, before);
  }
});

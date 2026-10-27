import test from 'node:test';
import assert from 'node:assert/strict';
import { part, param, Location, BarocssError, type BodyQuery, type StudioPart } from '../src/api';
import { evaluateDoc } from '../src/engine/evaluate';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';

// Frozen oracle.json: nominal X wedge11600; existing lift explains a small source offset.
// Y is the same wedge with X/Y exchanged. No nominal zero bound or new tolerance is asserted.
const angle = Math.atan(1 / 20) * 180 / Math.PI;
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)), `${a} != ${b}`);
const nominal = (p: StudioPart, expected: number) => {
  const result = evaluateDoc(p.doc, 1); assert.ok(result.ok, result.ok ? '' : result.error.detail);
  assert.equal(result.bodies.length, 1); assert.ok(result.bodies[0].volume !== null);
  assert.ok(Math.abs(result.bodies[0].volume - expected) <= 1e-6 * Math.max(1, Math.abs(expected)));
  return result.bodies[0];
};
const yMin = (b: BodyQuery) => b.faces().facing('-y');
const xMin = (b: BodyQuery) => b.faces().facing('-x');
const seed = () => part('X pull').box({ w: 40, d: 30, h: 10 });

test('public draft: signed principal pull and explicit neutral reach the existing solver with Z differential bounds', async () => {
  const base = seed(), before = base.doc, options = { angle, pull: 'x' as const, neutral: 0 }, optionsBefore = structuredClone(options);
  const made = base.draft(yMin, options), doc = made.doc, node = doc.nodes.at(-1);
  assert.ok(node && node.kind === 'draft'); assert.equal(node.pull, 'x'); assert.equal(node.neutral, 0); assert.equal(node.angle, angle);
  assert.deepEqual(node.faces, yMin(base.select()).names()); assert.deepEqual(doc.nodes.slice(0, -1), before.nodes);
  const actual = nominal(made, 11600);
  const reference = nominal(part('Z reference').box({ w: 30, d: 10, h: 40 }).draft(xMin, { angle, pull: 'z', neutral: 0 }), 11600);
  for (const side of ['min', 'max'] as const) {
    const expected = [reference.mesh.bounds[side][2], reference.mesh.bounds[side][0], reference.mesh.bounds[side][1]];
    actual.mesh.bounds[side].forEach((v, i) => close(v, expected[i]));
  }
  nominal(part('Y pull').box({ w: 30, d: 40, h: 10 }).draft(xMin, { angle, pull: 'y', neutral: 0 }), 11600);
  const reversed = base.draft(yMin, { angle, pull: '-x', neutral: 40 }); nominal(reversed, 11600);
  const reversedNode = reversed.doc.nodes.at(-1); assert.ok(reversedNode && reversedNode.kind === 'draft');
  assert.equal(reversedNode.pull, '-x'); assert.equal(reversedNode.neutral, 40);
  const opened = await readStudioFile(encodeStudioFile(doc)); assert.ok('doc' in opened, JSON.stringify(opened)); assert.deepEqual(opened.doc, doc);
  nominal(part('reopened draft', opened.doc), 11600);
  assert.deepEqual(options, optionsBefore); assert.deepEqual(base.doc, before); assert.deepEqual(made.doc, doc);
});

test('public draft: omitted Z and neutral retain legacy encoding; translated defaults and neutral parameter edits stay explicit', () => {
  const zBase = part('legacy Z').box({ w: 30, d: 10, h: 40 });
  const omitted = zBase.draft(xMin, { angle }), explicit = zBase.draft(xMin, { angle, pull: 'z', neutral: 0 });
  nominal(omitted, 11600); nominal(explicit, 11600);
  const legacy = omitted.doc.nodes.at(-1); assert.ok(legacy && legacy.kind === 'draft');
  assert.equal(Object.hasOwn(legacy, 'pull'), false); assert.equal(Object.hasOwn(legacy, 'neutral'), false);
  const moved = seed().moved(Location.at([7, 0, 0])), movedBefore = moved.doc;
  const automatic = moved.draft(yMin, { angle, pull: 'x' }), fixed = moved.draft(yMin, { angle, pull: 'x', neutral: 7 });
  const a = nominal(automatic, 11600), b = nominal(fixed, 11600);
  for (const side of ['min', 'max'] as const) a.mesh.bounds[side].forEach((v, i) => close(v, b.mesh.bounds[side][i]));
  assert.deepEqual(moved.doc, movedBefore);
  const base = seed().parameter('N', 0), before = base.doc, bound = base.draft(yMin, { angle, pull: 'x', neutral: param('N') });
  const saved = bound.doc, node = saved.nodes.at(-1); assert.ok(node && node.kind === 'draft'); assert.deepEqual(node.neutral, { parameter: 'N' });
  // Independent face y=(x-N)/20 gives nominal V=11600+20N; original source lift remains unchanged.
  const edited = bound.withParameters({ N: -2 }); nominal(edited, 11560);
  const after = edited.doc.nodes.at(-1); assert.ok(after && after.kind === 'draft'); assert.deepEqual(after.neutral, { parameter: 'N' });
  assert.deepEqual(bound.doc, saved); assert.deepEqual(base.doc, before);
});

test('public draft: invalid calls and a rejected neutral edit preserve accepted state and caller values', () => {
  const base = seed().parameter('N', 0), before = base.doc, accepted = base.draft(yMin, { angle, pull: 'x', neutral: param('N') });
  const saved = accepted.doc, expected = nominal(accepted, 11600).volume;
  for (const [options, code] of [
    [{ angle: 0, pull: 'x' }, 'DRAFT_ANGLE'], [{ angle: 45, pull: 'x' }, 'DRAFT_ANGLE'], [{ angle: NaN }, 'VALUE'],
    [{ angle, pull: 'X' }, 'VALUE'], [{ angle, pull: null }, 'VALUE'], [{ angle, pull: [1, 0, 0] }, 'VALUE'],
    [{ angle: param('N'), pull: 'x' }, 'VALUE'], [{ angle, pull: 'x', neutral: Infinity }, 'VALUE'],
    [{ angle, pull: 'x', neutral: 10001 }, 'VALUE'], [{ angle, pull: 'x', neutral: param('Missing') }, 'PARAMETER_UNKNOWN'],
  ] as const) {
    const snapshot = structuredClone(options);
    assert.throws(() => Reflect.apply(base.draft, base, [yMin, options]), error => error instanceof BarocssError && error.code === code);
    assert.deepEqual(options, snapshot); assert.deepEqual(base.doc, before); assert.deepEqual(accepted.doc, saved);
  }
  assert.throws(() => base.draft(b => b.faces().facing('+x'), { angle, pull: 'x' }), error => error instanceof BarocssError && error.code === 'DRAFT_PICK');
  assert.throws(() => accepted.withParameters({ N: 1 }), error => error instanceof BarocssError && error.code === 'SELECTION' && error.where === 'evaluate');
  assert.deepEqual(base.doc, before); assert.deepEqual(accepted.doc, saved); close(nominal(accepted, 11600).volume!, expected!);
});


test('public draft: unnamed focus stays ambiguous after another body, while explicit focus follows the drafted result', () => {
  const implicit = seed().draft(yMin, { angle, pull: 'x', neutral: 0 }).box({ w: 4, d: 4, h: 4, x: 80 });
  assert.equal(implicit.bodies().length, 2);
  assert.throws(() => implicit.select(), error => error instanceof BarocssError && error.code === 'BODY_AMBIGUOUS');
  const multi = seed().box({ w: 4, d: 4, h: 4, x: 80 }), multiBefore = multi.doc, keys = multi.bodies();
  assert.equal(keys.length, 2);
  const focused = multi.body(keys[0]).draft(yMin, { angle, pull: 'x', neutral: 0 });
  const selectedNames = focused.select().faces().names(); assert.ok(selectedNames.length > 0);
  const extra = focused.box({ w: 4, d: 4, h: 4, x: 90 }); assert.equal(extra.bodies().length, 3);
  assert.deepEqual(extra.select().faces().names(), selectedNames, 'an explicit focus follows the replacement and survives unrelated body creation');
  assert.deepEqual(multi.doc, multiBefore);
});

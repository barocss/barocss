// R7.4b, the selector-stability test (Onshape FeatureScript's point): a selector is resolved once, when its verb runs,
// to the persistent names the feature stores. After an upstream edit is re-evaluated, those names still pick the same
// edge — moved with the edit — or the part is refused, typed; never another edge in silence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { part, sketch, BarocssError } from '../dist/api/index.js';

const bracket = () => part('bracket').box({ w: 80, d: 40, h: 10 })
  .hole(b => b.faces().facing('+z'), { d: 8, x: 20, y: 20 })
  .fillet(b => b.edges().along('z'), { radius: 2 });
// (The part as it was before its last `n` features, to look at the body a later feature's names were picked on.)
const before = (doc, n) => part('before', { ...doc, features: doc.features.slice(0, doc.features.length - n) });
const volume = p => p.mass({ density: 1 }).volume;

test('a dimension edit upstream: the stored names pick the same edges, moved with it', () => {
  const was = bracket(), edited = was.doc;
  edited.features[0] = { ...edited.features[0], max: [60, 40] };
  const now = part('bracket', edited), stored = edited.features[3].edges;
  // The selector, run again on the edited body, picks exactly the edges the fillet already names…
  assert.deepEqual(before(edited, 1).select().edges().along('z').names(), stored);
  // …the far ones now at x = 60…
  const far = before(edited, 1).select().edges().where(e => e.names.includes('extrude1.side0|extrude1.side1')).list();
  assert.deepEqual(far.map(e => [e.a[0], e.b[0]]), [[60, 60]]);
  // …and every corner is still rounded: the part lost exactly the 20 × 40 × 10 slab the edit took off.
  assert.ok(Math.abs(volume(was) - volume(now) - 20 * 40 * 10) < 1e-6, `${volume(was) - volume(now)}`);
});

test('a vertex inserted upstream (the studio sketcher\'s edit, keeping the side tags): the same named edge', () => {
  // The corner at (40, 40) of a square, rounded; the facade's sketch tags its sides e1 … e4 (D86).
  const corner = b => b.edges().along('z').where(e => e.a[0] === 40 && e.a[1] === 40);
  const was = part('tab').extrude(sketch().polygon([[0, 0], [40, 0], [40, 40], [0, 40]]), { h: 10 }).fillet(corner, { radius: 3 }), edited = was.doc;
  assert.deepEqual(edited.features[2].edges, ['extrude1.side[e2]|extrude1.side[e3]']);
  // A point inserted in the first side, as the sketcher does it: the new piece takes a new tag, the others keep theirs.
  edited.features[0] = { ...edited.features[0], points: [[0, 0], [20, -5], [40, 0], [40, 40], [0, 40]], sideTags: { outer: ['e1', 'e5', 'e2', 'e3', 'e4'] } };
  const named = before(edited, 1).select().edges().where(e => e.names.includes('extrude1.side[e2]|extrude1.side[e3]')).list();
  assert.deepEqual(named.map(e => [e.a[0], e.a[1]]), [[40, 40]]);
  // The edited part rounds that corner: the same as building the new outline afresh and picking (40, 40) again.
  const fresh = part('tab').extrude(sketch().polygon([[0, 0], [20, -5], [40, 0], [40, 40], [0, 40]]), { h: 10 }).fillet(corner, { radius: 3 });
  assert.ok(Math.abs(volume(part('tab', edited)) - volume(fresh)) < 1e-9 * volume(fresh));
});

test('an edit that takes the named edges away: a typed refusal, naming the feature, never another edge', () => {
  const edited = bracket().doc;
  edited.features[0] = { id: 'sketch1', kind: 'sketch', profile: 'circle', center: [40, 20], radius: 20 };
  let e;
  try { part('bracket', edited); } catch (error) { e = error; }
  assert.ok(e instanceof BarocssError, String(e));
  assert.equal(e.code, 'SELECTION'); assert.equal(e.where, 'evaluate'); assert.equal(e.details?.feature, 'fillet1');
  assert.match(e.message, /^\[SELECTION\] fillet1: no edge named extrude1\.side0\|extrude1\.side1/);
});

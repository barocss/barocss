import test from 'node:test';
import assert from 'node:assert/strict';
import { bandHighlight } from '../src/app/bandHighlight';

const body = (node: number, names: string[][]) => ({ ref: { node, side: 'solid' as const }, mesh: { edges: names.map(n => ({ names: n })) } as never });

test('the Band surface picks are highlighted on the body that owns them, A and B alike', () => {
  const bodies = [body(1, [['n1.top|n1.side'], ['n1.bottom|n1.side']]), body(3, [['n3.bottom|n3.side'], ['n3.top|n3.side']])];
  const sel = bandHighlight(bodies, [{ side: 'a', parent: { node: 1, side: 'solid' }, names: ['n1.top|n1.side'] }, { side: 'b', parent: { node: 3, side: 'solid' }, names: ['n3.bottom|n3.side'] }]);
  assert.deepEqual(sel, { faces: [], edges: [{ body: 0, edge: 0 }, { body: 1, edge: 0 }], bodies: [] });
});

test('a name on another body, an unknown parent and no picks highlight nothing', () => {
  const bodies = [body(1, [['x']]), body(3, [['y']])];
  assert.equal(bandHighlight(bodies, [{ side: 'a', parent: { node: 3, side: 'solid' }, names: ['x'] }]), null);
  assert.equal(bandHighlight(bodies, [{ side: 'b', parent: { node: 9, side: 'solid' }, names: ['x'] }]), null);
  assert.equal(bandHighlight(bodies, []), null);
});

test('several display edges of one name (a split chain) are all highlighted once', () => {
  const sel = bandHighlight([body(1, [['n'], ['m'], ['n']])], [{ side: 'a', parent: { node: 1, side: 'solid' }, names: ['n', 'n'] }]);
  assert.deepEqual(sel?.edges, [{ body: 0, edge: 0 }, { body: 0, edge: 2 }]);
});

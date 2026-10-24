// The diagram is explanatory geometry. Compare its displayed volumes (0.001 mm³ precision) with the actual kernel.
import test from 'node:test';
import assert from 'node:assert/strict';
import { part } from '@barocss/cad/api';
import { HEIGHT, exampleGeometry, keepRegion, numberLabel } from '../docs/.vitepress/components/booleanGeometry.mjs';

test('diagram: the two cube sections have 50 mm² in each of A-only, common and B-only', () => {
  const g = exampleGeometry('box', 5);
  assert.deepEqual(g.regions.map(r => r.area), [50, 50, 50]);
  assert.deepEqual(g.areas, { union: 150, difference: 50, intersect: 50 });
  assert.deepEqual(g.regions.map(r => keepRegion('difference', r)), [true, false, false]);
});

test('diagram: a radius-3 cylinder at (8, 5) crosses X = 10 at Y = 5 ± √5', () => {
  const g = exampleGeometry('cylinder', 8);
  assert.deepEqual(g.points, [[10, 5 - Math.sqrt(5)], [10, 5 + Math.sqrt(5)]]);
  assert.deepEqual(g.points.map(p => p.map(numberLabel)), [['10', '2.764'], ['10', '7.236']]);
  assert.equal(numberLabel(exampleGeometry('cylinder', 5).areas.intersect * HEIGHT), '282.743');
  assert.equal(numberLabel(exampleGeometry('cylinder', 10).areas.intersect * HEIGHT), '141.372');
  assert.equal(exampleGeometry('cylinder', 14).areas.intersect, 0);
});

test('diagram: all three displayed operations match the kernel for overlapping, contained and disjoint inputs', () => {
  const a = part('A').box({ w: 10, d: 10, h: 10 });
  for (const [shape, positions] of [['box', [-12, 0, 5, 10, 15]], ['cylinder', [-4, 5, 8, 10, 13, 14]]]) {
    for (const x of positions) {
      const g = exampleGeometry(shape, x);
      const tool = p => shape === 'box' ? p.box({ w: 10, d: 10, h: 10, x }) : p.cylinder({ r: 3, h: 10, x, y: 5 });
      for (const [operation, method] of [['union', 'union'], ['difference', 'subtract'], ['intersect', 'intersect']]) {
        const result = a[method](tool);
        const actual = result.bodies().length ? result.mass({ density: 1 }).volumeMM3 : 0;
        assert.equal(numberLabel(g.areas[operation] * HEIGHT), numberLabel(actual), `${shape} x=${x} ${operation}`);
      }
    }
  }
});

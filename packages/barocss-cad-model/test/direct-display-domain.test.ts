import test from 'node:test';
import assert from 'node:assert/strict';
import { surfaceDomain } from '@barocss/cad';
import { directDisplay, directOps, emptyDirect, geometryOf, importSource } from '../src/engine/direct';

const SOURCE = `@model display_domain { version:0; length-unit:mm;
 @surface #panel { type:nurbs; degree-u:1; degree-v:1; knots-u:[-2,-2,6,6]; knots-v:[1,1,7,7]; control-points:[[[10,-6,3],[10,24,3]],[[50,-6,3],[50,24,3]]]; weights:[[1,1],[1,1]]; }
 @curve #mask { type:nurbs; degree:1; knots:[0,0,1,2,3,4,5,6,7,8,8]; control-points:[[15,-1,3],[35,-1,3],[35,15,3],[29,15,3],[29,5,3],[21,5,3],[21,15,3],[15,15,3],[15,-1,3]]; weights:[1,1,1,1,1,1,1,1,1]; }
}`;
const CROPS: { name: string; keep: 'inside' | 'outside'; u: [number, number]; v: [number, number]; count: number }[] = [
  { name: 'enclosed outside hole', keep: 'outside', u: [-1.6, 5], v: [1.4, 6.2], count: 1 },
  { name: 'full retained outside rectangle', keep: 'outside', u: [0.4, 1.6], v: [3.8, 4.6], count: 1 },
  { name: 'inside two components control', keep: 'inside', u: [-0.8, 2.8], v: [3.7, 5], count: 2 },
  { name: 'outside pocket control', keep: 'outside', u: [-1.6, 5], v: [1.4, 3.7], count: 2 },
];
for (const crop of CROPS) test(`fractional Region directDisplay: ${crop.name} has finite mesh and isocurves`, () => {
  const source = importSource(emptyDirect(), SOURCE, 'Display domain');
  const trimmed = directOps.trimByCurve(source, source.objects[0].id, source.objects[1].id, crop.keep);
  assert.equal(trimmed.objects[0].trims![0].uv.length, 160);
  const region = directOps.surfaceRegion(trimmed, trimmed.objects[0].id, crop.u, crop.v), before = structuredClone(region);
  const results = region.objects.slice(trimmed.objects.length), shown = directDisplay(region);
  assert.equal(results.length, crop.count);
  for (const object of results) {
    const display = shown.find(o => o.id === object.id);
    assert.ok(display, 'The result surface must survive both mesh and isocurve evaluation');
    assert.equal(display.kind, 'surface');
    assert.ok(display.positions.length > 0 && display.indices!.length > 0 && display.isos!.length > 0);
    assert.equal(display.normals!.length, display.positions.length);
    for (const values of [display.positions, display.normals!, display.isos!, display.controls]) assert.ok(values.every(Number.isFinite));
    for (const index of display.indices!) assert.ok(index < display.positions.length / 3);
    const surface = geometryOf(region, object); assert.equal(surface.kind, 'surface');
    if (surface.kind !== 'surface') throw new Error('Expected a surface');
    assert.deepEqual(surfaceDomain(surface), { u: crop.u, v: crop.v });
    if (crop.count === 1) for (const u of crop.u) for (const v of crop.v) {
      const point = [Math.fround(20 + 5 * u), Math.fround(-11 + 5 * v), 3];
      let found = false;
      for (let i = 0; i < display.isos!.length; i += 3) if (point.every((value, k) => display.isos![i + k] === value)) { found = true; break; }
      assert.ok(found, `Missing native corner ${point}`);
    }
    for (let i = 0; i < display.positions.length; i += 3) {
      assert.ok(display.positions[i] >= Math.fround(20 + 5 * crop.u[0]) && display.positions[i] <= Math.fround(20 + 5 * crop.u[1]));
      assert.ok(display.positions[i + 1] >= Math.fround(-11 + 5 * crop.v[0]) && display.positions[i + 1] <= Math.fround(-11 + 5 * crop.v[1]));
    }
  }
  assert.deepEqual(region, before);
  assert.deepEqual(directDisplay(region), shown, 'Cached display retains the same complete mesh');
});

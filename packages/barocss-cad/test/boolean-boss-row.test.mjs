import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, outputOf, checkOutput } from '../dist/index.js';

// D282: a plate with one edge rounded (a B-rep from then on), then a row of bosses joined one by one through the analytic
// Boolean. Each boss adds 3 faces, 6 edges and 4 vertices; a half circle read back one ulp past π had been split at its
// top after the sixth boss (one edge and vertex more), and the first boss's cylinder halves swapped `#1` and `#2` from one
// Boolean to the next (their points inside share one x to within rounding).
const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const n = 8;
const features = [{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10 * n / 2 + 10, 30] }, { id: 'p', kind: 'extrude', sketch: 's', height: 8 }];
const top = outputOf(evaluateCadPart(D(features)), 'p').brep.edges.map(x => x.name).filter(x => x && /top/.test(x))[0];
features.push({ id: 'r', kind: 'fillet', target: 'p', edges: [top], radius: 2 });
for (let k = 0, last = 'r'; k < n; k++) {
  features.push({ id: `c${k}s`, kind: 'sketch', profile: 'circle', plane: { origin: [0, 0, 8], normal: [0, 0, 1], xAxis: [1, 0, 0] }, center: [10 + 10 * Math.floor(k / 2), k % 2 ? 22 : 8], radius: 3 }, { id: `c${k}`, kind: 'extrude', sketch: `c${k}s`, height: 6 }, { id: `b${k}`, kind: 'union', target: last, tool: `c${k}` });
  last = `b${k}`;
}
const stepOf = k => { const upto = features.slice(0, features.findIndex(f => f.id === `b${k}`) + 1); return outputOf(evaluateCadPart(D(upto)), `b${k}`); };

test('D282: a row of bosses on a rounded plate adds the same edges and vertices per boss, and keeps the first boss\'s names', () => {
  const first = stepOf(0).brep;
  // The first boss's lower half (y < 8) by its name, after the first boss.
  const lowerHalf = brep => { const e = brep.edges.find(x => x.name === 'c0.side0#1|c0.top'); const p = e.curve.controlPoints; return p[Math.floor(p.length / 2)][1] < 8; };
  const half0 = lowerHalf(first);
  for (let k = 0; k < n; k++) {
    const o = stepOf(k), b = o.brep;
    assert.equal(checkOutput(o).valid, true, `b${k} valid`);
    assert.equal(b.edges.length - first.edges.length, 6 * k, `b${k} edges`);
    assert.equal(b.vertices.length - first.vertices.length, 4 * k, `b${k} vertices`);
    assert.equal(lowerHalf(b), half0, `b${k}: c0.side0#1 is the same half as after b0`);
  }
});

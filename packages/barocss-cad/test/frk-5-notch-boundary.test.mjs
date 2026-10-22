import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, curveEvaluator } from '../dist/index.js';

const specimen = (notch, origin) => ({
  format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {},
  features: [{
    id: 'f', kind: 'frame',
    points: [[-200, 0, 0], [200, 0, 0], [0, 0, 300], [0, 0, 0]].map(p => p.map((x, i) => x + origin[i])),
    segments: [[0, 1], [2, 3]], section: { kind: 'round-tube', diameter: 30, wall: 2 }, up: [0, 0, 1],
    corners: { default: 'none', tee: 'cope', at: [{ point: 3, kind: 'cope', notch }] },
  }],
});

// Check emitted geometry against the physical cylinder/saw equations at points
// different from the fitter's quarter-span probes. This supplements the existing
// independent 1e-12 relative mass oracles; it does not replace or loosen them.
for (const notch of [{ kind: 'holesaw', diameter: 52 }, { kind: 'v', depth: 20, angle: 90 }]) {
  for (const origin of [[0, 0, 0], [1000, -2000, 3000]]) {
    test(`FRk5 ${notch.kind} final boundary lies on tube and cutter at origin ${origin}`, () => {
      const output = evaluateCadPart(specimen(notch, origin)).outputs[1];
      assert.equal(output.validate().valid, true);
      const brep = output.brep, cutterFaces = brep.faces.filter(f => f.name?.includes('_notch1.'));
      assert.ok(cutterFaces.length > 0, 'retain the cutter face provenance');
      const loops = new Map(brep.loops.map(l => [l.id, l])), coedges = new Map(brep.coedges.map(c => [c.id, c]));
      const boundary = new Set(cutterFaces.flatMap(f => f.loops.flatMap(id => loops.get(id).coedges.map(id => coedges.get(id).edge))));
      const curves = brep.edges.filter(e => boundary.has(e.id) && e.curve.degree > 1).map(e => e.curve);
      assert.ok(curves.length > 0, 'inspect the actual curved notch boundary');
      for (const curve of curves) {
        assert.ok(curve.controlPoints.every(p => p[2] - origin[2] < 100), `${curve.id}: notch remains at the cut end`);
        const evaluate = curveEvaluator(curve), knots = [...new Set(curve.knots)];
        for (let i = 1; i < knots.length; i++) for (const f of [0, .371, .619, 1]) {
          const p = evaluate(knots[i - 1] + f * (knots[i] - knots[i - 1])).map((x, axis) => x - origin[axis]);
          const radialError = Math.min(Math.abs(Math.hypot(p[0], p[1]) - 15), Math.abs(Math.hypot(p[0], p[1]) - 13));
          const sawError = notch.kind === 'holesaw' ? Math.abs(Math.hypot(p[1], p[2]) - 26) : Math.abs(p[2] - (20 - Math.abs(p[1])));
          assert.ok(radialError <= 1e-10, `${curve.id}: tube residual ${radialError} mm`);
          assert.ok(sawError <= 1e-10, `${curve.id}: saw residual ${sawError} mm`);
        }
      }
    });
  }
}

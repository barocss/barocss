import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// The NURBS builders below (ruled and lofted surfaces from sections, knot insertion, degree elevation, curve/plane and
// curve/line roots, v-linear sections) have no tests of their own: their checks are the assertions in their demos
// under examples/cad-nurbs, which read the built kernel. Each demo is run here (its outputs into a temporary folder)
// and must finish. Demos that compare against a build kept elsewhere, or import the TypeScript sources directly, are not
// listed (they do not run in a fresh checkout).
const demos = resolve(import.meta.dirname, '../../../examples/cad-nurbs');
const LISTED = [
  'compatible-ruled-surface', 'degree-matched-bezier-ruled', 'rational-ruled-surface', 'piecewise-rational-loft', 'section-knot-alignment',
  'curve-knot-insertion', 'surface-knot-insertion', 'bezier-curve-degree-elevation',
  'own-curve-plane-intersection', 'own-curve-line-intersection', 'own-multispan-curve-plane', 'vlinear-plane-section', 'multispan-vlinear-plane-section',
];

test('the NURBS builders\' demos run to the end against the built kernel (their own assertions)', () => {
  const out = mkdtempSync(join(tmpdir(), 'cad-nurbs-demos-'));
  try {
    for (const name of LISTED) {
      const r = spawnSync(process.execPath, [join(demos, `${name}-demo.mjs`), '--source', join(out, name)], { cwd: demos, encoding: 'utf8' });
      assert.equal(r.status, 0, `${name}: ${(r.stderr || r.stdout).split('\n').filter(l => !/^\s+at /.test(l)).slice(0, 12).join('\n')}`);
    }
  } finally { rmSync(out, { recursive: true, force: true }); }
});

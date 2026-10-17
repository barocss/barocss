import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, featureLabel, withNode } from '../src/engine/doc';
import { meshInMM, readMeshFile } from '../src/engine/meshImport';

test('an STL in centimetres opens as a solid in mm: welded, scaled, its flat faces merged', () => {
  const mesh = readMeshFile('block-cm.stl', new Uint8Array(readFileSync(join(process.cwd(), 'test/fixtures/block-cm.stl'))));
  const cm = meshInMM(mesh, 'cm');
  assert.equal(cm.positions.length / 3, 16, 'the 96 corners of 32 triangles welded to 16 vertices');
  assert.deepEqual(cm.size, [40, 20, 10]);
  assert.deepEqual(meshInMM(mesh, 'in').size, [101.6, 50.8, 25.4]);
  const doc = withNode(emptyDoc(), { kind: 'mesh', name: 'block', unit: 'cm', ...cm }), r = evaluateDoc(doc, 1);
  assert.ok(r.ok, r.ok ? '' : r.error.hint);
  assert.ok(Math.abs(r.bodies[0].volumeMM3! - (40 * 20 - 10 * 10) * 10) < 1e-6);
  assert.equal(featureLabel(doc.nodes[0], 0, doc.nodes), 'Mesh block');
});

test('an STL imported as facet faces (F0): regions named by the node, flat ones shown as planes; an older planar node keeps its names', () => {
  const mesh = readMeshFile('block-cm.stl', new Uint8Array(readFileSync(join(process.cwd(), 'test/fixtures/block-cm.stl'))));
  const cm = meshInMM(mesh, 'cm');
  const facets = evaluateDoc(withNode(emptyDoc(), { kind: 'mesh', name: 'block', unit: 'cm', ...cm, representation: 'facets' }), 1);
  assert.ok(facets.ok, facets.ok ? '' : facets.error.hint);
  const faces = facets.bodies[0].mesh.faces;
  assert.ok(faces.every(f => /^n\d+\.region\d+$/.test(f.name)), faces.map(f => f.name).join());
  assert.equal(faces.length, 10); assert.ok(faces.every(f => f.kind === 'plane'));
  assert.ok(Math.abs(facets.bodies[0].volumeMM3! - 7000) < 1e-6);
  const planar = evaluateDoc(withNode(emptyDoc(), { kind: 'mesh', name: 'block', unit: 'cm', ...cm }), 2);
  assert.ok(planar.ok && planar.bodies[0].mesh.faces.every(f => /\.facet\d+$/.test(f.name)));
});

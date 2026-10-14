// Recorded #1602 meshes; CPU scene/selection admission only. No native/GPU execution.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = resolve(import.meta.dirname, '../../..'), output = resolve(process.env.EVIDENCE_DIR ?? '/tmp/prism-scene'); mkdirSync(output, { recursive: true });
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const bundle = await require('esbuild').build({ entryPoints: [resolve(root, 'packages/barocss-cad-editor/src/prism-feature-scene.ts')], bundle: true, platform: 'node', format: 'esm', write: false,
  alias: { '@barocss/gpu': resolve(root, 'packages/barocss-gpu/src/index.ts') } });
writeFileSync(resolve(output, 'scene.mjs'), bundle.outputFiles[0].text);
const { preparePrismFeatureScene: prepare, pickPrismFeatureScene: pick } = await import(pathToFileURL(resolve(output, 'scene.mjs')));
const packet = JSON.parse(readFileSync(resolve(import.meta.dirname, 'fixtures/convex-display.packet.json'), 'utf8'));
const source = prepare(packet, 'source'), result = prepare(packet, 'result');
assert.equal(source.scene.geometries.length, packet.components[0].mesh.faces.length);
assert.equal(result.scene.geometries.length, packet.components.slice(1).reduce((count, component) => count + component.mesh.faces.length, 0));
assert.ok(source.packet.components[0].mesh.faces.length > 6);
assert.ok(packet.components.some(c => c.mesh.faces.some(f => f.orientation === 'reverse')));
for (const [i, component] of packet.components.slice(1).entries()) {
  for (const [faceIndex, face] of component.mesh.faces.entries()) {
    const geometry = result.scene.geometries.find(g => g.id === `prism_geometry_${i}_${faceIndex}`);
    assert.deepEqual(geometry.indices, component.mesh.indices.slice(face.indexOffset, face.indexOffset + face.indexCount));
    assert.deepEqual(geometry.positions, component.mesh.positionsMM.flatMap((v, i, a) => i % 3 ? [] : [v, a[i + 2], -a[i + 1]]));
    assert.deepEqual(geometry.normals, component.mesh.normals.flatMap((v, i, a) => i % 3 ? [] : [v, a[i + 2], -a[i + 1]]));
  }
}
const changes = [p => p.components[0].mesh.indices[0] = 999, p => p.components[0].mesh.normals[0] = NaN,
  p => p.components[0].mesh.faces[0].vertexOffset++, p => p.components[0].boundaries[0].faceIndex = 100,
  p => p.components[0].boundaries[0].nativeVertexIds[0] = 'bad', p => p.components[0].internalDiagonals[0].role = 'native-boundary',
  p => p.components[0].solid = {}, p => p.components[0].mesh.faces[0].faceId = 'bad',
  p => p.components.push(structuredClone(p.components[1])), p => p.outcomes[0].solidId = 'bad'];
for (const change of changes) { const broken = structuredClone(packet); change(broken); assert.throws(() => prepare(broken, 'result')); }
const empty = structuredClone(packet); empty.components = empty.components.slice(0, 1); empty.outcomes.forEach(o => o.status = 'empty');
assert.equal(prepare(empty, 'result').scene.geometries.length, 0); assert.equal(pick(prepare(empty, 'result'), 100, 100, 50, 50), null);
const collision = structuredClone(packet); collision.components[2] = { ...structuredClone(collision.components[1]), role: 'second' };
collision.outcomes[1].solidId = collision.components[2].report.solidId;
const shared = prepare(collision, 'result'); assert.notEqual(shared.scene.nodes[0].id, shared.scene.nodes[1].id);
const hits = [];
for (let y = 20; y < 180; y += 10) for (let x = 20; x < 180; x += 10) { const hit = pick(result, 200, 200, x, y); if (hit) hits.push(hit); }
assert.ok(hits.length); assert.ok(hits.every(h => h.documentId === packet.documentId && h.revision === packet.revision && h.boundaries.length >= 3));
const copy = prepare(packet, 'result'); copy.packet.components[0].mesh.positionsMM[0] = 99; assert.notEqual(packet.components[0].mesh.positionsMM[0], 99);
console.log(JSON.stringify({ ok: true, malformedControls: changes.length, sourceFaces: packet.components[0].mesh.faces.length, selectedRoles: [...new Set(hits.map(h => h.role))], evidence: 'recorded native mesh -> actual generic CPU scene/raycast; no GPU pixels' }));

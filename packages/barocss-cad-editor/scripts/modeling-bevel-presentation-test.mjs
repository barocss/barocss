// #1990: real retained convex packets through source admission and CPU rays.
// No native evaluation, WebGPU pixels, browser interaction or manufacturing claim.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = realpathSync(resolve(import.meta.dirname, '../../..'));
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const fixture = JSON.parse(readFileSync(resolve(import.meta.dirname, 'fixtures/modeling-bevel-presentation/inputs.json')));
const output = resolve(process.env.EVIDENCE_DIR ?? '/tmp/cad-1990-bevel-presentation');
mkdirSync(output, { recursive: true });
const hash = value => createHash('sha256').update(value).digest('hex');
const source = name => resolve(root, 'packages/barocss-cad-editor/src/' + name + '.ts');
const gpu = resolve(root, 'packages/barocss-gpu/src/index.ts');
const built = await require('esbuild').build({ stdin: { contents: `export * from ${JSON.stringify(source('prism-feature-scene'))};\nexport * from ${JSON.stringify(source('modeling-scene'))};\nexport { prepareEngineCameraRay, raycastEngineScene, prepareEngineScene } from ${JSON.stringify(gpu)};`,
  resolveDir: root, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', write: false,
  alias: { '@barocss/gpu': gpu } });
const bundlePath = resolve(output, 'bevel-presentation.mjs');
writeFileSync(bundlePath, built.outputFiles[0].text);
const api = await import(pathToFileURL(bundlePath));
let checks = 0, interiorBevelHits = 0, rayPairs = 0;
const data = [];

function rayAt(scene, width, height, x, y) {
  return api.prepareEngineCameraRay(scene.camera, { format: 'barocss-gpu-engine-camera-ray-request', version: 0,
    pixelOrigin: 'bottom-left', sampling: 'pixel-center', viewportWidth: width, viewportHeight: height, pixelX: x, pixelY: y }).ray;
}
const subtract = (a, b) => a.map((value, axis) => value - b[axis]);
const dot = (a, b) => a.reduce((sum, value, axis) => sum + value * b[axis], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = values => values.map(value => value / Math.hypot(...values));
function pixelAt(scene, point, width, height) {
  const camera = scene.camera, backward = unit(subtract(camera.eye, camera.target));
  const right = unit(cross(camera.up, backward)), vertical = cross(backward, right);
  const relative = subtract(point, camera.eye), depth = -dot(relative, backward);
  if (depth <= camera.near || depth >= camera.far) return null;
  const tangent = Math.tan(camera.fovYDegrees * Math.PI / 360);
  const x = Math.round((dot(relative, right) / (depth * tangent * width / height) + 1) * width / 2 - .5);
  const y = Math.round((dot(relative, vertical) / (depth * tangent) + 1) * height / 2 - .5);
  return x >= 0 && x < width && y >= 0 && y < height ? [x, y] : null;
}
function baselineScene(display, components) {
  const geometries = components.map((component, i) => ({ ...display.scene.geometries.find(g => g.id === `prism_geometry_${i}_0`),
    id: `original_${i}`, indices: [...component.mesh.indices] }));
  return { ...display.scene, geometries, materials: [{ id: 'original_material', type: 'unlit', colorSpace: 'linear', color: [.3, .58, .8] }],
    nodes: geometries.map((geometry, i) => ({ id: `original_node_${i}`, parentId: null, type: 'mesh', geometryId: geometry.id,
      materialId: 'original_material', translation: [0, 0, 0], rotationXYZW: [0, 0, 0, 1], scale: [1, 1, 1], visible: true })) };
}
for (const spec of fixture.packets) {
  const bytes = readFileSync(resolve(root, spec.path));
  assert.equal(hash(bytes), spec.sha256); checks++;
  const native = JSON.parse(bytes), packet = native.display, before = structuredClone(packet);
  assert.equal(native.ok, true);
  assert.equal(packet.profile, 'model-outputs');
  assert.equal(packet.components.length, spec.outputs);
  assert.equal(JSON.parse(native.text).nodes.filter(node => node.kind === 'chamfer').length, spec.bevels);
  assert.ok(packet.components.every(component => component.mesh.faces.length === spec.facesPerOutput)); checks++;
  const cases = [];
  for (const [aspect, orientation] of [[1, 'isometric'], [1.5, 'isometric'], [1, 'top']]) {
    const display = api.prepareModelingScene(packet, aspect, undefined, orientation);
    const direct = api.preparePrismFeatureScene(packet, 'result', aspect, orientation);
    const original = baselineScene(display, packet.components);
    assert.equal(api.prepareEngineScene(display.scene).draws.length, spec.outputs * spec.facesPerOutput);
    assert.equal(display.scene.materials.length, spec.outputs * spec.facesPerOutput);
    const seen = new Set(), shades = new Set(), roles = new Set();
    for (const [componentIndex, component] of packet.components.entries()) {
      const drawFaces = display.scene.geometries.filter(geometry => geometry.id.startsWith(`prism_geometry_${componentIndex}_`));
      assert.equal(drawFaces.length, component.mesh.faces.length);
      for (const [faceIndex, face] of component.mesh.faces.entries()) {
        const geometry = display.scene.geometries.find(g => g.id === `prism_geometry_${componentIndex}_${faceIndex}`);
        const node = display.scene.nodes.find(n => n.geometryId === geometry.id);
        const material = display.scene.materials.find(m => m.id === node.materialId);
        assert.deepEqual(geometry.positions, original.geometries[componentIndex].positions);
        assert.deepEqual(geometry.normals, original.geometries[componentIndex].normals);
        assert.deepEqual(geometry.uvs, original.geometries[componentIndex].uvs);
        assert.deepEqual(geometry.uvs, component.mesh.parametersUV, 'admitted native UV values must survive face splitting');
        assert.equal(geometry.winding, original.geometries[componentIndex].winding);
        assert.deepEqual(geometry.indices, component.mesh.indices.slice(face.indexOffset, face.indexOffset + face.indexCount));
        for (let local = 0; local < geometry.indices.length / 3; local++) {
          const originalTriangle = face.indexOffset / 3 + local;
          assert.ok(!seen.has(`${componentIndex}/${originalTriangle}`)); seen.add(`${componentIndex}/${originalTriangle}`);
          assert.deepEqual(geometry.indices.slice(local * 3, local * 3 + 3), component.mesh.indices.slice(originalTriangle * 3, originalTriangle * 3 + 3));
        }
        shades.add(JSON.stringify(material.color));
      }
    }
    assert.equal(seen.size, packet.components.reduce((sum, component) => sum + component.mesh.indices.length / 3, 0));
    assert.ok(shades.size >= 3, 'faces must have distinct visible categories'); checks++;
    // Compare actual GPU CPU ray intersections and public pick lineage with the unsplit geometry.
    const [width, height] = aspect === 1.5 ? [300, 200] : [200, 200];
    let pairs = 0, diagonal = 0;
    const pixels = new Map();
    for (const geometry of display.scene.geometries) for (let local = 0; local < geometry.indices.length / 3; local++) {
      const indices = geometry.indices.slice(local * 3, local * 3 + 3);
      const point = [0, 1, 2].map(axis => indices.reduce((sum, index) => sum + geometry.positions[index * 3 + axis], 0) / 3);
      const pixel = pixelAt(display.scene, point, width, height);
      if (pixel) pixels.set(pixel.join(','), pixel);
    }
    for (const [x, y] of pixels.values()) {
      const ray = rayAt(display.scene, width, height, x, y);
      const grouped = api.raycastEngineScene(display.scene, ray);
      const base = api.raycastEngineScene(original, ray);
      assert.equal(Boolean(grouped), Boolean(base));
      if (!grouped) continue;
      const picked = api.pickModelingScene(display, width, height, x, y);
      const directPicked = api.pickPrismFeatureScene(direct, width, height, x, y);
      assert.ok(picked && directPicked);
      assert.equal(picked.role, directPicked.role);
      assert.equal(picked.triangleIndex, directPicked.triangleIndex);
      const componentIndex = Number(base.geometryId.slice('original_'.length));
      const component = packet.components[componentIndex];
      assert.equal(picked.role, component.role);
      assert.equal(picked.solidId, component.report.solidId);
      for (const key of ['distance', 'point', 'normal']) assert.deepEqual(grouped[key], base[key]);
      // An interior hit has one original triangle. Exact boundaries may tie between incident faces.
      if (Math.min(...grouped.barycentric) > .05 && Math.min(...base.barycentric) > .05) {
        assert.equal(picked.triangleIndex, base.triangleIndex);
        assert.deepEqual(picked.vertices, component.mesh.indices.slice(base.triangleIndex * 3, base.triangleIndex * 3 + 3)
          .map(index => component.mesh.vertices[index]));
        assert.ok(component.mesh.faces.some(face => face.faceId === picked.face.faceId));
        const normal = component.mesh.normals.slice(picked.face.vertexOffset * 3, picked.face.vertexOffset * 3 + 3);
        if (normal.every(value => Math.abs(value) < 1 - 1e-6)) diagonal++;
      }
      roles.add(picked.role); pairs++;
    }
    assert.ok(pairs > 0); assert.equal(roles.size, spec.outputs);
    if (orientation === 'isometric') { assert.ok(diagonal > 0, 'ordinary bevel interior must be picked'); interiorBevelHits += diagonal; }
    rayPairs += pairs; checks++;
    assert.throws(() => api.pickModelingScene(structuredClone(display), width, height, 20, 20), /original convex draw authority/); checks++;
    const tampered = api.preparePrismFeatureScene(packet, 'result', aspect, orientation);
    tampered.scene.geometries[0].id = tampered.scene.geometries[1].id;
    assert.throws(() => api.pickPrismFeatureScene(tampered, width, height, 20, 20), /original convex draw authority/); checks++;
    cases.push({ aspect, orientation, draws: display.scene.geometries.length, rayPairs: pairs, interiorBevelHits: diagonal, roles: [...roles] });
  }
  assert.deepEqual(packet, before, 'retained source bytes must not change'); checks++;
  data.push({ input: spec.path, sha256: spec.sha256, cases });
}
const single = JSON.parse(readFileSync(resolve(root, fixture.packets[0].path))).display;
assert.ok(single.components[0].mesh.parametersUV.some(value => value !== 0), 'retained UV proof must be nonzero'); checks++;
for (const mutate of [
  scene => { scene.geometries[0].positions[0] += 1; },
  scene => { scene.geometries[0].normals[0] += 1; },
  scene => { scene.geometries[0].uvs[0] += 1; },
  scene => { scene.geometries[0].indices[0] += 1; },
  scene => { scene.nodes[0].translation[0] += 1; },
  scene => { scene.nodes[0].visible = false; },
  scene => { scene.materials[0].color[0] += .1; }
]) {
  const display = api.preparePrismFeatureScene(single, 'result');
  mutate(display.scene);
  assert.throws(() => api.pickPrismFeatureScene(display, 200, 200, 50, 50), /original convex draw authority/); checks++;
}
const namedSource = structuredClone(single);
namedSource.components[0].role = 'source';
namedSource.components[0].lineage.name = 'source';
namedSource.outcomes[0].role = 'source';
const sourceRoleDisplay = api.preparePrismFeatureScene(namedSource, 'result');
let sourceRolePick = null;
for (let y = 20; y < 180 && !sourceRolePick; y += 10) for (let x = 20; x < 180 && !sourceRolePick; x += 10)
  sourceRolePick = api.pickPrismFeatureScene(sourceRoleDisplay, 200, 200, x, y);
assert.equal(sourceRolePick?.role, 'source'); checks++;
// A synthetic three-output inventory checks the safe catalog fallback. Its
// component meshes are exact retained copies; it is not a new native result.
const split = JSON.parse(readFileSync(resolve(root, fixture.packets[1].path))).display;
const overBudget = structuredClone(split);
const third = structuredClone(overBudget.components[0]);
third.role = 'third'; third.lineage.name = 'third';
overBudget.components.push(third);
overBudget.outcomes.push({ role: 'third', solidId: third.report.solidId, status: 'solid' });
const fallback = api.preparePrismFeatureScene(overBudget, 'result');
assert.equal(fallback.scene.geometries.length, 3);
assert.equal(api.prepareEngineScene(fallback.scene).draws.length, 3);
for (const [i, component] of overBudget.components.entries()) {
  assert.deepEqual(fallback.scene.geometries[i].indices, component.mesh.indices);
  assert.deepEqual(fallback.scene.materials[i].color, [.3, .58, .8]);
}
let fallbackPick = null;
for (let y = 20; y < 180 && !fallbackPick; y += 10) for (let x = 20; x < 180 && !fallbackPick; x += 10)
  fallbackPick = api.pickPrismFeatureScene(fallback, 200, 200, x, y);
assert.ok(fallbackPick && overBudget.components.some(component => component.role === fallbackPick.role
  && component.mesh.faces.some(face => face.faceId === fallbackPick.face.faceId))); checks++;
const receipt = { issue: 1990, status: 'PASS', checks, rayPairs, interiorBevelHits, sources: data,
  fallback: { components: 3, faceCount: 24, draws: fallback.scene.geometries.length, source: 'synthetic composition of retained meshes; no new native body' },
  scope: 'Genuine two-bevel retained native transports; original arrays, triangle partition, CPU rays and original selection lineage. No one-bevel retained packet, browser pixels, WebGPU or native reevaluation.' };
writeFileSync(resolve(output, 'verification.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt));

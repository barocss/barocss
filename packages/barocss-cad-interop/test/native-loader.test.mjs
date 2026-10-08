import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { Mesh } from 'three';
import { tessellateSurface } from '@barocss/cad';
import { BaroCadSourceError, parseBaroCadSource } from '../dist/native.js';
import { BaroCADLoader } from '../dist/three.js';

const source = readFileSync(new URL('../examples/two-surfaces.barocad', import.meta.url), 'utf8');
const options = { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001 };
const parsed = parseBaroCadSource(source, options);
assert.equal(parsed.source, source);
assert.deepEqual(parsed.model.objects.map(object => object.id), ['rational_panel', 'flat_panel', 'reference_edge']);
assert.deepEqual(parsed.unrenderedCurveIds, ['reference_edge']);
assert.equal(parsed.surfaces.length, 2);
assert.ok(Object.is(parsed.model.objects[0].controlPoints[0][0][0], -0));
assert.equal(parsed.model.objects[0].weights[0][1], 0.7071067811865476);
assert.deepEqual(parsed.model.objects[0].knotsU, [2, 2, 5, 5]);
assert.deepEqual(parsed.surfaces[0].report.domain, { u: [2, 5], v: [10, 20] });
assert.deepEqual(Array.from(parsed.surfaces[0].packet.parameters.slice(0, 2)), [2, 10]);

for (const surface of parsed.surfaces) {
  const native = parsed.model.objects.find(object => object.id === surface.surfaceId);
  const direct = tessellateSurface(native, { countU: 8, countV: 8, revision: 0 });
  assert.deepEqual(surface.packet, direct.packet);
  assert.deepEqual(surface.report, direct.report);
  assert.equal(surface.mesh.positions.length, surface.packet.positions.length);
  assert.equal(surface.mesh.indices.length, surface.packet.indices.length);
  for (let i = 0; i < surface.mesh.positions.length; i++) {
    assert.equal(surface.mesh.positions[i], Math.fround(surface.packet.positions[i] * 0.001));
    assert.equal(surface.mesh.normals[i], Math.fround(surface.packet.normals[i]));
  }
}

const loader = new BaroCADLoader(options);
const directThree = loader.parse(source);
assert.equal(directThree.source, source);
assert.deepEqual(directThree.model, parsed.model);
assert.equal(directThree.group.children.length, 2);
for (const [index, child] of directThree.group.children.entries()) {
  assert.ok(child instanceof Mesh);
  assert.equal(child.name, parsed.surfaces[index].surfaceId);
  assert.deepEqual(Array.from(child.geometry.getAttribute('position').array), Array.from(parsed.surfaces[index].mesh.positions));
  assert.deepEqual(Array.from(child.geometry.getAttribute('normal').array), Array.from(parsed.surfaces[index].mesh.normals));
  assert.deepEqual(Array.from(child.geometry.getAttribute('_CAD_UV').array), Array.from(parsed.surfaces[index].mesh.parameters));
  assert.deepEqual(Array.from(child.geometry.getIndex().array), Array.from(parsed.surfaces[index].mesh.indices));
}
assert.deepEqual(Array.from(directThree.group.children[0].geometry.getAttribute('_CAD_UV').array.slice(0, 2)), [2, 10]);

// Three.js FileLoader emits ProgressEvent; Node.js 22 does not provide it.
globalThis.ProgressEvent ??= class ProgressEvent {
  constructor(type, init) { this.type = type; Object.assign(this, init); }
};
const server = createServer((request, response) => {
  if (request.url !== '/two-surfaces.barocad') { response.writeHead(404).end(); return; }
  response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' }).end(source);
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
try {
  const url = `http://127.0.0.1:${server.address().port}/two-surfaces.barocad`;
  const loaded = await loader.loadAsync(url);
  assert.equal(loaded.source, source);
  assert.deepEqual(loaded.model, directThree.model);
  assert.deepEqual(loaded.group.children.map(child => child.name), ['rational_panel', 'flat_panel']);
  for (const child of loaded.group.children) { child.geometry.dispose(); child.material.dispose(); }
} finally {
  server.close();
  await once(server, 'close');
}

const malformed = source.replace('degree-u: 1;', 'degree-u: 9;');
assert.throws(() => loader.parse(malformed), error => error instanceof BaroCadSourceError && error.diagnostics[0].range.line > 0);
assert.throws(() => new BaroCADLoader({ ...options, sourceVersion: 1 }).parse(source), /sourceVersion 0/);
assert.throws(() => new BaroCADLoader({ ...options, countU: 18 }).parse(source), /2\.\.17/);
const curveOnly = '@model only_curve {version:0;length-unit:mm;@curve #line {type:nurbs;degree:1;knots:[0,0,1,1];control-points:[[0,0,0],[1,0,0]];weights:[1,1];}}';
assert.throws(() => loader.parse(curveOnly), /1\.\.4 native surfaces/);
assert.throws(() => new BaroCADLoader({ ...options, unitsPerMillimeter: 1e-50 }).parse(source), /Float32|collapses/);
assert.equal(directThree.group.children.length, 2);
for (const child of directThree.group.children) { child.geometry.dispose(); child.material.dispose(); }
console.log('BaroCAD source → native model → preview → Three parse and local URL load: OK');

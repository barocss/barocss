import test from 'node:test';
import assert from 'node:assert/strict';
import { Renderer } from '../src/viewport/renderer';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';

// Recording GL exercises the real upload methods. It does not execute a GPU shader or qualify images.
interface RecordedBuffer { data?: ArrayBufferView; target?: number }
interface UploadMethods {
  gl: unknown;
  corner: RecordedBuffer;
  bodyGeometry(body: BodyResult): unknown;
  uploadBody(body: BodyResult, geometry: unknown): unknown;
}
function recording() {
  const uploads: RecordedBuffer[] = [], attributes: number[][] = [];
  let bound: RecordedBuffer | null = null;
  const gl = {
    ARRAY_BUFFER: 34962, ELEMENT_ARRAY_BUFFER: 34963, STATIC_DRAW: 35044, DYNAMIC_DRAW: 35048, FLOAT: 5126,
    createBuffer() { const b = {}; uploads.push(b); return b; },
    bindBuffer(_target: number, b: RecordedBuffer) { bound = b; },
    bufferData(target: number, data: ArrayBufferView) { assert.ok(bound); bound.data = data; bound.target = target; },
    createVertexArray() { return {}; }, bindVertexArray() {}, enableVertexAttribArray() {}, vertexAttribDivisor() {},
    vertexAttribPointer(location: number, size: number, type: number, normalized: boolean, stride: number, offset: number) {
      assert.equal(normalized, false); attributes.push([location, size, type, stride, offset]);
    },
  };
  const renderer = Object.create(Renderer.prototype) as UploadMethods;
  renderer.gl = gl; renderer.corner = {};
  return { renderer, uploads, attributes, gl };
}
function body(positions: Float32Array | Float64Array, edgeLines: Float32Array | Float64Array) {
  return { mesh: { positions, edgeLines, normals: new Float32Array(positions.length), faceOfVertex: new Float32Array(positions.length / 3), indices: new Uint32Array([0, 1, 2]) } } as BodyResult;
}

test('real WebGL body uploads convert double positions and edge lines to four-byte floats without changing CPU arrays or indices', () => {
  const positions = new Float64Array([999000.001, -998000, 997000, 999000, -997999.999, 997000, 999000, -998000, 997000.001]);
  const lines = positions.slice(0, 6), before = positions.slice(), beforeLines = lines.slice();
  const b = body(positions, lines), f = recording(), geometry = f.renderer.bodyGeometry(b);
  f.renderer.uploadBody(b, geometry);
  const uploadedPositions = f.uploads[0].data, uploadedLines = f.uploads[4].data;
  assert.ok(uploadedPositions instanceof Float32Array); assert.ok(uploadedLines instanceof Float32Array);
  assert.equal(uploadedPositions.byteLength, positions.length * 4); assert.equal(uploadedLines.byteLength, lines.length * 4);
  assert.deepEqual(uploadedPositions, new Float32Array(positions)); assert.deepEqual(uploadedLines, new Float32Array(lines));
  assert.equal(f.uploads[3].data, b.mesh.indices); assert.equal(f.uploads[3].target, f.gl.ELEMENT_ARRAY_BUFFER);
  assert.deepEqual(positions, before); assert.deepEqual(lines, beforeLines);
  assert.ok(f.attributes.every(a => a[2] === f.gl.FLOAT));
  assert.ok(f.attributes.some(a => a[0] === 1 && a[1] === 3 && a[3] === 24 && a[4] === 0));
  assert.ok(f.attributes.some(a => a[0] === 2 && a[1] === 3 && a[3] === 24 && a[4] === 12));
});

test('existing float positions, edge lines, normals and integer indices retain their upload identity', () => {
  const p = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), l = p.slice(0, 6), b = body(p, l), f = recording();
  f.renderer.bodyGeometry(b);
  assert.equal(f.uploads[0].data, p); assert.equal(f.uploads[1].data, b.mesh.normals);
  assert.equal(f.uploads[2].data, b.mesh.faceOfVertex); assert.equal(f.uploads[3].data, b.mesh.indices);
  assert.equal(f.uploads[4].data, l);
});

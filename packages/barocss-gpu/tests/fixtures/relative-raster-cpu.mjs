import { Camera } from '../../dist/viewer/camera.js';
import { Geometry, Mesh, Viewer } from '../../dist/viewer/viewer.js';
import { prepareGeometry, segmentInstances, pointInstances } from '../../dist/viewer/geometry.js';
import { identity, transformPoint } from '../../dist/viewer/math.js';
import { FRAME_BYTES, OBJECT_BYTES, OBJECT_STRIDE, MAX_SHADOWS } from '../../dist/viewer/shaders.js';

export const C = [999000, -998000, 997000];
export const triangle = center => Float64Array.from([-.001, -.001, 0, .001, -.001, 0, 0, .001, 0], (x, i) => x + center[i % 3]);
export function fixture(center = C, topology = 'triangles') {
  const v = Object.create(Viewer.prototype), writes = [], buffers = [];
  const camera = new Camera({ position: [center[0], center[1], center[2] + .01], target: [...center], up: [0, 1, 0], projection: 'orthographic' });
  camera.near = -.05; camera.far = .05;
  const device = {
    queue: { writeBuffer(buffer, offset, data, at = 0, count) {
      const width = data.BYTES_PER_ELEMENT ?? 1, raw = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      const begin = at * width, length = count === undefined ? raw.length - begin : count * width;
      buffer.bytes.set(raw.subarray(begin, begin + length), offset); writes.push({ buffer, offset, bytes: raw.slice(begin, begin + length) });
    } },
    createBuffer(descriptor) { const b = { descriptor, bytes: new Uint8Array(descriptor.size), destroyed: false, destroy() { this.destroyed = true; } }; buffers.push(b); return b; },
  };
  Object.assign(v, { camera, canvas: { width: 800, height: 800, clientWidth: 800, clientHeight: 800 },
    grid: { visible: false }, lights: [{ kind: 'directional', direction: [0, 0, -1], intensity: 0, castShadow: true }], environment: {}, clip: null,
    meshes: [], geometries: new Set(), scene: null, frameBox: null, shadowMapSize: 1024, shadowCache: Array.from({ length: MAX_SHADOWS }, () => ({ length: 0 })),
    raster: null, rasterGeneration: 0, rasterRevision: 0, device, pixelRatio: 1, objectData: new Float32Array(OBJECT_STRIDE / 4), dirtySlots: new Int32Array(64),
    frameBuffer: { bytes: new Uint8Array(FRAME_BYTES) }, shadowFrameBuffers: Array.from({ length: MAX_SHADOWS }, () => ({ bytes: new Uint8Array(FRAME_BYTES) })),
    objectBuffer: { bytes: new Uint8Array(OBJECT_STRIDE) }, alive() {}, sceneMoved() { this.scene = null; },
    requestRender() { this.rasterRevision = (this.rasterRevision ?? 0) + 1; }, visOpaque: [], visTransparent: [], visEntries: [],
  });
  const P = triangle(center), data = prepareGeometry({ positions: P, normals: [0, 0, 1, 0, 0, 1, 0, 0, 1], topology, ...(topology === 'triangles' ? { faces: [17] } : topology === 'lines' ? { indices: [0, 1], edges: [29] } : {}) });
  const g = new Geometry(data, v), m = new Mesh(g, v, 1, {}); m.slot = 0;
  v.meshes.push(m); v.geometries.add(g);
  return { v, m, g, P, writes, buffers, center };
}
export function prepare(f, aspect = 1) { if (typeof f.v.prepareRaster === 'function') f.v.prepareRaster(aspect); }

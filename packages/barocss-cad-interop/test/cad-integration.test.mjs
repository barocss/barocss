import test from 'node:test';
import assert from 'node:assert/strict';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildOwnPlateCircularHole, tessellateOwnPlateCircularHole, tessellateSurface } from '../../barocss-cad/dist/index.js';
import { prepareKernelFacePreview, prepareMesh } from '../../barocss-gpu/dist/index.js';
import { encodeCadPreviewGlb, encodeOwnNativeFaceMeshGlb, prepareOwnNativeFaceMesh } from '../dist/index.js';

test('native CAD surface flows through the GPU packet and a Three.js GLB loader', async () => {
  const surface = {
    kind: 'surface', id: 'quarter_cylinder', degreeU: 2, degreeV: 1,
    knotsU: [0, 0, 0, 1, 1, 1], knotsV: [0, 0, 1, 1],
    controlPoints: [[[10, 0, 0], [10, 0, 30]], [[10, 10, 0], [10, 10, 30]], [[0, 10, 0], [0, 10, 30]]],
    weights: [[1, 1], [Math.SQRT1_2, Math.SQRT1_2], [1, 1]],
  };
  const { packet } = tessellateSurface(surface, { countU: 5, countV: 3, revision: 12 });
  const gpu = prepareMesh(packet, { mmToSceneUnit: 0.001, translate: [0, 0, 0],
    color: [1, 1, 1], background: [0, 0, 0] });
  const gltf = await new GLTFLoader().parseAsync(encodeCadPreviewGlb(packet), '');
  let loaded;
  gltf.scene.traverse(object => { if (object.isMesh) loaded = object; });
  assert.ok(loaded);
  assert.equal(loaded.geometry.getAttribute('position').count, packet.positions.length / 3);
  assert.equal(loaded.geometry.index.count, packet.indices.length);
  assert.deepEqual(Array.from(loaded.geometry.getAttribute('position').array), Array.from(gpu.positions));
  assert.equal(loaded.userData.barocss.surfaceId, surface.id);
  assert.equal(loaded.userData.barocss.revision, 12);
});

test('native CAD face mesh matches the GPU bridge and loads with face identity', async () => {
  const request = {
    bodyId: 'plate', featureId: 'cut',
    parameterIds: { width: 'width', height: 'height', thickness: 'thickness',
      centerX: 'cx', centerY: 'cy', radius: 'radius' },
    widthMM: 80, heightMM: 40, thicknessMM: 8, centreMM: [40, 20], radiusMM: 5,
  };
  const context = { documentId: 'document', bodyId: 'plate', documentRevision: 'r1',
    kernelResultRevision: 'r1', topologyRevision: 'r1', taskToken: 'task1' };
  const bundle = buildOwnPlateCircularHole(request).bundle;
  const native = tessellateOwnPlateCircularHole(bundle, { context, segmentsPerQuarter: 4 }).mesh;
  const own = prepareOwnNativeFaceMesh(native, 'plate_display', 3);
  const gpu = prepareKernelFacePreview(native, { displayId: 'plate_display', packetRevision: 3 });
  assert.deepEqual(own.packet.positions, gpu.packet.positions);
  assert.deepEqual(own.packet.normals, gpu.packet.normals);
  assert.deepEqual(own.packet.indices, gpu.packet.indices);
  assert.deepEqual(own.faces.map(face => face.nativeFaceId),
    gpu.faces.map(face => face.reference.nativeFaceId));
  const gltf = await new GLTFLoader().parseAsync(encodeOwnNativeFaceMeshGlb(native, 'plate_display', 3), '');
  let loaded;
  gltf.scene.traverse(object => { if (object.isMesh) loaded = object; });
  assert.ok(loaded);
  assert.equal(loaded.geometry.index.count, gpu.packet.indices.length);
  assert.equal(loaded.userData.barocss.faces.length, gpu.faces.length);
  assert.deepEqual(loaded.userData.barocss.context, context);
});

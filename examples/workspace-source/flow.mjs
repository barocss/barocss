import * as CAD from '@barocss/cad';
import * as Interop from '@barocss/cad-interop';
import * as Canvas from '@barocss/canvas2d';
import * as GPU from '@barocss/gpu';
import { compileGpu as compileGpuCompatibility } from '@barocss/gpu/source';
import * as Physics from '@barocss/physics';
import * as Viewer from '@barocss/viewer';
import { parseBaroCadSource } from '@barocss/cad-interop/native';
import { prepareBaroCadModelSetDisplay } from '@barocss/cad-interop/model-set';
import { createClothWorld, PhysicsError as ClothPhysicsError } from '@barocss/physics/cloth';

export { Viewer };
export const nativeSource = `@model source_model {
  version:0; length-unit:mm;
  @surface #quarter_cylinder {
    type:nurbs; degree-u:2; degree-v:1;
    knots-u:[0,0,0,1,1,1]; knots-v:[0,0,1,1];
    control-points:[[[10,0,0],[10,0,30]],[[10,10,0],[10,10,30]],[[0,10,0],[0,10,30]]];
    weights:[[1,1],[0.7071067811865476,0.7071067811865476],[1,1]];
  }
}`;
export const nativeOptions = { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 1 };
export const materialSource = '@shader #source_material { @fragment { color: #30C0A0; } }';
export function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

export function runCPUFlow() {
  const compiled = CAD.compileCadModel(nativeSource, { sourceVersion: 0 });
  requireValue(compiled.ok, 'CAD source compilation failed');
  const native = parseBaroCadSource(nativeSource, nativeOptions);
  const packet = native.surfaces[0].packet;
  requireValue(native.model.name === 'source_model' && packet.surfaceId === 'quarter_cylinder',
    'Native identity was not preserved');
  const display = prepareBaroCadModelSetDisplay({ format: 'barocad-model-set', version: 0,
    entries: [{ aliasId: 'source_asset', url: 'http://127.0.0.1:52935/model.barocad', result: native }],
    totalLoadedBytes: new TextEncoder().encode(nativeSource).length });
  requireValue(display.length === 1 && display[0].binding.surfaceId === packet.surfaceId,
    'Model-set display lost the native Surface binding');
  const mesh = Interop.prepareCadPreviewMesh(packet, 0.001);
  const gpuMesh = GPU.prepareMesh(packet, { mmToSceneUnit: 0.001,
    translate: [0, 0, 0], color: [1, 1, 1], background: [0, 0, 0] });
  requireValue(mesh.positions.length === gpuMesh.positions.length && gpuMesh.indices.length > 0,
    'Native preview mesh did not reach the GPU API');
  const material = GPU.compileMeshMaterial(materialSource);
  requireValue(material.ok, 'GPU material source compilation failed');
  requireValue(compileGpuCompatibility === GPU.compileGpu, 'GPU compatibility subpath changed compiler identity');

  const pose = (x = 0, y = 0) => ({ x, y, scaleX: 1, scaleY: 1, rotation: 0 });
  const tree = Canvas.createDisplayTree('SourceConsumer');
  const group = tree.createContainer({ id: 'Group', layer: 0, transform: pose(10, 20) });
  const rect = tree.createRect({ id: 'Rect', layer: 0, transform: pose(),
    width: 12, height: 8, fill: [0.2, 0.8, 0.5, 1] });
  tree.stage.addChild(group);
  group.addChild(rect);
  rect.setPosition(3, 4);
  const bounds = rect.getWorldBounds();
  requireValue(bounds.x === 13 && bounds.y === 24 && tree.snapshot().nodes.length === 1,
    'Canvas display tree did not apply the child transform');

  const world = createClothWorld({ format: 'barocss-cloth-scene', version: 1,
    revision: 'sourceConsumer1', basis: 'right-handed-xyz-metres',
    fixedStepSeconds: 1 / 120, profile: 'pinned-sheet-sphere-v1' });
  let cloth;
  try {
    cloth = world.step(1 / 120);
    requireValue(cloth.stepIndex === 1 && cloth.vertexCount === 289,
      'Physics cloth API did not perform one step');
  } finally { world.dispose(); }
  let disposedRefused = false;
  let rootErrorIdentity = false;
  try { world.getState(); } catch (error) {
    disposedRefused = error instanceof ClothPhysicsError && error.code === 'DISPOSED';
    rootErrorIdentity = error instanceof Physics.PhysicsError;
  }
  requireValue(disposedRefused, 'Disposed cloth accepted getState or lost its subpath error identity');
  requireValue(typeof Viewer.Viewer === 'function' && typeof Viewer.createViewer === 'function',
    'Viewer public class or factory is missing');
  const familyExports = Object.fromEntries(Object.entries({ CAD, Interop, Canvas, GPU, Physics, Viewer })
    .map(([name, namespace]) => [name, Object.keys(namespace).length]));
  return { ok: true, familyExports, nativeModel: native.model.name, nativeSurface: packet.surfaceId,
    vertices: mesh.positions.length / 3, triangles: gpuMesh.indices.length / 3,
    modelSetBinding: display[0].binding, materialCompiled: material.ok, gpuSourceCompatibility: true,
    canvasBounds: bounds, cloth: { stepIndex: cloth.stepIndex, vertexCount: cloth.vertexCount,
      disposedRefused, rootErrorIdentity }, viewerClass: typeof Viewer.Viewer };
}

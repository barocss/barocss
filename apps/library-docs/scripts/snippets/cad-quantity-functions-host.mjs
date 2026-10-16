import { compileCadModel, surfaceDomain, evaluateSurface, tessellateSurface } from '@barocss/cad';
import { createViewer } from '@barocss/gpu';

const sourceProfile = 'e532fc3037f9c1e13819b61d63de06164c50128f';
const baseOptions = { mmToSceneUnit: .12, translate: [-.7,-.45,0], color: [.22,.65,.85], background: [.063,.094,.125] };
const camera = { position: [2,-2,3], target: [0,0,0], up: [0,1,0], fovY: 45 };
function dataFor(source) {
  const compiled = compileCadModel(source, {sourceVersion:3});
  if (!compiled.ok) {
    const error = new Error('CAD quantity function source refused');
    error.name = 'CadCompileRefusal'; error.code = compiled.diagnostics[0]?.code;
    error.diagnostics = structuredClone(compiled.diagnostics);
    throw error;
  }
  const wall = compiled.model.objects.find(object => object.kind === 'surface' && object.id === 'wall');
  if (!wall) throw new Error('The example requires the Surface named wall');
  const domain = surfaceDomain(wall);
  const midpointUV = [(domain.u[0]+domain.u[1])/2,(domain.v[0]+domain.v[1])/2];
  const mesh = tessellateSurface(wall, {countU:17,countV:17,revision:0});
  return {source,compiled,wall,domain,midpointUV,midpointMM:evaluateSurface(wall,...midpointUV),...mesh};
}
function fit(packet) {
  const {min,max} = packet.bounds;
  const scale = 1.8 / Math.max(...max.map((value,index) => value-min[index]),1);
  return {...baseOptions,mmToSceneUnit:scale,translate:min.map((value,index) => -(value+max[index])/2*scale)};
}
// The sampled 17 × 17 U/V grid (17 rows and 17 columns) as line segments over the packet's vertices.
function grid(packet) {
  const indices = [], at = (u,v) => u*17+v;
  for (let u = 0; u < 17; u++) for (let v = 0; v < 16; v++) indices.push(at(u,v),at(u,v+1));
  for (let v = 0; v < 17; v++) for (let u = 0; u < 16; u++) indices.push(at(u,v),at(u+1,v));
  return {positions:packet.positions,indices,topology:'lines'};
}
// Column-major: millimetres scaled into scene units, then moved to the origin.
function placement(view) {
  const s = view.mmToSceneUnit, [x,y,z] = view.translate;
  return [s,0,0,0, 0,s,0,0, 0,0,s,0, x,y,z,1];
}
export async function createExample(canvas, key, source) {
  if (key !== 'cad-quantity-functions') throw new Error('Unknown CAD quantity function example');
  let accepted = dataFor(source), view = fit(accepted.packet);
  const viewer = await createViewer(canvas,{background:baseOptions.background,camera});
  let meshes = [], disposed = false, frameCount = 0;
  // The new wall and grid are added before the accepted ones are removed.
  function show(packet, candidateView) {
    const transform = placement(candidateView);
    const next = [
      viewer.add({positions:packet.positions,normals:packet.normals,indices:packet.indices},{name:'wall',transform,material:{color:candidateView.color,doubleSided:true,roughness:.6}}),
      viewer.add(grid(packet),{name:'sampling-grid',transform,pickable:false,material:{color:[.65,.85,.95],unlit:true}}),
    ];
    for (const mesh of meshes) mesh.remove();
    meshes = next; frameCount++;
  }
  try { show(accepted.packet,view); viewer.fit(); }
  catch (error) { viewer.dispose(); throw error; }
  function report() {
    const {compiled} = accepted, {ir} = compiled;
    return structuredClone({
      backend:'Public CAD Source3 → sampled wall → WebGPU viewer mesh',sourceProfile,
      sourceVersion:3,irSchemaVersion:ir.schemaVersion,nativeModelVersion:compiled.model.version,
      selectedSurfaceId:accepted.wall.id,
      parameters:ir.parameters.map(({id,quantityKind,value,unit})=>({id,quantityKind,value,unit})),
      midpointMM:accepted.midpointMM,domain:accepted.domain,midpointUV:accepted.midpointUV,
      boundsMM:accepted.packet.bounds,vertices:accepted.report.vertexCount,triangles:accepted.report.triangleCount,
      gridPaths:34,certified:accepted.report.certified,maxSampledDeviationMM:accepted.report.maxSampledDeviationMM,
      compilerWork:ir.work,callResults:ir.calls.map(({frameId,parentFrameId,functionId,depth,result,bindings})=>({
        frameId,parentFrameId,functionId,depth,result,
        arguments:bindings.map(({formalName,quantity,origin})=>({formalName,quantity,origin})),
      })),
      mmToSceneUnit:view.mmToSceneUnit,frameCount,available:!disposed,
      source:accepted.source,model:compiled.model,constructions:compiled.constructions,ir,
    });
  }
  return {
    report,
    update(text) {
      if (disposed) throw new Error('CAD quantity function example is disposed');
      const candidate = dataFor(text), candidateView = fit(candidate.packet);
      show(candidate.packet,candidateView);
      accepted = candidate; view = candidateView;
      return report();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      viewer.dispose();
    },
  };
}

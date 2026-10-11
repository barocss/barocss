import { compileCadModel, surfaceDomain, evaluateSurface, tessellateSurface } from '@barocss/cad';
import { mountMesh } from '@barocss/gpu';

const sourceProfile = '4f93558d77c980fcb4e04ea21d76589466839c47';
const baseOptions = {
  mmToSceneUnit: .12, translate: [-.7,-.45,0], color: [.22,.65,.85], background: [.063,.094,.125],
  camera: {eye:[2,-2,3],target:[0,0,0],up:[0,1,0],fovYDegrees:45,near:.01,far:100},
};
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
function grid(packet) {
  const point = (u,v) => packet.positions.slice((u*17+v)*3,(u*17+v)*3+3);
  return {version:0,packet,color:[.65,.85,.95],paths:[
    ...Array.from({length:17},(_,u)=>({id:'row_'+u,points:Array.from({length:17},(_,v)=>point(u,v))})),
    ...Array.from({length:17},(_,v)=>({id:'column_'+v,points:Array.from({length:17},(_,u)=>point(u,v))})),
  ]};
}
export function createExample(canvas, key, source) {
  if (key !== 'cad-quantity-functions') throw new Error('Unknown CAD quantity function example');
  let accepted = dataFor(source), view = fit(accepted.packet);
  const renderer = mountMesh(canvas,accepted.packet,view,grid(accepted.packet));
  let disposed = false, lost = false, frameCount = 1;
  const onLoss = () => { lost = true; };
  canvas.addEventListener('webglcontextlost',onLoss);
  function report() {
    const {compiled} = accepted, {ir} = compiled;
    return structuredClone({
      backend:'Public CAD Source3 → sampled wall → WebGL2 mesh',sourceProfile,
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
      mmToSceneUnit:view.mmToSceneUnit,frameCount,available:!disposed && !lost,
      source:accepted.source,model:compiled.model,constructions:compiled.constructions,ir,
    });
  }
  return {
    report,
    update(text) {
      if (disposed) throw new Error('CAD quantity function example is disposed');
      if (lost) throw new Error('WebGL2 context is lost; recreate the example');
      const candidate = dataFor(text), candidateView = fit(candidate.packet);
      const update = renderer.update(candidate.packet,candidateView,grid(candidate.packet));
      if (!update.ok) throw update.error;
      accepted = candidate; view = candidateView; frameCount++;
      return report();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      canvas.removeEventListener('webglcontextlost',onLoss);
      renderer.dispose();
    },
  };
}

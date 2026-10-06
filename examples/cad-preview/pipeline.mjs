import { validateProject } from './project.mjs';
import { preparePrimitive, dimensionUpdate } from './primitives.mjs';
import { parameterState as readParameterState, canonicalConstruction } from './parameters.mjs';
import { objectRows, inspectNativeObject, requireSurface } from './inspector.mjs';
// The host uses public built APIs. Canonical millimetre geometry is never rotated here.
export function prepareCandidate(source, settings, cad, gpu) {
  const { surfaceId, countU, countV, revision, options } = settings;
  if (typeof surfaceId !== 'string') throw new TypeError('Select a surface ID');
  const sourceVersion = settings.sourceVersion === undefined ? 0 : settings.sourceVersion;
  if (sourceVersion !== 0 && sourceVersion !== 1) throw new RangeError('Source version must be explicitly 0 or 1');
  const compiled = sourceVersion === 1 ? cad.compileConstruction(source) : undefined;
  const model = sourceVersion === 1 ? compiled.model : cad.parseModel(source);
  const surface = model.objects.find(object => object.id === surfaceId);
  if (!surface || surface.kind !== 'surface') throw new RangeError('Select a supported untrimmed surface');
  const { packet, report } = cad.tessellateSurface(surface, { countU, countV, revision });
  const validateCadPacket = cad.validatePreviewPacket;
  const validateGpuPacket = gpu.validatePreviewPacket;
  validateCadPacket(packet);
  validateGpuPacket(packet);
  const prepared = gpu.prepareMesh(packet, options);
  const iges = cad.exportIGES(model, [surfaceId]);
  const provenance = sourceVersion === 1 ? { sourceVersion: 1, constructions: compiled.constructions,
    selectedConstruction: compiled.constructions.find(feature => feature.outputId === surfaceId) } : {};
  if (sourceVersion === 1 && !provenance.selectedConstruction) throw new RangeError('Select a constructed output surface');
  return structuredClone({ source, model, packet, report, options: prepared.options, iges, revision, ...provenance });
}

export function createPreviewController(canvas, cad, gpu, notify = () => {}) {
  let renderer, accepted, inspectedId, primitive, revision = 0, viewRevision = 0, disposed = false, unavailable = false;
  let loadingProject=false;
  let status = 'No accepted preview';
  const announce = message => { status = message; if(!loadingProject)notify(message, accepted && structuredClone(accepted)); };
  const onLoss = () => { unavailable = true; announce('Preview unavailable: GPU context lost. Reload to create a new context.'); };
  canvas.addEventListener('webglcontextlost', onLoss);
  const controller = {
    apply(source, settings) {
      try {
        if (disposed || unavailable) throw new Error('Preview unavailable');
        if (revision === 2147483647 || viewRevision === 2147483647) throw new RangeError('Revision limit reached');
        const candidate = prepareCandidate(source, { ...settings, revision: revision + 1 }, cad, gpu);
        if (renderer) {
          const result = renderer.update(candidate.packet, candidate.options);
          if (!result.ok) throw result.error;
        } else renderer = gpu.mountMesh(canvas, candidate.packet, candidate.options);
        accepted = { ...candidate, viewRevision: ++viewRevision }; revision = candidate.revision;
        inspectedId = candidate.packet.surfaceId; primitive = undefined;
        announce(`Accepted model revision ${revision}, view revision ${viewRevision}`);
        return { ok: true };
      } catch (error) {
        announce(unavailable ? 'Preview unavailable: GPU context lost. Reload to create a new context.'
          : disposed ? 'Preview unavailable: disposed'
          : accepted ? `Rejected: ${error.message}. Last accepted revision ${revision} retained.`
          : `Rejected: ${error.message}. No accepted preview.`);
        return { ok: false, error: error.message };
      }
    },
    projectState() {
      if(!accepted)throw new Error('No accepted project');
      const owned=controller.primitiveState();
      return validateProject({format:'barocss-cad-project',version:1,sourceVersion:accepted.sourceVersion??0,
        source:accepted.source,surfaceId:accepted.packet.surfaceId,grid:structuredClone(accepted.report.grid),
        options:structuredClone(accepted.options),primitive:owned?{kind:owned.kind,size:owned.size,height:owned.height}:null},gpu);
    },
    loadProject(record,editorSource) {
      try{
        if(disposed||unavailable||!accepted||!renderer)throw new Error('Preview unavailable');
        if(typeof editorSource!=='string'||editorSource!==accepted.source)throw new Error('Apply or discard pending source first');
        const file=validateProject(record,gpu);
        // apply prepares all native geometry/options before its one renderer transaction.
        let result;loadingProject=true;
        try{result=controller.apply(file.source,{sourceVersion:file.sourceVersion,surfaceId:file.surfaceId,...file.grid,options:file.options});}finally{loadingProject=false;}
        if(result.ok){primitive=file.primitive?{...file.primitive,source:file.source}:undefined;announce(`Opened local project; model revision ${revision}`);}
        return result;
      }catch(error){return{ok:false,error:error.message};}
    },
    primitiveState() {
      if(!primitive||!accepted||accepted.sourceVersion!==1||accepted.source!==primitive.source||accepted.packet.surfaceId!=='surface')return undefined;
      return structuredClone(primitive);
    },
    createPrimitive(request,editorSource) {
      try {
        if(disposed||unavailable||!accepted||!renderer)throw new Error('Preview unavailable');
        if(typeof editorSource!=='string'||editorSource!==accepted.source)throw new Error('Apply or discard pending source first');
        const generated=preparePrimitive(request);
        const result=controller.apply(generated.source,{sourceVersion:1,surfaceId:generated.surfaceId,countU:generated.countU,countV:generated.countV,options:generated.options});
        if(result.ok){primitive={kind:generated.kind,size:generated.size,height:generated.height,source:generated.source};announce(`Created open ${generated.kind}; model revision ${revision}`);}
        return result;
      }catch(error){return{ok:false,error:error.message};}
    },
    updateDimensions(request,editorSource) {
      try {
        if(disposed||unavailable||!accepted||!renderer)throw new Error('Preview unavailable');
        const owned=controller.primitiveState();if(!owned)throw new Error('Update requires the matching accepted tool-created primitive');
        if(typeof editorSource!=='string'||editorSource!==accepted.source)throw new Error('Apply or discard pending source first');
        const dimensions=dimensionUpdate(request),generated=preparePrimitive({kind:owned.kind,...dimensions});
        const options=structuredClone(accepted.options);options.translate=generated.options.translate;
        const result=controller.apply(generated.source,{sourceVersion:1,surfaceId:generated.surfaceId,...accepted.report.grid,options});
        if(result.ok){primitive={kind:owned.kind,...dimensions,source:generated.source};announce(`Updated open ${owned.kind}; model revision ${revision}`);}
        return result;
      }catch(error){return{ok:false,error:error.message};}
    },
    parameterState() { return readParameterState(accepted); },
    applyParameters(request, editorSource) {
      try {
        if (disposed || unavailable || !accepted) throw new Error('Preview unavailable');
        if (typeof editorSource !== 'string' || editorSource !== accepted.source)
          throw new Error('Apply or discard pending source before editing parameters');
        const source = canonicalConstruction(accepted, request);
        return controller.apply(source, { sourceVersion: 1, surfaceId: accepted.packet.surfaceId,
          ...accepted.report.grid, options: structuredClone(accepted.options) });
      } catch (error) { return { ok: false, error: error.message }; }
    },
    objects() { return structuredClone(objectRows(accepted)); },
    inspection() { return accepted && inspectedId ? inspectNativeObject(accepted, inspectedId) : undefined; },
    get inspectedId() { return inspectedId; },
    inspectObject(id) {
      try {
        if (disposed || unavailable || !accepted) throw new Error('Preview unavailable');
        const description = inspectNativeObject(accepted, id);
        inspectedId = description.id;
        announce(`Inspecting ${inspectedId}; displayed surface ${accepted.packet.surfaceId}`);
        return { ok: true };
      } catch (error) { return { ok: false, error: error.message }; }
    },
    showSurface(id) {
      try {
        if (disposed || unavailable || !accepted) throw new Error('Preview unavailable');
        const surfaceId = requireSurface(accepted, id);
        return controller.apply(accepted.source, { surfaceId, sourceVersion: accepted.sourceVersion ?? 0,
          ...accepted.report.grid, options: structuredClone(accepted.options) });
      } catch (error) { return { ok: false, error: error.message }; }
    },
    setCamera(camera) {
      try {
        if (disposed || unavailable || !renderer || !accepted) throw new Error('Preview unavailable');
        if (viewRevision === 2147483647) throw new RangeError('View revision limit reached');
        const options = structuredClone(accepted.options);
        if (camera === undefined) delete options.camera;
        else options.camera = camera;
        const owned = gpu.validateMeshOptions(options);
        const result = renderer.update(accepted.packet, owned);
        if (!result.ok) throw result.error;
        accepted = { ...accepted, options: structuredClone(owned), viewRevision: ++viewRevision };
        announce(`Accepted model revision ${revision}, view revision ${viewRevision}`);
        return { ok: true };
      } catch (error) {
        announce(unavailable ? 'Preview unavailable: GPU context lost. Reload to create a new context.'
          : disposed ? 'Preview unavailable: disposed'
          : accepted ? `Rejected view: ${error.message}. Last accepted view revision ${viewRevision} retained.`
          : `Rejected view: ${error.message}. No accepted preview.`);
        return { ok: false, error: error.message };
      }
    },
    snapshot() { return accepted && structuredClone(accepted); },
    readPixels() { if (disposed || unavailable || !renderer) throw new Error('Preview unavailable'); return renderer.readPixels(); },
    shaders() { if (!renderer) throw new Error('No renderer'); return renderer.shaders; },
    resize(width, height) {
      if (disposed || unavailable || !renderer) throw new Error('Preview unavailable');
      renderer.resize(width, height);
    },
    dispose() {
      if (disposed) return;
      disposed = true; canvas.removeEventListener('webglcontextlost', onLoss);
      renderer?.dispose(); announce('Preview unavailable: disposed');
    },
    get renderer() { return renderer; },
    get status() { return status; },
    get available() { return Boolean(renderer) && !disposed && !unavailable; },
  };
  return controller;
}

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
  let renderer, accepted, inspectedId, revision = 0, viewRevision = 0, disposed = false, unavailable = false;
  let status = 'No accepted preview';
  const announce = message => { status = message; notify(message, accepted && structuredClone(accepted)); };
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
        inspectedId = candidate.packet.surfaceId;
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

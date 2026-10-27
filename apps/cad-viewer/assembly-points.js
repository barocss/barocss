const sameRef = (a, b) => a?.kind === b?.kind && a?.modelId === b?.modelId
  && (a?.surfaceId ?? a?.curveId) === (b?.surfaceId ?? b?.curveId);

// Re-query the accepted parameters, not the editable form or displayed coordinates.
export function prepareAssemblyPoint(viewer, inspection) {
  const state = viewer.getState();
  const binding = state.assemblyInstances.find(value => value.instanceId === inspection?.instanceId
    && sameRef(value.ref, state.selectedGeometry));
  if (!binding || !state.visibleGeometry.some(ref => sameRef(ref, binding.ref))
    || !inspection.result || inspection.error) throw new Error('Choose a valid point on a visible instance.');
  const result = viewer.queryAssemblyInstancePoint({ assemblyId: binding.assemblyId,
    assemblyRevision: binding.assemblyRevision, instanceId: binding.instanceId,
    reference: binding.reference, query: inspection.query });
  return { instanceId: binding.instanceId, assemblyId: binding.assemblyId,
    assemblyRevision: binding.assemblyRevision, reference: structuredClone(binding.reference),
    worldMatrix: [...binding.worldMatrix], query: structuredClone(result.query),
    originalLocalPointMM: [...result.originalLocalPointMM], assemblyPointMM: [...result.assemblyPointMM] };
}

export function retainVisibleAssemblyPoints(points, state) {
  return points.map(point => {
    if (!point) return null;
    const binding = state.assemblyInstances.find(value => value.instanceId === point.instanceId);
    return binding && binding.assemblyId === point.assemblyId && binding.assemblyRevision === point.assemblyRevision
      && JSON.stringify(binding.reference) === JSON.stringify(point.reference)
      && binding.worldMatrix.length === point.worldMatrix.length
      && binding.worldMatrix.every((value, index) => Object.is(value, point.worldMatrix[index]))
      && state.visibleGeometry.some(ref => sameRef(ref, binding.ref)) ? point : null;
  });
}

export function measureAssemblyPointPair(viewer, points) {
  const retained = retainVisibleAssemblyPoints(points, viewer.getState());
  if (retained.length !== 2 || retained.some(point => !point))
    throw new Error('Choose two visible assembly points.');
  const query = point => ({ assemblyId: point.assemblyId, assemblyRevision: point.assemblyRevision,
    instanceId: point.instanceId, reference: structuredClone(point.reference), query: structuredClone(point.query) });
  const result = viewer.measureAssemblyPoints(query(retained[0]), query(retained[1]));
  if (!Number.isFinite(result.distanceMM)) throw new Error('Assembly distance is not finite.');
  return result.distanceMM;
}

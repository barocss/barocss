// Bounded metadata of accepted native objects. No CAD query or source execution.
function nativeObject(accepted, id) {
  if (typeof id !== 'string') throw new TypeError('Object ID must be a native string identifier');
  if (!accepted || accepted.model.objects.length > 16) throw new RangeError('No bounded accepted native model');
  const object = accepted.model.objects.find(value => value.id === id);
  if (!object) throw new RangeError('Unknown accepted object ID');
  return object;
}
export function objectRows(accepted) {
  if (!accepted) return [];
  if (accepted.model.objects.length > 16) throw new RangeError('Native object limit exceeded');
  return accepted.model.objects.map(object => ({ id: object.id, kind: object.kind,
    supportedSurface: object.kind === 'surface' }));
}
export function inspectNativeObject(accepted, id) {
  const object = nativeObject(accepted, id), surface = object.kind === 'surface';
  const points = surface ? object.controlPoints.flat() : object.controlPoints;
  const weights = surface ? object.weights.flat() : object.weights;
  const uDegree = surface ? object.degreeU : object.degree;
  const uKnots = surface ? object.knotsU : object.knots;
  const polesU = object.controlPoints.length;
  const polesV = surface ? object.controlPoints[0].length : undefined;
  const feature = accepted.constructions?.find(value => value.outputId === id);
  return structuredClone({ id, kind: object.kind, nativeSource: accepted.sourceVersion === 1 ? 'construction-v1' : 'native-v0',
    degrees: surface ? { u: uDegree, v: object.degreeV } : { curve: uDegree },
    originalDomains: surface ? { u: [uKnots[uDegree], uKnots[polesU]], v: [object.knotsV[object.degreeV], object.knotsV[polesV]] }
      : { curve: [uKnots[uDegree], uKnots[polesU]] },
    knotCounts: surface ? { u: uKnots.length, v: object.knotsV.length } : { curve: uKnots.length },
    poleCounts: surface ? { u: polesU, v: polesV, total: points.length } : { total: polesU },
    weightRange: [Math.min(...weights), Math.max(...weights)],
    controlPointBoundsMM: { min: [0,1,2].map(axis => Math.min(...points.map(point => point[axis]))),
      max: [0,1,2].map(axis => Math.max(...points.map(point => point[axis]))) },
    displayedSurfaceId: accepted.packet.surfaceId,
    displayedSampledMeshBoundsMM: accepted.packet.bounds,
    ...(feature ? { construction: feature } : {}),
  });
}
export function requireSurface(accepted, id) {
  const object = nativeObject(accepted, id);
  if (object.kind !== 'surface') throw new RangeError('Show surface requires a supported native surface');
  return object.id;
}

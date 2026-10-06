const color = [.06, .085, .11];
export function bodyEdges(evaluation, packet, cad) {
  const report = cad.validateAxisBoxShell(evaluation.shell);
  if (!report.incidenceValid || evaluation.shell.edges.length !== 12) throw Error('Original box edge incidence is missing.');
  const paths = [], lineage = [];
  for (const edge of evaluation.shell.edges) {
    if (edge.uses.length !== 2 || new Set(edge.uses.map(use => use.sense)).size !== 2) throw Error('Box edge must have opposite native uses.');
    const owner = evaluation.shell.faces.find(face => face.id === edge.canonical.faceId);
    const localEdge = owner?.bundle.topology.edges.find(local => local.id === edge.canonical.edgeId);
    const curve = owner?.bundle.geometry.objects.find(object => object.kind === 'curve' && object.id === edge.canonical.curveId);
    if (!curve || localEdge?.curveId !== curve.id) throw Error('Qualified native edge curve is missing.');
    const samples = cad.sampleCurve(curve, 2);
    paths.push({ id: edge.id, points: samples.map(sample => [...sample.point]) });
    lineage.push({ edgeId: edge.id, canonical: structuredClone(edge.canonical), uses: structuredClone(edge.uses),
      surfaceId: owner.bundle.topology.face.surfaceId, parameterDomain: cad.curveDomain(curve), sampleParameters: samples.map(sample => sample.parameter) });
  }
  return { overlay: { version: 0, packet: structuredClone(packet), paths, color: [...color] },
    lineage: { sourceVersion: 2, source: evaluation.source, bodyId: evaluation.construction.outputBodyId, paths: lineage } };
}
export function surfaceEdges(accepted, cad) {
  const surface = accepted.model.objects.find(object => object.kind === 'surface' && object.id === accepted.packet.surfaceId);
  if (!surface) throw Error('Accepted native surface is missing.');
  const paths = [], lineage = [];
  for (const boundary of ['v-min', 'u-max', 'v-max', 'u-min']) {
    const id = 'natural_' + boundary.replace('-', '_');
    const curve = cad.extractSurfaceBoundary(surface, { boundary, id });
    const variesU = boundary === 'v-min' || boundary === 'v-max';
    const count = Math.min(64, variesU ? accepted.report.grid.countU : accepted.report.grid.countV);
    const samples = cad.sampleCurve(curve, count);
    paths.push({ id, points: samples.map(sample => [...sample.point]) });
    lineage.push({ boundary, curveId: id, surfaceId: surface.id, parameterDomain: cad.curveDomain(curve), sampleParameters: samples.map(sample => sample.parameter) });
  }
  return { overlay: { version: 0, packet: structuredClone(accepted.packet), paths, color: [...color] },
    lineage: { sourceVersion: accepted.sourceVersion, source: accepted.source, surfaceId: surface.id, paths: lineage,
      scope: 'Sampled natural parameter boundaries, at most64 points per path; not arbitrary trim topology.' } };
}

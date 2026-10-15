// Adapters from the existing modeling body families to the shared B-rep (brep-core.ts).
// Each one copies topology and geometry as stored; nothing is re-derived or repaired. Face sense
// follows the family's own outward flag ('forward' = ∂S/∂u × ∂S/∂v points out of the solid);
// extruded profiles, which carry none, derive it from the loop's vector area.
import { buildBrep, lineCurve, loopVectorArea, surfaceNormalAtCentre, type Brep, type BrepBuildInput, type BrepFaceInput, type BrepLoopInput } from './brep-core.js';
import { curveDomain } from './math.js';
import type { ConvexPlanarSolidResult } from './convex-planar-solid.js';
import type { ExtrudedProfileSolidResult } from './extruded-profile-solid.js';
import type { StoredPlateHoleSolidResult } from './stored-plate-hole-solid.js';
import type { StoredCirclePrismSolidResult } from './stored-circle-prism-solid.js';
import type { AxisBoxSolidBooleanResult } from './axis-box-boolean.js';
import type { OrthogonalSolidBooleanResult } from './orthogonal-solid-boolean.js';
import type { Curve, Point, Surface } from './types.js';

type Sense = 'forward' | 'reversed';
const sense = (s: string): Sense => s === 'forward' ? 'forward' : 'reversed';
const same = (a: Point, b: Point) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** Sense from a loop's sampled vector area (works for faces sweeping less than a full turn). */
const senseFromLoop = (surface: Surface, uses: readonly { curve: Curve; sense: Sense }[]): Sense => dot(loopVectorArea(uses), surfaceNormalAtCentre(surface)) >= 0 ? 'forward' : 'reversed';
/** A pcurve is kept only when it shares the edge curve's domain (the checker then verifies it lies on the edge). */
const pcurveFor = (edge: Curve, pcurve: Curve | undefined | null): Curve | null => {
  if (!pcurve) return null; const [a, b] = curveDomain(edge), [c, d] = curveDomain(pcurve); return a === c && b === d ? pcurve : null;
};

export function brepFromExtrudedProfile(solid: ExtrudedProfileSolidResult): Brep {
  const edges = new Map(solid.edges.map(e => [e.id, e]));
  const faces: BrepFaceInput[] = solid.faces.map(f => {
    const uses = f.loop.map(u => ({ edge: u.edgeId, sense: sense(u.sense) }));
    return { id: f.id, surface: f.surface, sense: senseFromLoop(f.surface, uses.map(u => ({ curve: edges.get(u.edge)!.curve, sense: u.sense }))), loops: [{ kind: 'outer', uses }] };
  });
  return buildBrep({ source: { family: 'extruded-profile', id: solid.id },
    vertices: solid.vertices.map(v => ({ id: v.id, point: v.pointMM })), edges: solid.edges.map(e => ({ id: e.id, curve: e.curve, vertices: e.vertexIds })),
    bodies: [{ id: solid.id, kind: 'solid', shells: [{ id: 'shell', faces, closed: true }] }] });
}

export function brepFromConvexPlanar(solid: ConvexPlanarSolidResult): Brep {
  const points = new Map(solid.graph.vertices.map(v => [v.id, v.pointMM as Point]));
  // Each face keeps its own copy of every line; the B-rep edge is one line between the solid vertices.
  const edgeOfUse = new Map<string, string>();
  for (const e of solid.graph.edges) for (const u of e.uses) edgeOfUse.set(u.sourceId + '|' + u.use.id, e.id);
  const solidEdges = new Map(solid.graph.edges.map(e => [e.id, e]));
  const faces: BrepFaceInput[] = solid.request.assets.map(asset => {
    const face = asset.face, localCurves = new Map(face.loop.edges.map(c => [c.id, c]));
    const uses = face.topology.loop.uses.map(u => {
      const edgeId = edgeOfUse.get(asset.sourceId + '|' + u.id)!, edge = solidEdges.get(edgeId)!, local = localCurves.get(u.curveId)!;
      const start = u.sense === 'forward' ? local.controlPoints[0] : local.controlPoints[local.controlPoints.length - 1];
      return { edge: edgeId, sense: (same(start, points.get(edge.vertexIds[0])!) ? 'forward' : 'reversed') as Sense };
    });
    return { id: asset.sourceId, surface: face.plane, sense: sense(face.topology.face.orientation), loops: [{ kind: 'outer', uses }] };
  });
  return buildBrep({ source: { family: 'convex-planar', id: solid.report.solidId },
    vertices: solid.graph.vertices.map(v => ({ id: v.id, point: v.pointMM as Point })),
    edges: solid.graph.edges.map(e => ({ id: e.id, curve: lineCurve(e.id, points.get(e.vertexIds[0])!, points.get(e.vertexIds[1])!), vertices: [e.vertexIds[0], e.vertexIds[1]] as const })),
    bodies: [{ id: solid.report.solidId, kind: 'solid', shells: [{ id: 'shell', faces, closed: true }] }] });
}

export function brepFromPlateHole(result: StoredPlateHoleSolidResult): Brep {
  const t = result.bundle.topology, curves = new Map(t.edges.map(e => [e.id, e.curve as Curve])), loops = new Map(t.loops.map(l => [l.id, l]));
  const loop = (id: string, kind: 'outer' | 'inner'): BrepLoopInput => ({ kind, uses: loops.get(id)!.uses.map(u => ({ edge: u.edgeId, sense: sense(u.sense), pcurve: pcurveFor(curves.get(u.edgeId)!, u.pcurve.curve as Curve) })) });
  const faces: BrepFaceInput[] = result.bundle.faces.map(f => ({ id: f.id, surface: f.surface as Surface, sense: sense(f.orientation),
    loops: [loop(f.outerLoopId, 'outer'), ...f.innerLoopIds.map(id => loop(id, 'inner'))] }));
  return buildBrep({ source: { family: 'stored-rational-plate-hole', id: result.bundle.request.bodyId },
    vertices: t.vertices.map(v => ({ id: v.id, point: v.point as Point })), edges: t.edges.map(e => ({ id: e.id, curve: e.curve as Curve, vertices: [e.vertexIds[0], e.vertexIds[1]] as const })),
    bodies: [{ id: result.bundle.request.bodyId, kind: 'solid', shells: [{ id: 'shell', faces, closed: true }] }] });
}

export function brepFromCirclePrism(result: StoredCirclePrismSolidResult): Brep {
  const bundle = result.parent.bundle, t = bundle.topology, objects = new Map(bundle.geometry.objects.map(o => [o.id, o]));
  const curves = new Map(t.edges.map(e => [e.id, objects.get(e.curveId) as Curve]));
  const faces: BrepFaceInput[] = t.faces.map(f => {
    const l = t.loops.find(x => x.id === f.outerLoopId)!;
    return { id: f.id, surface: objects.get(f.surfaceId) as Surface, sense: sense(f.orientation),
      loops: [{ kind: 'outer', uses: l.uses.map(u => ({ edge: u.edgeId, sense: sense(u.sense), pcurve: pcurveFor(curves.get(u.edgeId)!, u.pcurve.curve as Curve) })) }] };
  });
  return buildBrep({ source: { family: 'stored-rational-circle-prism', id: result.parent.report.shellId ?? 'circle-prism' },
    vertices: t.vertices.map(v => ({ id: v.id, point: v.point as Point })), edges: t.edges.map(e => ({ id: e.id, curve: curves.get(e.id)!, vertices: [e.vertexIds[0], e.vertexIds[1]] as const })),
    bodies: [{ id: 'circle-prism', kind: 'solid', shells: [{ id: 'shell', faces, closed: true }] }] });
}

/** Orthogonal cell results may hold several bodies, each with an outer shell and cavities. */
export function brepFromOrthogonalCells(result: AxisBoxSolidBooleanResult | OrthogonalSolidBooleanResult): Brep {
  const points = new Map(result.vertices.map(v => [v.id, v.pointMM as Point]));
  const globalOfLocal = new Map<string, { edge: string; sense: Sense }>();
  for (const e of result.edges) for (const u of e.uses) globalOfLocal.set(u.sourceId + '|' + u.localEdgeId, { edge: e.id, sense: sense(u.sense) });
  const panels = new Map(result.panels.map(p => [p.id, p]));
  const face = (panelId: string): BrepFaceInput => {
    const p = panels.get(panelId)!, surface = p.bundle.geometry.objects.find(o => o.kind === 'surface') as Surface;
    return { id: p.id, surface, sense: 'forward', loops: [{ kind: 'outer', uses: p.bundle.topology.loop.uses.map(u => globalOfLocal.get(p.sourceId + '|' + u.edgeId)!) }] };
  };
  const shells = new Map(result.shells.map(s => [s.id, s]));
  return buildBrep({ source: { family: 'orthogonal-cell', id: result.report.schema },
    vertices: result.vertices.map(v => ({ id: v.id, point: v.pointMM as Point })),
    edges: result.edges.map(e => ({ id: e.id, curve: lineCurve(e.id, points.get(e.vertexIds[0])!, points.get(e.vertexIds[1])!), vertices: [e.vertexIds[0], e.vertexIds[1]] as const })),
    bodies: result.bodies.map(b => ({ id: b.id, kind: 'solid' as const, shells: b.shellIds.map(id => ({ id, faces: shells.get(id)!.panelIds.map(face), closed: true })) })) });
}

export type BrepInputBody =
  | { readonly family: 'convex-planar'; readonly native: ConvexPlanarSolidResult }
  | { readonly family: 'stored-rational-plate-hole'; readonly native: StoredPlateHoleSolidResult }
  | { readonly family: 'orthogonal-cell'; readonly native: AxisBoxSolidBooleanResult | OrthogonalSolidBooleanResult }
  | { readonly family: 'stored-rational-circle-prism'; readonly native: StoredCirclePrismSolidResult }
  | { readonly family: 'extruded-profile'; readonly native: ExtrudedProfileSolidResult };

/** Converts any modeling body (a CadBody) to the shared B-rep. */
export function brepFromBody(body: BrepInputBody): Brep {
  switch (body.family) {
    case 'convex-planar': return brepFromConvexPlanar(body.native);
    case 'stored-rational-plate-hole': return brepFromPlateHole(body.native);
    case 'orthogonal-cell': return brepFromOrthogonalCells(body.native);
    case 'stored-rational-circle-prism': return brepFromCirclePrism(body.native);
    case 'extruded-profile': return brepFromExtrudedProfile(body.native);
  }
}
export type { BrepBuildInput };

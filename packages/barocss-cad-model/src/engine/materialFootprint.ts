import { booleanPolygons, CadNumericPolicy, checkBrep, coedgeVertices, prismaticFromProfile, type Brep, type Point, type PolygonWithHoles } from '@barocss/cad';
import type { SketchNode, StudioDoc } from './doc';
import { partBreps } from './evaluate';
import { refusal } from './refusal';

type XY = [number, number];
const axes = [0, 1, 2] as const;
const limit = { faces: 48, coedges: 192, sketchEdges: 128 };
const unsupported = (reason: string) => refusal('VALUE', `Project to sketch: ${reason}`);
const axisOfLine = (a: Point, b: Point) => axes.filter(axis => a[axis] !== b[axis]);

/** A finite orthogonal solid has material on an XY line exactly where it has a horizontal boundary. */
function horizontalTrims(brep: Brep): PolygonWithHoles[] {
  if (brep.bodies.length !== 1 || brep.bodies[0].kind !== 'solid' || brep.shells.length !== 1 || !brep.shells[0].closed) {
    throw unsupported('select one closed native solid.');
  }
  if (brep.faces.length > limit.faces || [brep.coedges, brep.edges, brep.vertices, brep.loops].some(items => items.length > limit.coedges)) {
    throw unsupported('the native boundary exceeds the projection limit.');
  }
  const vertices = new Map(brep.vertices.map(vertex => [vertex.id, vertex.point]));
  const edges = new Map(brep.edges.map(edge => [edge.id, edge]));
  const loops = new Map(brep.loops.map(loop => [loop.id, loop]));
  const coedges = new Map(brep.coedges.map(use => [use.id, use]));
  const coordinatesFit = (point: Point) => point.every(value => Number.isFinite(value) && Math.abs(value) <= CadNumericPolicy.coordinateAbs);
  for (const point of vertices.values()) if (!coordinatesFit(point)) throw unsupported('a native point is outside the coordinate range.');
  for (const edge of edges.values()) {
    const [a, b] = edge.vertices.map(vertex => vertices.get(vertex));
    const curve = edge.curve;
    if (!a || !b || curve.degree !== 1 || curve.controlPoints.length !== 2 || curve.weights.length !== 2
      || !(curve.weights[0] > 0) || curve.weights[0] !== curve.weights[1]
      || !axes.every(axis => curve.controlPoints[0][axis] === a[axis] && curve.controlPoints[1][axis] === b[axis])
      || axisOfLine(a, b).length !== 1) throw unsupported('the solid needs straight axis-aligned native edges.');
  }
  const trims: PolygonWithHoles[] = [];
  for (const face of brep.faces) {
    const surface = face.surface;
    if (surface.kind !== 'surface' || surface.degreeU !== 1 || surface.degreeV !== 1
      || surface.controlPoints.length !== 2 || surface.controlPoints.some(row => row.length !== 2)) {
      throw unsupported('the solid needs native axis-aligned planes.');
    }
    const poles = surface.controlPoints.flat();
    const fixed = axes.filter(axis => poles.every(point => point[axis] === poles[0][axis]));
    if (!poles.every(coordinatesFit) || fixed.length !== 1) throw unsupported('the solid needs native axis-aligned planes.');
    const axis = fixed[0], level = poles[0][axis];
    const outer: XY[][] = [], holes: XY[][] = [];
    for (const id of face.loops) {
      const loop = loops.get(id);
      if (!loop || loop.face !== face.id || loop.coedges.length < 4) throw unsupported('a native face has an incomplete trim.');
      const ring: XY[] = [];
      for (const useId of loop.coedges) {
        const use = coedges.get(useId);
        if (!use || use.loop !== id || !edges.has(use.edge)) throw unsupported('a native face has an incomplete trim.');
        const point = vertices.get(coedgeVertices(brep, use, edges)[0]);
        if (!point || point[axis] !== level) throw unsupported('a native trim is outside its exact plane.');
        if (axis === 2) ring.push([point[0], point[1]]);
      }
      if (axis === 2) (loop.kind === 'outer' ? outer : holes).push(ring);
    }
    if (axis === 2) {
      if (outer.length !== 1) throw unsupported('a horizontal face needs one outer trim.');
      trims.push({ outer: outer[0], holes });
    }
  }
  if (!checkBrep(brep, { strict: true }).valid) throw unsupported('the native solid has an invalid boundary.');
  return trims;
}

function unionTrims(trims: readonly PolygonWithHoles[]): PolygonWithHoles[] {
  // Strictly increasing ranks preserve every intersection of axis-aligned edges.
  // The arrangement returns source coordinates through these ranks without rounding the sketch.
  const points = trims.flatMap(trim => [trim.outer, ...trim.holes]).flat();
  const [xs, ys] = ([0, 1] as const).map(axis => [...new Set(points.map(point => point[axis]))].sort((a, b) => a - b));
  const xr = new Map(xs.map((value, index) => [value, index]));
  const yr = new Map(ys.map((value, index) => [value, index]));
  const toRank = (ring: readonly XY[]): XY[] => ring.map(([x, y]) => [xr.get(x)!, yr.get(y)!]);
  const toPoint = (ring: readonly XY[]): XY[] => ring.map(([x, y]) => {
    if (!Number.isInteger(x) || !Number.isInteger(y) || xs[x] === undefined || ys[y] === undefined) {
      throw unsupported('a projected corner does not match a native axis coordinate.');
    }
    return [xs[x], ys[y]];
  });
  const union = booleanPolygons(trims.map(trim => ({ outer: toRank(trim.outer), holes: trim.holes.map(toRank) })), [], 'union');
  return union.map(region => ({ outer: toPoint(region.outer), holes: region.holes.map(toPoint) }));
}

function checkSketchRings(rings: readonly (readonly XY[])[]) {
  const segments = rings.flatMap((ring, loop) => ring.map((a, index) => ({ a, b: ring[(index + 1) % ring.length], loop, index, size: ring.length })));
  if (rings.some(ring => ring.length < 4) || segments.length > limit.sketchEdges) throw unsupported('the projection exceeds the sketch boundary limit.');
  for (let i = 0; i < segments.length; i++) {
    const a = segments[i];
    for (let j = i + 1; j < segments.length; j++) {
      const b = segments[j];
      if (a.loop === b.loop && (b.index - a.index === 1 || b.index - a.index === a.size - 1)) continue;
      const overlaps = ([0, 1] as const).every(axis => Math.max(a.a[axis], a.b[axis]) >= Math.min(b.a[axis], b.b[axis])
        && Math.max(b.a[axis], b.b[axis]) >= Math.min(a.a[axis], a.b[axis]));
      if (overlaps) throw unsupported('projected sketch boundaries touch or cross.');
    }
  }
}

const lines = (ring: readonly XY[]) => ring.map(start => ({ kind: 'line' as const, start }));

function checkProfile(region: PolygonWithHoles) {
  try {
    const slabs = prismaticFromProfile({ outer: lines(region.outer), holes: region.holes.map(lines), height: 1 }).slabs;
    const [read] = slabs[0]?.regions ?? [];
    if (slabs.length === 1 && slabs[0].regions.length === 1 && read.outer.length === region.outer.length
      && read.holes.length === region.holes.length
      && read.holes.map(hole => hole.length).sort((a, b) => a - b).join() === region.holes.map(hole => hole.length).sort((a, b) => a - b).join()) return;
  } catch (error) {
    throw unsupported(`the result cannot form a native sketch. ${error instanceof Error ? error.message : String(error)}`);
  }
  throw unsupported('the native sketch would change the projected boundary.');
}

/** Read the material footprint of one current top-level body as an independent XY sketch. */
export function projectMaterialFootprint(doc: StudioDoc, key: string): SketchNode {
  if (doc.instances?.length) throw unsupported('open the source part on its own.');
  const matches = partBreps(doc).filter(body => body.key === key);
  if (matches.length !== 1) throw unsupported('select one current native solid.');
  const regions = unionTrims(horizontalTrims(matches[0].brep));
  if (regions.length !== 1) throw unsupported('the projection needs one connected outer region.');
  const [region] = regions;
  checkSketchRings([region.outer, ...region.holes]);
  checkProfile(region);
  return { kind: 'sketch', profile: 'polygon', points: [...region.outer],
    ...(region.holes.length ? { holes: region.holes.map(lines) } : {}) };
}

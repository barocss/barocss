import { CadNumericPolicy } from '@barocss/cad';
import { instanceLookByKey } from '@barocss/cad-model/assembly/looks';
import type { PartInstance } from '@barocss/cad-model/engine/doc';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import { bodyKeyFor } from '@barocss/cad-model/engine/ids';
import type { DisplayEdge, DisplayMesh, Vec3 } from '@barocss/cad-model/engine/mesh';
import type { SnapPoint } from '@barocss/cad-model/sketch/osnap';
import { isDefaultPlane, toLocal, type SketchPlane } from '@barocss/cad-model/sketch/plane';

type PlacedBoxSource = {
  occurrenceId: string; bodyKey: string; edgeIndex: number; edgeName: string; nativeVertices: readonly [string, string];
};
export type PlacedBoxSnapPoint = SnapPoint & PlacedBoxSource & (
  { kind: 'end'; vertexId: string } | { kind: 'mid'; vertexId?: never }
);

type Box = { lo: Vec3; hi: Vec3; feature: string; faceNames: string[] };
type BoxEdge = { edge: DisplayEdge; axis: number; vertices: readonly [string, string] };

const axes = [0, 1, 2] as const;
const axisNames = ['x', 'y', 'z'] as const;
const { coordinateAbs, linearTolerance } = CadNumericPolicy;
const planeTolerance = 1e-3; // The ordinary Model snap plane tolerance.
const coordinate = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= coordinateAbs;
const point = (value: unknown): value is Vec3 => Array.isArray(value) && value.length === 3 && axes.every(i => coordinate(value[i]));
const equals = (a: ArrayLike<number>, b: ArrayLike<number>) => axes.every(i => a[i] === b[i]);
const nodeId = (id: unknown): id is string => typeof id === 'string' && /^n(?:0|[1-9]\d*)$/.test(id) && Number.isSafeInteger(Number(id.slice(1)));
const cardinal = (v: Vec3) => axes.find(i => Math.abs(v[i]) === 1 && axes.every(j => j === i || v[j] === 0));

function authoredBox(instance: PartInstance, body: BodyResult): Box | null {
  const doc = instance.doc;
  if (typeof instance.id !== 'string' || !/^[A-Za-z0-9_-]+$/.test(instance.id) || instance.hidden || instance.pattern || instance.savedPlacement || instance.joints
    || !point(instance.position) || !point(instance.rotation) || instance.rotation.some(value => value !== 0)
    || doc.format !== 'barocss-cad-model' || doc.schema !== 3 || doc.units !== 'mm' || doc.nodes.length !== 2
    || doc.instances?.length || doc.mates?.length || doc.instancePatterns?.length || doc.assemblyCuts?.length
    || doc.assemblySteps?.length || doc.robot || doc.variability || doc.configurations || doc.routeBundles || doc.direct) return null;

  const [sketch, extrusion] = doc.nodes;
  if (sketch.kind !== 'sketch' || sketch.profile !== 'rectangle' || sketch.suppressed || sketch.held
    || sketch.association || sketch.on || sketch.outline || sketch.construction?.length || sketch.holes?.length || sketch.regions?.length
    || (sketch.plane && !isDefaultPlane(sketch.plane))
    || extrusion.kind !== 'extrude' || extrusion.sketch !== 0 || extrusion.suppressed || extrusion.held || extrusion.made
    || (extrusion.draft ?? 0) !== 0 || !coordinate(extrusion.height) || extrusion.height <= 0) return null;

  if (!nodeId(sketch.id) || !nodeId(extrusion.id) || sketch.id === extrusion.id) return null;
  const feature = extrusion.id, key = bodyKeyFor(doc.nodes, 1), output = doc.outputs[key];
  if (Object.keys(doc.outputs).length !== 1 || output?.node !== 1 || output.side !== 'solid'
    || body.key !== key || body.ref?.node !== 1 || body.ref.side !== 'solid'
    || body.family !== 'upright' || body.role || (body.pieces ?? 1) !== 1 || body.innerShells
    || instanceLookByKey(instance, key).hidden) return null;

  if (!Array.isArray(sketch.min) || sketch.min.length !== 2 || !Array.isArray(sketch.max) || sketch.max.length !== 2) return null;
  const [x0, y0] = sketch.min, [x1, y1] = sketch.max, z0 = extrusion.from ?? 0;
  if (!coordinate(x0) || !coordinate(y0) || !coordinate(x1) || !coordinate(y1) || !coordinate(z0)) return null;
  const [x, y, z] = instance.position;
  const lo: Vec3 = [x0 + x, y0 + y, z0 + z], hi: Vec3 = [x1 + x, y1 + y, z0 + extrusion.height + z];
  if (!point(lo) || !point(hi) || axes.some(i => hi[i] - lo[i] <= linearTolerance)) return null;

  const tags = sketch.sideTags?.outer;
  if (sketch.sideTags && (!Array.isArray(tags) || tags.length !== 4 || sketch.sideTags.holes?.length || sketch.sideTags.regions?.length
    || new Set(tags).size !== 4 || [...tags].some(tag => typeof tag !== 'string' || !/^e(?:0|[1-9]\d*)$/.test(tag)))) return null;
  const side = (i: number) => `${feature}.side${tags ? `[${tags[i]}]` : i}`;
  return { lo, hi, feature, faceNames: [side(3), side(1), side(0), side(2), `${feature}.bottom`, `${feature}.top`] };
}

function cornerOf(p: Vec3, box: Box): number {
  let corner = 0;
  for (const i of axes) {
    if (p[i] === box.hi[i]) corner |= 1 << i;
    else if (p[i] !== box.lo[i]) return -1;
  }
  return corner;
}

function faceStations(mesh: DisplayMesh, box: Box): number[] | null {
  if (mesh.faces.length !== 6 || !(mesh.positions instanceof Float64Array) || mesh.positions.length > 216
    || mesh.positions.length !== 3 * mesh.faceOfVertex.length || !point(mesh.bounds.min) || !point(mesh.bounds.max)
    || !equals(mesh.bounds.min, box.lo) || !equals(mesh.bounds.max, box.hi)) return null;
  const stations: number[] = [], faceIds = new Set<string>();
  for (const [i, face] of mesh.faces.entries()) {
    const station = box.faceNames.indexOf(face.name);
    if (face.index !== i || station < 0 || stations.includes(station) || !face.id || faceIds.has(face.id)
      || face.kind !== 'plane' || face.facet || face.lump !== undefined || face.exact?.kind !== 'plane') return null;
    const axis = axes[Math.floor(station / 2)], upper = station % 2, exact = face.exact;
    const at = (upper ? box.hi : box.lo)[axis];
    if (!Number.isFinite(exact.o[axis]) || Math.abs(exact.o[axis] - at) > linearTolerance || !point(exact.n)
      || axes.some(j => Math.abs(exact.n[j] - (j === axis ? upper ? 1 : -1 : 0)) > 1e-9)) return null;
    faceIds.add(face.id);
    stations.push(station);
  }

  const corners = stations.map(() => new Set<number>());
  for (const [i, face] of mesh.faceOfVertex.entries()) {
    const station = stations[face], axis = axes[Math.floor(station / 2)], upper = station % 2;
    const p: Vec3 = [mesh.positions[3 * i], mesh.positions[3 * i + 1], mesh.positions[3 * i + 2]];
    if (station === undefined || !point(p) || axes.some(j => p[j] < box.lo[j] || p[j] > box.hi[j])
      || p[axis] !== (upper ? box.hi : box.lo)[axis]) return null;
    const corner = cornerOf(p, box);
    if (corner >= 0) corners[face].add(corner);
  }
  return corners.every(c => c.size === 4) ? stations : null;
}

function boxEdges(mesh: DisplayMesh, box: Box, stations: readonly number[]): BoxEdge[] | null {
  if (mesh.edges.length !== 12) return null;
  const corners = new Map<number, string>(), vertices = new Map<string, number>(), pairs = new Set<string>();
  const result: BoxEdge[] = [];
  for (const [i, edge] of mesh.edges.entries()) {
    const ends = edge.nativeVertices;
    if (edge.index !== i || !edge.straight || edge.nativeCircle || !ends || ends.length !== 2 || ends[0] === ends[1]
      || edge.names.length !== 1 || !point(edge.a) || !point(edge.b)) return null;
    const a = cornerOf(edge.a, box), b = cornerOf(edge.b, box), axis = axes.find(j => (a ^ b) === 1 << j);
    if (a < 0 || b < 0 || axis === undefined || edge.axis !== axisNames[axis]) return null;
    const pair = `${Math.min(a, b)}:${Math.max(a, b)}`;
    if (pairs.has(pair)) return null;
    pairs.add(pair);

    const incident = axes.filter(j => j !== axis).map(j => 2 * j + ((a >> j) & 1));
    if (edge.faces.length !== 2 || new Set(edge.faces).size !== 2 || edge.faces.some(face => !incident.includes(stations[face]))
      || edge.names[0] !== incident.map(station => box.faceNames[station]).sort().join('|')) return null;
    for (const [corner, id] of [[a, ends[0]], [b, ends[1]]] as const) {
      if (typeof id !== 'string' || !id.startsWith(`${box.feature}_v`) || !/^[0-7]$/.test(id.slice(box.feature.length + 2))
        || (corners.has(corner) && corners.get(corner) !== id) || (vertices.has(id) && vertices.get(id) !== corner)) return null;
      corners.set(corner, id);
      vertices.set(id, corner);
    }
    result.push({ edge, axis, vertices: ends });
  }
  return corners.size === 8 ? result : null;
}

function visibleEdges(mesh: DisplayMesh): Set<number> | null {
  const lines = mesh.edgeLines, ids = mesh.edgeOfSegment, visible = new Set<number>();
  if (!(lines instanceof Float64Array) || lines.length > 72 || lines.length % 6 || ids.length !== lines.length / 3) return null;
  for (let i = 0; i < lines.length; i += 6) {
    const index = ids[i / 3], edge = mesh.edges[index];
    if (!edge || index !== ids[i / 3 + 1] || visible.has(index)) return null;
    const a = lines.subarray(i, i + 3), b = lines.subarray(i + 3, i + 6);
    if ((equals(a, edge.a) && equals(b, edge.b)) || (equals(a, edge.b) && equals(b, edge.a))) visible.add(index);
    else return null;
  }
  return visible;
}

/** End and midpoint inputs from a current accepted static box. Placed edge endpoints are already in world space. */
export function placedBoxSnapPoints(instance: PartInstance, body: BodyResult, plane: SketchPlane): PlacedBoxSnapPoint[] {
  if (!point(plane.origin) || !point(plane.normal) || !point(plane.xAxis)) return [];
  const normal = cardinal(plane.normal), horizontal = cardinal(plane.xAxis);
  if (normal === undefined || horizontal === undefined || normal === horizontal) return [];
  const box = authoredBox(instance, body);
  if (!box) return [];
  const offset = plane.origin[normal], near = (value: number) => Math.abs(value - offset) <= planeTolerance;
  if (near(box.lo[normal]) === near(box.hi[normal])) return [];

  const { mesh } = body, stations = faceStations(mesh, box);
  const edges = stations && boxEdges(mesh, box, stations), visible = edges && visibleEdges(mesh);
  if (!edges || !visible) return [];
  const seen = new Set<string>(), result: PlacedBoxSnapPoint[] = [];
  for (const { edge, axis, vertices } of edges) {
    if (!visible.has(edge.index) || axis === normal || !near(edge.a[normal]) || !near(edge.b[normal])) continue;
    const a = toLocal(plane, edge.a), b = toLocal(plane, edge.b);
    if (![...a, ...b].every(coordinate)) continue;
    const source = { occurrenceId: instance.id, bodyKey: body.key, edgeIndex: edge.index, edgeName: edge.names[0], nativeVertices: vertices };
    for (const [at, vertexId] of [[a, vertices[0]], [b, vertices[1]]] as const) {
      if (seen.has(vertexId)) continue;
      seen.add(vertexId);
      result.push({ ...source, kind: 'end', at, vertexId });
    }
    result.push({ ...source, kind: 'mid', at: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] });
  }
  return result;
}

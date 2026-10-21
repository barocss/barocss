// A sketch as DXF (R11b, O1): its profile at 1:1 in the sketch plane's own coordinates (mm), for a laser
// cutter or another CAD program. Each loop a closed LWPOLYLINE with its arcs as bulges (a lone circle a
// CIRCLE): the outer loop and the regions on PROFILE, holes on HOLES, construction shapes on CONSTRUCTION.
import { writeDxf, type DxfDocument, type DxfEntity, type DxfVersion, type DxfWriteResult, type DxfXY } from '@barocss/cad';
import type { Dim, LoopSegment, SketchNode } from '../engine/doc';
import { slotSegments, type P2 } from '@barocss/cad-model/sketch/profile';
import type { SketchShape } from './types';

export const SKETCH_DXF_VERSION = 'cad-studio-sketch-dxf-v1';

export class SketchDxfError extends Error {
  constructor(detail: string) { super(detail); this.name = 'SketchDxfError'; }
}

const LAYERS = [
  { name: 'PROFILE', color: 7, lineweight: 35 },
  { name: 'HOLES', color: 5, lineweight: 35 },
  { name: 'CONSTRUCTION', color: 8, linetype: 'BC_CONSTRUCTION', lineweight: 18 },
];
const LINETYPES = [{ name: 'BC_CONSTRUCTION', description: 'Construction _ _ _ (2, 1)', pattern: [2, -1] }];

function value(d: Dim, parameters: Readonly<Record<string, number>>): number {
  if (typeof d === 'number') return d;
  const v = parameters[d.parameter];
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new SketchDxfError(`The sketch uses the parameter “${d.parameter}”, which has no value.`);
  return v;
}
const point = (p: readonly [Dim, Dim], parameters: Readonly<Record<string, number>>): DxfXY => [value(p[0], parameters), value(p[1], parameters)];

/** The bulge of an arc from a to b about c, turning `ccw` or not: tan(sweep / 4). */
function bulgeOf(a: DxfXY, b: DxfXY, c: DxfXY, ccw: boolean): number {
  let sweep = Math.atan2(b[1] - c[1], b[0] - c[0]) - Math.atan2(a[1] - c[1], a[0] - c[0]);
  if (ccw) { while (sweep <= 0) sweep += 2 * Math.PI; } else { while (sweep >= 0) sweep -= 2 * Math.PI; }
  return Math.tan(sweep / 4);
}

/** A closed loop of segments (each from its start to the next one's) as one entity. */
function loopEntity(segments: readonly { kind: 'line' | 'arc'; start: DxfXY; center?: DxfXY; direction?: 'ccw' | 'cw' }[], layer: string): DxfEntity {
  if (segments.length === 1 && segments[0].kind === 'arc') {
    const s = segments[0], c = s.center!;
    return { type: 'circle', center: c, radius: Math.hypot(s.start[0] - c[0], s.start[1] - c[1]), layer };
  }
  const points = segments.map(s => s.start);
  const bulges = segments.map((s, i) => s.kind === 'arc' ? bulgeOf(s.start, segments[(i + 1) % segments.length].start, s.center!, s.direction !== 'cw') : 0);
  return { type: 'lwpolyline', points, ...(bulges.some(b => b !== 0) ? { bulges } : {}), closed: true, layer };
}

function docLoop(segs: readonly LoopSegment[], parameters: Readonly<Record<string, number>>, layer: string): DxfEntity {
  return loopEntity(segs.map(s => s.kind === 'line' ? { kind: 'line' as const, start: point(s.start, parameters) } : { kind: 'arc' as const, start: point(s.start, parameters), center: point(s.center, parameters), direction: s.direction }), layer);
}

function constructionEntities(shape: SketchShape, out: DxfEntity[]): void {
  const layer = 'CONSTRUCTION';
  if (shape.kind === 'rectangle') {
    const [x0, y0] = shape.a, [x1, y1] = shape.b;
    out.push({ type: 'lwpolyline', points: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], closed: true, layer });
  } else if (shape.kind === 'circle') out.push({ type: 'circle', center: shape.c, radius: shape.r, layer });
  else if (shape.kind === 'slot') out.push(loopEntity(slotSegments(shape.a as P2, shape.b as P2, shape.r).map(s => s.kind === 'line' ? { kind: 'line' as const, start: s.start } : { kind: 'arc' as const, start: s.start, center: s.center, direction: s.direction }), layer));
  else if (shape.points.length >= 2) {
    const n = shape.points.length, bulges = shape.bulges?.slice(0, n);
    out.push({ type: 'lwpolyline', points: shape.points, ...(bulges?.some(b => b) ? { bulges: Array.from({ length: n }, (_, i) => bulges[i] ?? 0) } : {}), closed: shape.closed, layer });
    for (const c of shape.circles ?? []) out.push({ type: 'circle', center: c.c, radius: c.r, layer });
  }
}

/** A sketch node as a DXF document in its plane's coordinates (mm). */
export function sketchDxfDocument(node: SketchNode, parameters: Readonly<Record<string, number>>): DxfDocument {
  const entities: DxfEntity[] = [];
  if (node.profile === 'rectangle') {
    const [x0, y0] = point(node.min, parameters), [x1, y1] = point(node.max, parameters);
    entities.push({ type: 'lwpolyline', points: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], closed: true, layer: 'PROFILE' });
  } else if (node.profile === 'circle') entities.push({ type: 'circle', center: point(node.center, parameters), radius: value(node.radius, parameters), layer: 'PROFILE' });
  else if (node.profile === 'polygon') entities.push({ type: 'lwpolyline', points: node.points.map(p => point(p, parameters)), closed: true, layer: 'PROFILE' });
  else entities.push(docLoop(node.segments, parameters, 'PROFILE'));
  for (const r of node.regions ?? []) entities.push(docLoop(r, parameters, 'PROFILE'));
  for (const h of node.holes ?? []) entities.push(docLoop(h, parameters, 'HOLES'));
  for (const c of (node.construction ?? []) as SketchShape[]) if (c && typeof c === 'object' && 'kind' in c) constructionEntities(c, entities);
  return { units: 'mm', linetypes: LINETYPES, layers: LAYERS, entities };
}

/** A sketch as a DXF file (AC1015 by default, or R12). */
export function sketchDxf(node: SketchNode, parameters: Readonly<Record<string, number>>, version: DxfVersion = 'AC1015'): DxfWriteResult {
  return writeDxf(sketchDxfDocument(node, parameters), { version });
}

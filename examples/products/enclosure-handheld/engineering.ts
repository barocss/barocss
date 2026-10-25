// P2 engineering checkpoint. Reads saved geometry; never imports the builder or invents supplier rows.
import { booleanAnalytic, brepMassProperties, faceGeometry, transformBrep, type Brep } from '@barocss/cad';
import { partBreps, evaluateDoc } from '../../../packages/barocss-cad-model/src/engine/evaluate';
import type { StudioDoc } from '../../../packages/barocss-cad-model/src/engine/doc';
import { bodiesOf } from '../../../packages/barocss-cad-model/src/api/core';
import { Assembly, part } from '../../../packages/barocss-cad-model/src/api';
import { drawingOf, manufacturabilityOf, outputOf } from '../../../packages/barocss-cad-model/src/api/outputs';
import { assemblyPlacedBodies, TOUCHING_MM3, type PlacedBody } from '../../../packages/barocss-cad-model/src/team/clearanceMap';
import type { Check, OutputFile } from './check';

type V3 = readonly [number, number, number];
interface Plane { name: string; o: V3; n: V3; z: readonly [number, number] }
export interface Measurement { id: string; actual: number | null; expected: number; tolerance: number; faces: string[] }
export interface PairResult { a: string; b: string; status: 'no-overlap' | 'overlap' | 'refused'; basis?: 'bounds' | 'intersection'; volume?: number; code?: string; message?: string }
export interface EngineeringResult { checks: Check[]; measurements: Measurement[]; pairs: PairResult[]; files: OutputFile[] }
const LENGTH_TOLERANCE = 1e-6, ANGLE_TOLERANCE = 1e-6;
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const errorOf = (e: unknown) => {
  const v = e as { code?: unknown; message?: unknown } | null;
  return { code: typeof v?.code === 'string' ? v.code : 'P2_ENGINEERING', message: typeof v?.message === 'string' ? v.message : String(e) };
};
const json = (data: unknown) => JSON.stringify(data, null, 2) + '\n';
const ownDoc = (doc: StudioDoc): StudioDoc => { const d = structuredClone(doc); delete d.instances; delete d.mates; return d; };
const at = (p: Plane, axis: 0 | 1, z: number) => (dot(p.o, p.n) - p.n[2] * z) / p.n[axis];

interface SurfaceInfo { name: string; geometry: ReturnType<typeof faceGeometry>; z: readonly [number, number] }
/** Exact face geometry and boundary-vertex Z extents; no feature ids are required by the oracle. */
function geometryOf(breps: readonly { brep: Brep }[]): SurfaceInfo[] {
  const surfaces: SurfaceInfo[] = [];
  for (const { brep } of breps) {
    const edge = new Map(brep.edges.map(e => [e.id, e])), vertex = new Map(brep.vertices.map(v => [v.id, v.point]));
    const loop = new Map(brep.loops.map(l => [l.id, l])), coedge = new Map(brep.coedges.map(c => [c.id, c]));
    for (const f of brep.faces) {
      const geometry = faceGeometry(f);
      const z = f.loops.flatMap(id => loop.get(id)?.coedges ?? []).flatMap(id => {
        const e = edge.get(coedge.get(id)?.edge ?? ''); return e?.vertices.map(id => vertex.get(id)?.[2] ?? NaN) ?? [];
      });
      if (!z.length || !z.every(Number.isFinite)) continue;
      surfaces.push({ name: f.name ?? f.id, geometry, z: [Math.min(...z), Math.max(...z)] });
    }
  }
  return surfaces;
}
const planesOf = (surfaces: readonly SurfaceInfo[]): Plane[] => surfaces.flatMap(f => f.geometry.kind === 'plane' ? [{ name: f.name, o: f.geometry.o, n: f.geometry.n, z: f.z }] : []);
const spans = (p: Plane, z: number) => p.z[0] <= z + LENGTH_TOLERANCE && p.z[1] >= z - LENGTH_TOLERANCE;
const support = (ps: readonly Plane[], axis: 0 | 1, side: number, z: number) => ps.filter(p => spans(p, z) && p.n[axis] * side > 0.99 && Math.abs(p.n[1 - axis]) < 1e-8)
  .sort((a, b) => side * (at(b, axis, z) - at(a, axis, z)))[0];
const horizontal = (ps: readonly Plane[], sign: number) => ps.filter(p => p.n[2] * sign > 1 - 1e-10);

/** Design dimensions from brief.md: 2 mm nominal wall, 1 degree draft, 0.1 mm lip clearance. */
export function measureHousing(doc: StudioDoc): Measurement[] {
  const bottomGeometry = geometryOf(partBreps(ownDoc(doc))), bottom = planesOf(bottomGeometry), coverInstance = doc.instances?.find(i => i.name === 'cover');
  if (!coverInstance) throw Object.assign(new Error('Missing cover'), { code: 'P2_COVER_REQUIRED' });
  const coverGeometry = geometryOf(partBreps(ownDoc(coverInstance.doc))), cover = planesOf(coverGeometry), measurements: Measurement[] = [];
  for (const [name, planes, z, direction] of [['case-bottom', bottom, 10, -1], ['cover', cover, 5, 1]] as const) {
    for (const axis of [0, 1] as const) for (const side of [-1, 1]) {
      const outer = support(planes, axis, side, z);
      const inner = outer && planes.filter(p => spans(p, z) && dot(p.n, outer.n) < -1 + 1e-10 && (at(outer, axis, z) - at(p, axis, z)) * side > 0)
        .sort((a, b) => side * (at(b, axis, z) - at(a, axis, z)))[0];
      measurements.push({ id: `wall:${name}:${axis}:${side}`, actual: outer && inner ? Math.abs(dot(outer.n, [inner.o[0] - outer.o[0], inner.o[1] - outer.o[1], inner.o[2] - outer.o[2]])) : null, expected: 2, tolerance: LENGTH_TOLERANCE, faces: [outer?.name, inner?.name].filter((v): v is string => !!v) });
      measurements.push({ id: `draft:${name}:${axis}:${side}`, actual: outer ? Math.asin(outer.n[2] * direction) * 180 / Math.PI : null, expected: 1, tolerance: ANGLE_TOLERANCE, faces: outer ? [outer.name] : [] });
    }
    const capSign = direction, outer = horizontal(planes, capSign).sort((a, b) => capSign * (b.o[2] - a.o[2]))[0];
    const inner = outer && horizontal(planes, -capSign).filter(p => (outer.o[2] - p.o[2]) * capSign > 0)
      .sort((a, b) => capSign * (b.o[2] - a.o[2]))[0];
    measurements.push({ id: `wall:${name}:cap`, actual: outer && inner ? Math.abs(outer.o[2] - inner.o[2]) : null, expected: 2, tolerance: LENGTH_TOLERANCE, faces: [outer?.name, inner?.name].filter((v): v is string => !!v) });
  }
  const correctlyPlaced = coverInstance.position.every((v, i) => Math.abs(v - [0, 0, 18][i]) <= LENGTH_TOLERANCE) && coverInstance.rotation.every(v => Math.abs(v) <= ANGLE_TOLERANCE);
  for (const axis of [0, 1] as const) for (const side of [-1, 1]) {
    const lip = support(bottom.filter(p => Math.abs(p.n[2]) < 1e-10), axis, side, 19);
    // The rebate faces inward. Choose its outermost matching plane by coordinate, not feature id.
    const rebate = cover.filter(p => spans(p, 1) && p.n[axis] * side < -1 + 1e-10).sort((a, b) => side * (at(b, axis, 1) - at(a, axis, 1)))[0];
    measurements.push({ id: `fit:side:${axis}:${side}`, actual: correctlyPlaced && lip && rebate ? side * (at(rebate, axis, 1) - at(lip, axis, 19)) : null, expected: 0.1, tolerance: LENGTH_TOLERANCE, faces: [lip?.name, rebate?.name].filter((v): v is string => !!v) });
  }
  const lipTop = horizontal(bottom, 1).sort((a, b) => b.o[2] - a.o[2])[0];
  const ceiling = horizontal(cover, -1).filter(p => p.o[2] > LENGTH_TOLERANCE).sort((a, b) => a.o[2] - b.o[2])[0];
  measurements.push({ id: 'fit:top', actual: correctlyPlaced && lipTop && ceiling ? coverInstance.position[2] + ceiling.o[2] - lipTop.o[2] : null, expected: 0.1, tolerance: LENGTH_TOLERANCE, faces: [lipTop?.name, ceiling?.name].filter((v): v is string => !!v) });
  // Four cylindrical corner gaps complete the rim sections left out by the straight supporting planes.
  for (const x of [-67, 67]) for (const y of [-28, 28]) {
    const lip = bottomGeometry.find(f => f.geometry.kind === 'cylinder' && f.geometry.out === 1 && Math.abs(f.geometry.a[2]) > 1 - 1e-10 && f.z[0] <= 19 && f.z[1] >= 19 && Math.hypot(f.geometry.c[0] - x, f.geometry.c[1] - y) <= LENGTH_TOLERANCE);
    const rebate = coverGeometry.find(f => f.geometry.kind === 'cylinder' && f.geometry.out === -1 && Math.abs(f.geometry.a[2]) > 1 - 1e-10 && f.z[0] <= 1 && f.z[1] >= 1 && Math.hypot(f.geometry.c[0] - x, f.geometry.c[1] - y) <= LENGTH_TOLERANCE);
    measurements.push({ id: `fit:corner:${x}:${y}`, actual: correctlyPlaced && lip?.geometry.kind === 'cylinder' && rebate?.geometry.kind === 'cylinder' ? rebate.geometry.r - lip.geometry.r : null, expected: 0.1, tolerance: LENGTH_TOLERANCE, faces: [lip?.name, rebate?.name].filter((v): v is string => !!v) });
  }
  return measurements;
}

/** A conservative hull of positive-weight NURBS control points, edges and facets. Unknown bounds never prune. */
function hull(brep: Brep): { min: number[]; max: number[] } | null {
  const all: number[][] = [];
  for (const face of brep.faces) {
    if (face.surface.kind === 'surface') {
      if (!face.surface.weights.flat().every(w => Number.isFinite(w) && w > 0)) return null;
      all.push(...face.surface.controlPoints.flat());
    } else {
      for (let k = 0; k < face.surface.positions.length; k += 3) all.push(Array.from(face.surface.positions.slice(k, k + 3)));
    }
  }
  for (const e of brep.edges) { if (!e.curve.weights.every(w => Number.isFinite(w) && w > 0)) return null; all.push(...e.curve.controlPoints); }
  all.push(...brep.vertices.map(v => v.point));
  if (!all.length || !all.every(p => p.length === 3 && p.every(Number.isFinite))) return null;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const p of all) for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], p[i]); max[i] = Math.max(max[i], p[i]); }
  return { min, max };
}

/** Check all body pairs, including containment. A positive mesh gap never skips an exact intersection. */
export function checkInterference(bodies: readonly PlacedBody[], progress?: (result: PairResult) => void): PairResult[] {
  const world = bodies.map(b => {
    const brep = b.brep && transformBrep(b.brep, { matrix: b.pose.m as never, offset: b.pose.t });
    return { key: b.key, brep, box: brep ? hull(brep) : null };
  });
  const results: PairResult[] = [];
  for (let i = 0; i < world.length; i++) for (let j = i + 1; j < world.length; j++) {
    const a = world[i], b = world[j]; let result: PairResult;
    if (!a.brep || !b.brep) result = { a: a.key, b: b.key, status: 'refused', code: 'P2_NO_BREP', message: 'No exact solid for one body' };
    else if (a.box && b.box && [0, 1, 2].some(k => a.box!.max[k] <= b.box!.min[k] || b.box!.max[k] <= a.box!.min[k])) result = { a: a.key, b: b.key, status: 'no-overlap', basis: 'bounds', volume: 0 };
    else {
      try {
        const intersection = booleanAnalytic(a.brep, b.brep, 'intersection');
        const volume = intersection.bodies.length ? brepMassProperties(intersection, 1).volume : 0;
        if (!Number.isFinite(volume) || volume < 0) throw Object.assign(new Error(`Invalid overlap volume ${volume}`), { code: 'P2_OVERLAP_INVALID' });
        result = { a: a.key, b: b.key, status: volume > TOUCHING_MM3 ? 'overlap' : 'no-overlap', basis: 'intersection', volume };
      } catch (e) { result = { a: a.key, b: b.key, status: 'refused', ...errorOf(e) }; }
    }
    results.push(result); progress?.(result);
  }
  return results;
}

const storedFile = (value: Record<string, unknown>) => (value.files as { text?: string }[] | undefined)?.[0]?.text ?? json(value);

/** Reports, files and their validation are separate: a generated report can contain failing manufacturing rules. */
export async function engineeringOf(doc: StudioDoc, progress?: (stage: string, data: unknown) => void): Promise<EngineeringResult> {
  const checks: Check[] = [], measurements: Measurement[] = [], files: OutputFile[] = [], pairs: PairResult[] = [];
  try {
    measurements.push(...measureHousing(doc));
    for (const [prefix, count] of [['wall:', 10], ['draft:', 8], ['fit:', 9]] as const) {
      const selected = measurements.filter(m => m.id.startsWith(prefix));
      checks.push({ id: `engineering:${prefix.slice(0, -1)}`, ok: selected.length === count && selected.every(m => m.actual !== null && Number.isFinite(m.actual) && Math.abs(m.actual - m.expected) <= m.tolerance), detail: json(selected) });
    }
  } catch (e) { checks.push({ id: 'engineering:planes', ok: false, ...refusalDetail(e) }); }
  progress?.('planes', measurements);
  try {
    const bodies = await assemblyPlacedBodies(doc, async d => evaluateDoc(d, 0));
    const expectedBodies = 1 + (doc.instances ?? []).length;
    pairs.push(...checkInterference(bodies, pair => progress?.('pair', pair)));
    const overlap = pairs.filter(p => p.status === 'overlap'), refused = pairs.filter(p => p.status === 'refused');
    checks.push({ id: 'engineering:interference', ok: bodies.length === expectedBodies && pairs.length === bodies.length * (bodies.length - 1) / 2 && overlap.length === 0 && refused.length === 0,
      detail: json({ bodies: bodies.length, expectedBodies, pairs: pairs.length, threshold: TOUCHING_MM3, overlap, refused }) });
  } catch (e) { checks.push({ id: 'engineering:interference', ok: false, ...refusalDetail(e) }); }
  files.push({ path: 'engineering/measurements.json', data: json(measurements) }, { path: 'engineering/interference.json', data: json(pairs) });
  const made = [{ name: 'case-bottom', doc: ownDoc(doc) }, ...(doc.instances ?? []).filter(i => ['cover', 'heat-sink'].includes(i.name)).map(i => ({ name: i.name, doc: ownDoc(i.doc) }))];
  checks.push({ id: 'outputs:made-parts', ok: made.length === 3 && new Set(made.map(p => p.name)).size === 3, detail: made.map(p => p.name).join(', ') });
  for (const p of made) {
    try {
      const report = await manufacturabilityOf(p.doc);
      files.push({ path: `${p.name}/manufacturability.json`, data: json(report) });
      const unresolved = report.rules.filter(r => ['fail', 'warn', 'unknown'].includes(r.status));
      checks.push({ id: `outputs:dfm:${p.name}`, ok: !!p.doc.process && report.process === p.doc.process && report.rules.length > 0 && unresolved.length === 0, detail: json({ process: report.process, unresolved }) });
      progress?.(`dfm:${p.name}`, report);
    } catch (e) { checks.push({ id: `outputs:dfm:${p.name}`, ok: false, ...refusalDetail(e) }); }
    try {
      const dr = drawingOf(p.doc), dimensions = (dr.sheet.dimensions as unknown[] | undefined)?.length ?? 0;
      const errors = dr.issues.filter(i => i.severity === 'error');
      const validFiles = dr.svg.includes('<svg') && dr.dxf.includes('ENTITIES') && new TextDecoder().decode(dr.pdf.slice(0, 5)) === '%PDF-';
      files.push({ path: `${p.name}/drawing.svg`, data: dr.svg }, { path: `${p.name}/drawing.dxf`, data: dr.dxf }, { path: `${p.name}/drawing.pdf`, data: dr.pdf }, { path: `${p.name}/drawing-issues.json`, data: json(dr.issues) });
      checks.push({ id: `outputs:drawing:${p.name}`, ok: dimensions > 0 && errors.length === 0 && validFiles && dr.pdfMissing.length === 0, detail: json({ dimensions, errors, issues: dr.issues, pdfMissing: dr.pdfMissing, validFiles }) });
    } catch (e) { checks.push({ id: `outputs:drawing:${p.name}`, ok: false, ...refusalDetail(e) }); }
    if (p.doc.process === 'cnc-milling') {
      try { const cam = await outputOf(p.doc, 'output_cam_package'); files.push({ path: `${p.name}/cam-package.json`, data: storedFile(cam) }); checks.push({ id: `outputs:cam:${p.name}`, ok: true, detail: 'CAM package generated (not production approval)' }); }
      catch (e) { files.push({ path: `${p.name}/cam-refusal.json`, data: json(errorOf(e)) }); checks.push({ id: `outputs:cam:${p.name}`, ok: false, ...refusalDetail(e) }); }
    }
  }
  try {
    const content = await outputOf(doc, 'output_bom'), bom = content.bom as { lines: { parts: string[]; qty: number; mass: number }[]; totalMass: number };
    files.push({ path: 'bom.json', data: storedFile(content) }, { path: 'purchase.csv', data: storedFile(await outputOf(doc, 'output_purchase_csv')) });
    const listed = new Set(bom.lines.flatMap(l => l.parts.map(p => p.split(':')[0]))), expected = ['base', ...(doc.instances ?? []).map(i => i.id)];
    checks.push({ id: 'outputs:bom-coverage', ok: expected.every(id => listed.has(id)), detail: json({ expected, listed: [...listed], total: bom.totalMass }) });
    let knownMass = 0; const unknown: string[] = [];
    for (const p of [{ name: 'base', doc: ownDoc(doc) }, ...(doc.instances ?? []).map(i => ({ name: i.name, doc: ownDoc(i.doc) }))]) {
      const bodyPart = part(p.name, p.doc);
      for (const b of bodiesOf(p.doc)) {
        try { knownMass += bodyPart.body(b.key).mass().mass; } catch (e) { if (errorOf(e).code !== 'MATERIAL_UNKNOWN') throw e; unknown.push(p.name); }
      }
    }
    checks.push({ id: 'outputs:bom-mass', ok: unknown.length === 0 && Math.abs(knownMass - bom.totalMass) <= 0.01, ...(unknown.length ? { code: 'P2_MATERIAL_REQUIRED' } : {}), detail: json({ knownMass, unknown, exportedTotal: bom.totalMass, tolerance: 0.01, note: 'Unspecified material is unknown, never an accepted assumed density' }) });
  } catch (e) { checks.push({ id: 'outputs:bom', ok: false, ...refusalDetail(e) }); }
  try {
    const drawing = new Assembly('enclosure-handheld', doc).drawingSettings({ scope: { kind: 'assembly' }, sheet: 'A3', balloons: true, tables: [{ id: 'bom', from: 'bom' }], title: 'enclosure-handheld' }).drawing();
    const validFiles = drawing.svg.includes('<svg') && drawing.dxf.includes('ENTITIES') && new TextDecoder().decode(drawing.pdf.slice(0, 5)) === '%PDF-';
    files.push({ path: 'assembly/drawing.svg', data: drawing.svg }, { path: 'assembly/drawing.dxf', data: drawing.dxf }, { path: 'assembly/drawing.pdf', data: drawing.pdf }, { path: 'assembly/drawing-issues.json', data: json(drawing.issues) });
    checks.push({ id: 'outputs:assembly-drawing', ok: validFiles && drawing.issues.length === 0 && drawing.pdfMissing.length === 0, detail: json({ validFiles, issues: drawing.issues, pdfMissing: drawing.pdfMissing }) });
  } catch (e) { checks.push({ id: 'outputs:assembly-drawing', ok: false, ...refusalDetail(e) }); }
  files.push({ path: 'engineering/checks.json', data: json(checks) });
  return { checks, measurements, pairs, files };
}
function refusalDetail(error: unknown): { code: string; detail: string } { const e = errorOf(error); return { code: e.code, detail: e.message }; }

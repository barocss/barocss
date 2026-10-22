// The robustness runner's stages for one case file, and how each outcome is classified (taxonomy):
//   OK, REFUSED (a typed kernel error: acceptable), KNOWN (a pinned convention the checks flag: the prismatic
//   crescent, D195), INVALID (the result fails the L0 checks), WRONG (valid but
//   off an expectation or a metamorphic check), CRASH (an untyped exception, or NaN), TIMEOUT (set by the
//   runner), TOL_BLOWUP (vertex or curve gaps past the tolerance cap).
// A part document (.json, raw or a conformance case) is evaluated; a STEP file (.step/.stp) imported. Each
// resulting body is validated, measured and tessellated (watertight by position).
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export const STATUSES = ['OK', 'REFUSED', 'KNOWN', 'INVALID', 'WRONG', 'CRASH', 'TIMEOUT', 'TOL_BLOWUP'];
/** Built-in error types: thrown from kernel code they mean a bug (CRASH), not a refusal. */
const UNTYPED = new Set(['Error', 'TypeError', 'ReferenceError', 'RangeError', 'SyntaxError', 'EvalError', 'URIError', 'AggregateError', 'InternalError']);

/** REFUSED for a kernel's own error type (CadPartError, BrepError, StepImportError…), else CRASH. */
export function classifyError(cause) {
  const name = cause && typeof cause === 'object' ? cause.name ?? cause.constructor?.name : undefined;
  return name && !UNTYPED.has(name) && /Error$/.test(name) ? 'REFUSED' : 'CRASH';
}
/** The error as a short detail: its type, code and message. */
export function errorDetail(cause) {
  if (!(cause instanceof Error)) return String(cause).slice(0, 300);
  return `${cause.name}${cause.code ? ` ${cause.code}` : ''}: ${cause.message}`.slice(0, 300);
}

/** Edges of a mesh not used exactly twice, by position (a watertight tessellation shares its edge samples). */
export function openEdges(positions, indices) {
  const key = i => `${positions[3 * i]},${positions[3 * i + 1]},${positions[3 * i + 2]}`, uses = new Map();
  for (let t = 0; t < indices.length; t += 3) for (let k = 0; k < 3; k++) {
    const a = key(indices[t + k]), b = key(indices[t + (k + 1) % 3]), e = a < b ? `${a}|${b}` : `${b}|${a}`;
    uses.set(e, (uses.get(e) ?? 0) + 1);
  }
  let open = 0; for (const n of uses.values()) if (n !== 2) open++;
  return open;
}

/** The mesh edges (their two points) not used exactly twice, with their use counts. */
function openEdgeList(positions, indices, out) {
  const at = i => [positions[3 * i], positions[3 * i + 1], positions[3 * i + 2]], key = p => p.join(','), uses = new Map();
  for (let t = 0; t < indices.length; t += 3) for (let k = 0; k < 3; k++) {
    const a = at(indices[t + k]), b = at(indices[t + (k + 1) % 3]), e = key(a) < key(b) ? `${key(a)}|${key(b)}` : `${key(b)}|${key(a)}`;
    const u = uses.get(e); if (u) u.n++; else uses.set(e, { a, b, n: 1 });
  }
  for (const u of uses.values()) if (u.n !== 2) out.push(u);
  return out;
}

/**
 * The prismatic crescent (D195): a prismatic-solid body that touches itself along a line where a circle is tangent
 * inside another, or a wall tangent inside a hole, as prismatic-solid.test pins it ('crescent (internal tangency)'; the
 * crescents of any extent): two distinct line edges up the tangent line coincide, between one pair of vertices (a box
 * less a tangent cylinder, fuzz 56) or two pairs of distinct vertices at the same points (a disc tangent inside a
 * disc). Those edge pairs (their ends, and the vertices' ids), or null — a body from any other source, or any other
 * contact, is not one. `anySource`: a STEP read-back of such a body.
 */
export function crescentContacts(brep, anySource = false) {
  if (!anySource && brep.source?.family !== 'prismatic-solid') return null;
  const tol = 1e-9 * sizeOf(brep), P = new Map(brep.vertices.map(v => [v.id, v.point])), d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const lines = brep.edges.filter(e => e.curve.degree === 1 && e.curve.controlPoints.length === 2), segments = [], vertices = new Set();
  for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) {
    const a = lines[i], b = lines[j];
    const [a0, a1] = a.vertices.map(v => P.get(v)), [b0, b1] = b.vertices.map(v => P.get(v));
    if ((d(a0, b0) <= tol && d(a1, b1) <= tol) || (d(a0, b1) <= tol && d(a1, b0) <= tol)) { segments.push([a0, a1]); for (const v of [...a.vertices, ...b.vertices]) vertices.add(v); }
  }
  return segments.length ? { segments, vertices, tol } : null;
}
/** Whether point p lies on segment a–b (within tol). */
function onSegment(p, [a, b], tol) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]], l2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
  const t = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / (l2 || 1)));
  return Math.hypot(ap[0] - t * ab[0], ap[1] - t * ab[1], ap[2] - t * ab[2]) <= tol;
}
/** Whether a tessellation's open edges are all a crescent's: each used four times, along one of its coincident edge pairs. */
export function crescentMesh(brep, mesh, c) {
  const shellOf = new Map(brep.faces.map(f => [f.id, f.shell])), bodyOf = new Map(brep.shells.map(s => [s.id, s.body])), tris = new Map();
  for (const f of mesh.faces) { const body = bodyOf.get(shellOf.get(f.faceId)), list = tris.get(body) ?? []; for (let t = f.indexOffset; t < f.indexOffset + f.indexCount; t++) list.push(mesh.indices[t]); tris.set(body, list); }
  const open = []; for (const list of tris.values()) openEdgeList(mesh.positionsMM, list, open);
  return open.length > 0 && open.every(u => u.n === 4 && c.segments.some(s => onSegment(u.a, s, 1e3 * c.tol) && onSegment(u.b, s, 1e3 * c.tol)));
}
/** Whether strict L0's issues are all a crescent's: its faces' loops touching, on faces through its coincident vertices. */
export function crescentIssues(brep, issues, c) {
  const faces = new Set(), loops = new Map(brep.loops.map(l => [l.id, l])), coedges = new Map(brep.coedges.map(x => [x.id, x])), edges = new Map(brep.edges.map(e => [e.id, e]));
  for (const f of brep.faces) for (const l of f.loops) for (const ce of loops.get(l)?.coedges ?? []) { const e = edges.get(coedges.get(ce)?.edge); if (e && e.vertices.some(v => c.vertices.has(v))) faces.add(f.id); }
  return issues.length > 0 && issues.every(i => { const m = /^geometry: face (\S+): its loops cross or touch/.exec(i); return m && faces.has(m[1]); });
}

/** Open edges of a tessellation counted within each body's own triangles. */
export function openEdgesByBody(brep, mesh) {
  const shellOf = new Map(brep.faces.map(f => [f.id, f.shell])), bodyOf = new Map(brep.shells.map(s => [s.id, s.body])), tris = new Map();
  for (const f of mesh.faces) {
    const body = bodyOf.get(shellOf.get(f.faceId)), list = tris.get(body) ?? [];
    for (let t = f.indexOffset; t < f.indexOffset + f.indexCount; t++) list.push(mesh.indices[t]);
    tris.set(body, list);
  }
  let open = 0; for (const list of tris.values()) open += openEdges(mesh.positionsMM, list);
  return open;
}
/** A B-rep's size (largest coordinate of its vertices, at least 1): the scale of its tolerance cap. */
function sizeOf(brep) {
  let s = 1; for (const v of brep.vertices) for (const x of v.point) s = Math.max(s, Math.abs(x));
  return s;
}
/** Gaps a valid model may have: 1e-6 of its size (the kernel's own tolerances are far smaller). */
export const gapCap = size => 1e-6 * size;

/**
 * Runs the case at `file` through its stages with the kernel `cad`, reporting each as it starts (so the runner
 * can name the stage a timeout hit) and returning [{ stage, status, ms, detail }].
 */
export function runCase(cad, file, started) {
  const rows = [], text = readFileSync(file, 'utf8');
  const stage = (name, run) => {
    started(name); const t0 = performance.now();
    let status = 'OK', detail, value;
    try { const r = run(); value = r?.value; status = r?.status ?? 'OK'; detail = r?.detail; }
    catch (cause) { status = classifyError(cause); detail = errorDetail(cause); }
    rows.push({ stage: name, status, ms: +(performance.now() - t0).toFixed(1), ...(detail ? { detail } : {}) });
    return status === 'OK' || status === 'KNOWN' ? value : undefined;
  };
  let bodies, expect;
  const isStep = /\.(step|stp)$/i.test(file);
  if (isStep) bodies = stage('import', () => ({ value: [cad.importStep(text)] }));
  else {
    const json = JSON.parse(text), doc = json.input?.partDocument ?? json;
    expect = json.expect;
    if (expect?.error) {
      stage('evaluate', () => {
        try { cad.evaluateCadPart(doc); } catch (cause) {
          const ok = cause.code === expect.error.code && String(cause.message).includes(expect.error.messageIncludes);
          return ok ? { status: 'OK', detail: 'refused as expected' } : { status: classifyError(cause) === 'CRASH' ? 'CRASH' : 'WRONG', detail: errorDetail(cause) };
        }
        return { status: 'WRONG', detail: `expected ${expect.error.code}, evaluated without error` };
      });
      return rows;
    }
    // (A case that expects outputs and is refused is WRONG: the refusal is not acceptable there.)
    bodies = stage('evaluate', () => {
      try { return { value: cad.evaluateCadPart(doc).outputs }; }
      catch (cause) { if (expect?.outputs && classifyError(cause) === 'REFUSED') return { status: 'WRONG', detail: `refused: ${errorDetail(cause)}` }; throw cause; }
    });
  }
  if (!bodies) return rows;
  const results = [];
  bodies.forEach((b, k) => {
    const brep = b.brep ?? b, suffix = bodies.length > 1 ? `#${k}` : '', crescent = crescentContacts(brep);
    const report = stage(`validate${suffix}`, () => {
      // (The strict L0 checks: an output's own validate(), or checkBrep strict for an imported body.)
      const r = b.validate ? b.validate() : cad.checkBrep(brep, { strict: true }), cap = gapCap(sizeOf(brep));
      if (!r.valid) return crescent && crescentIssues(brep, r.issues, crescent) ? { status: 'KNOWN', detail: `KNOWN-CRESCENT (D195): ${r.issues[0]}`, value: r } : { status: 'INVALID', detail: r.issues.slice(0, 3).join('; ') };
      if (r.maximumVertexGapMM > cap || r.maximumPcurveGapMM > cap) return { status: 'TOL_BLOWUP', detail: `vertex gap ${r.maximumVertexGapMM}, pcurve gap ${r.maximumPcurveGapMM}, cap ${cap}` };
      return { value: r };
    });
    const mass = stage(`mass${suffix}`, () => {
      const m = cad.brepMassProperties(brep, 1);
      if (![m.volumeMM3, ...m.centroidMM].every(Number.isFinite)) return { status: 'CRASH', detail: `not finite: ${m.volumeMM3} ${m.centroidMM}` };
      return { value: m };
    });
    stage(`tessellate${suffix}`, () => {
      const mesh = cad.tessellateBrep(brep, { segmentsPerQuarter: 8 });
      if (!mesh.positionsMM.every(Number.isFinite)) return { status: 'CRASH', detail: 'a position is not finite' };
      // (Watertight body by body: separate bodies that touch share positions without sharing edges.)
      const open = openEdgesByBody(brep, mesh);
      if (open && crescent && crescentMesh(brep, mesh, crescent)) return { status: 'KNOWN', detail: `KNOWN-CRESCENT (D195): ${open} edges used four times, along the tangent line` };
      return open ? { status: 'INVALID', detail: `${open} edges not used exactly twice` } : {};
    });
    // STEP out and back in: volume, area and centroid to 1e-6, the same topology (L1 round trip). (The volume
    // to 1e-12 mm³ at least: a sliver's volume is known absolutely, D25.) A mesh body goes out tessellated (AP242,
    // its faces kept) for the topology; its planar fallback for older readers (D48) writes each polyline edge's
    // segments as edges of their own, so it is held to the same volume, area and centroid only (D50).
    if (report && mass) stage(`roundtrip${suffix}`, () => {
      // (A body mixing mesh and exact faces, F2, goes out as a mesh body, its exact faces sampled: held to the
      // sampling, 1e-3, its topology not compared — D52.)
      const faceted = brep.faces.some(cad.isFacetFace), mixed = faceted && !brep.faces.every(cad.isFacetFace), size = sizeOf(brep), a0 = cad.brepSurfaceArea(brep), rel = mixed ? 1e-3 : 1e-6;
      const counts = x => JSON.stringify(x.topology.map(t => [t.vertices, t.edges, t.faces, t.shells, t.genus]));
      for (const meshes of mixed ? ['tessellated'] : faceted ? ['tessellated', 'planar'] : [undefined]) {
        const back = cad.importStep(cad.exportStep(brep, { name: 'rb', timestamp: '2026-01-01T00:00:00', ...(meshes ? { meshes } : {}) })), m = cad.brepMassProperties(back, 1);
        const a1 = cad.brepSurfaceArea(back), r = cad.checkBrep(back, { strict: true }), how = meshes ? ` (${meshes})` : '';
        const known = !r.valid && crescent && crescentIssues(back, r.issues, crescentContacts(back, true) ?? crescent);
        if (!r.valid && !known) return { status: 'INVALID', detail: `re-imported${how}: ${r.issues[0]}` };
        if (Math.abs(m.volumeMM3 - mass.volumeMM3) > Math.max(rel * Math.abs(mass.volumeMM3), 1e-12)) return { status: 'WRONG', detail: `volume${how} ${mass.volumeMM3} → ${m.volumeMM3}` };
        if (Math.abs(a1 - a0) > rel * a0) return { status: 'WRONG', detail: `area${how} ${a0} → ${a1}` };
        if (Math.hypot(...[0, 1, 2].map(k => m.centroidMM[k] - mass.centroidMM[k])) > rel * size) return { status: 'WRONG', detail: `centroid${how} ${mass.centroidMM} → ${m.centroidMM}` };
        if (meshes !== 'planar' && !mixed && counts(report) !== counts(r)) return { status: 'WRONG', detail: `topology${how} ${counts(report)} → ${counts(r)}` };
      }
      return {};
    });
    // An incoming STEP's own validation properties (CAx-IF) against what was read.
    if (isStep && mass) stage('gvp', () => {
      const g = cad.stepValidationProperties(text);
      if (g.volumeMM3 === undefined && g.areaMM2 === undefined && g.centroidMM === undefined) return { detail: 'no validation properties' };
      const mesh = cad.tessellateBrep(brep, { segmentsPerQuarter: 16 }), P = mesh.positionsMM, lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], P[i + k]); hi[k] = Math.max(hi[k], P[i + k]); }
      const c = cad.compareValidationProperties(g, { volumeMM3: mass.volumeMM3, areaMM2: cad.brepSurfaceArea(brep), centroidMM: mass.centroidMM, box: { min: lo, max: hi } });
      return c.ok ? {} : { status: 'WRONG', detail: ['volume', 'area', 'centroid'].filter(k => c[k] && !c[k].ok).map(k => `${k} off by ${c[k].difference.toExponential(2)} (limit ${c[k].limit.toExponential(2)})`).join('; ') };
    });
    results.push({ report, mass, bodyCount: b.bodyCount ?? brep.bodies.length, brep });
  });
  if (expect?.outputs) stage('expect', () => {
    if (results.length !== expect.outputs.length) return { status: 'WRONG', detail: `${results.length} outputs, expected ${expect.outputs.length}` };
    for (let k = 0; k < results.length; k++) {
      const r = results[k], want = expect.outputs[k];
      if (!r.mass || !r.report) return { status: 'WRONG', detail: `output ${k} has no mass or report` };
      const dv = Math.abs(r.mass.volumeMM3 - want.volumeMM3.value);
      if (dv > Math.max(want.volumeMM3.relTol * Math.abs(want.volumeMM3.value), want.volumeMM3.absTol ?? 0)) return { status: 'WRONG', detail: `output ${k} volume ${r.mass.volumeMM3} vs ${want.volumeMM3.value}` };
      if (r.mass.centroidMM.some((x, i) => Math.abs(x - want.centroidMM.value[i]) > want.centroidMM.absTol)) return { status: 'WRONG', detail: `output ${k} centroid ${r.mass.centroidMM} vs ${want.centroidMM.value}` };
      // (A case may leave its body count and topology unsaid: an L4 fuzz finding knows its oracle's volume and centroid only, D188.)
      if (want.bodies !== undefined && r.bodyCount !== want.bodies) return { status: 'WRONG', detail: `output ${k} bodies ${r.bodyCount} vs ${want.bodies}` };
      const topo = JSON.stringify(r.report.topology.map(t => ({ shells: t.shells, genus: t.genus })));
      if (want.topology !== undefined && topo !== JSON.stringify(want.topology)) return { status: 'WRONG', detail: `output ${k} topology ${topo} vs ${JSON.stringify(want.topology)}` };
    }
    return {};
  });
  return rows;
}

/** A file's content hash (sha256, first 16 hex): trend rows are keyed by it. */
export const fileHash = file => createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 16);

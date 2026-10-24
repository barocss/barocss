// The v2 `query` group's part handlers (R3, moved verbatim from chat/tools.ts's runPartTool): reads of the part
// that change nothing.
import { measureBetween, measureItem, type MeasurePick } from '../../app/measure';
import { partBreps, rebuildFromScratch } from '../../engine/evaluate';
import { rebuildReport } from '../../team/rebuild';
import { datumToFace, datumWorld, readReferences } from '../references';
import { resolveEdge, resolveFace, resolveNames, type Resolved } from '../names';
import { factsOf } from '../observe';
import { draftAnalysis, interference, massProperties, section, wallThickness } from '../../analysis/analysis';
import { checkFit, cutListCsv, fitLimits, FitError, type FitLimits } from '@barocss/cad';
import { partCutList } from '../../app/cutList';
import { nestCutList } from '../../frames/nesting';
import { followedStale, staleText } from '../../frames/skeleton';
import { weldList } from '../../frames/welds';
import { beadAccounting } from '../../frames/beadAccounting';
import { type ChatState, type Evaluate, type ToolOutcome, type PartHandler, responseFormat, v3, json, describeBodies, features, fail, strings } from '../toolKit';
import { r3Signed as r3 } from '../../util/round';
import { isObj } from '../../util/guards';
import { variabilityView } from '../variability';

/** D155: a fit's limits as a result shows them (each row's deviations, sizes, table and row, estimate and source). */
export const fitView = (l: FitLimits) => ({ kind: l.kind, clearanceMin: l.clearanceMin, clearanceMax: l.clearanceMax, estimate: l.estimate,
  hole: { class: l.hole.class, nominal: l.hole.nominal, upper: l.hole.upper, lower: l.hole.lower, min: l.hole.min, max: l.hole.max, table: l.hole.table, row: l.hole.row, estimate: l.hole.estimate, ...(l.hole.source ? { source: l.hole.source } : {}) },
  shaft: { class: l.shaft.class, nominal: l.shaft.nominal, upper: l.shaft.upper, lower: l.shaft.lower, min: l.shaft.min, max: l.shaft.max, table: l.shaft.table, row: l.shaft.row, estimate: l.shaft.estimate, ...(l.shaft.source ? { source: l.shaft.source } : {}) } });

async function getPartSummaryTool(state: ChatState, args: Record<string, unknown>): Promise<ToolOutcome> {
  // Big parts (lofted figures) have hundreds of faces: list them for one body at a time, the rest by count.
  const only = typeof args.body === 'string' ? args.body : null;
  if (only && !state.bodies.some(b => b.key === only)) return fail(state, `No body "${only}"; bodies: ${state.bodies.map(b => b.key).join(', ') || 'none'}.`);
  const many = state.bodies.reduce((n, b) => n + b.mesh.faces.length + b.mesh.edges.length, 0) > 160, page = Math.max(1, Math.floor(Number(args.page) || 1));
  const list = describeBodies(state.doc, state.bodies, false).map((b, i) => responseFormat !== 'concise' && (only === b.key || (!only && (!many || responseFormat === 'detailed'))) ? describeBodies(state.doc, [state.bodies[i]], true, 60, page)[0] : b);
  const stale = followedStale(state.doc);
  const body = { feature_count: state.doc.nodes.length, facts: factsOf(state.doc, state.bodies), parameters: state.doc.parameters,
    features: features(state.doc).map(f => responseFormat === 'concise' ? { index: f.index, label: f.label } : { ...f, node: f.node.kind === 'sketch' ? { kind: 'sketch', profile: f.node.profile } : f.node }),
    bodies: list, ...(many && !only ? { note: 'Faces and edges are listed per body: call again with {"body": key}.' } : {}),
    // (FRf2, O125: frames following a placed part's sketch that changed since linked — current geometry, to relink.)
    ...(stale.length ? { followed_changed: stale.map(x => ({ frame: x.frame, part: x.part, sketch: x.sketch, was: x.was, now: x.now, message: staleText(x) })) } : {}),
    // (O11: the assembly's inputs, its variants and the active one — the master is what the tools edit.)
    ...(state.doc.variability ? { variability: variabilityView(state.doc.variability) } : {}) };
  return { state, content: json(body), isError: false, changed: false, summary: `${state.doc.nodes.length} features, ${state.bodies.length} bod${state.bodies.length === 1 ? 'y' : 'ies'}` };
}
async function measureTool(state: ChatState, args: Record<string, unknown>): Promise<ToolOutcome> {
  // (A datum against a face, A6.3: "a" a datum id, "b" a face of the part.)
  if (typeof args.a === 'string' && /^D\d+$/.test(args.a)) {
    const set = readReferences(state.doc.references), d0 = set.datums.find(x => x.id === args.a);
    if (!d0) return fail(state, `No datum ${args.a}; datums: ${set.datums.map(x => x.id).join(', ') || 'none'}.`);
    const r = args.b === undefined ? 'measure takes the datum and a face of the part ("b")' : resolveFace(state.doc.nodes, state.bodies, args.b);
    if (typeof r === 'string') return fail(state, r);
    if (r.length !== 1) return fail(state, `${JSON.stringify(args.b)} is ${r.length} faces; measure takes one.`);
    const f = resolveNames(state.bodies, { faces: [r[0]] }).selection.faces[0];
    if (!f) return fail(state, `No face ${r[0]} on the part.`);
    const m = datumToFace(datumWorld(set, d0), state.bodies[f.body].mesh, f.face);
    return { state, content: json({ label: `${args.a} to ${r[0]}`, distance: Number(m.distance.toPrecision(12)), ...(m.angle !== null ? { angle_deg: Number(m.angle.toPrecision(9)) } : {}), what: m.what }), isError: false, changed: false, summary: `${args.a} to ${r[0]}` };
  }
  const names: string[] = [], resolved: Resolved[] = [];
  for (const s of [args.a ?? '', ...(args.b === undefined ? [] : [args.b])]) {
    const r = isObj(s) && 'between' in s ? resolveEdge(state.doc.nodes, state.bodies, s) : resolveFace(state.doc.nodes, state.bodies, typeof s === 'string' || isObj(s) ? s : String(s));
    if (typeof r === 'string') return fail(state, r);
    if (r.length !== 1) return fail(state, `${JSON.stringify(s)} is ${r.length} faces; measure takes one.`);
    names.push(r[0]); if (typeof s !== 'string') resolved.push({ selector: s, names: r });
  }
  const picks: { body: number; pick: MeasurePick }[] = [];
  for (const n of names) {
    const { selection } = resolveNames(state.bodies, { faces: [n] });
    const e = selection.faces[0] ? null : resolveNames(state.bodies, { edges: [n] }).selection.edges[0];
    const f = selection.faces[0];
    if (f) picks.push({ body: f.body, pick: { body: f.body, face: f.face } });
    else if (e) picks.push({ body: e.body, pick: { body: e.body, edge: e.edge } });
    else return fail(state, `No face or edge named "${n}".`);
  }
  const mesh = (i: number) => state.bodies[picks[i].body].mesh;
  const out = picks.length === 1 ? measureItem(mesh(0), picks[0].pick) : (() => {
    const m = measureBetween(mesh(0), picks[0].pick, mesh(1), picks[1].pick);
    return { distance: r3(m.distance), from: v3(m.a), to: v3(m.b), ...(m.angle === undefined ? {} : { angle_deg: r3(m.angle) }), ...(m.normalDistance === undefined ? {} : { normal_distance: r3(m.normalDistance) }) };
  })();
  return { state, content: json(resolved.length ? { ...out, resolved } : out), isError: false, changed: false, summary: json(out) };
}
async function weldListTool(state: ChatState): Promise<ToolOutcome> {
  // (FRd1, O118: read only — each joint, its seam from the geometry and its weld, the person's or the rule's.)
  const w = weldList(state.doc, state.bodies);
  if (!w.joints.length && !w.orphaned.length) return fail(state, 'The part has no weld joints: frame members meeting at a corner, a butt or a face.');
  return { state, content: json({ joints: w.joints.map((j, k) => ({ label: `W${k + 1}`, ...j })), totals: w.totals, orphaned: w.orphaned, notes: w.notes }), isError: false, changed: false, summary: `${w.totals.count} welds, ${w.totals.seamMM} mm of seam` };
}
async function fitClearanceTool(state: ChatState, args: Record<string, unknown>): Promise<ToolOutcome> {
  // (D155: a hole and a shaft — two faces with their classes, or two classes at a size — their limits from the user's
  // tables and, for faces, the pair at MMC and LMC by the kernel's checkFit. Read only; a class with no row says what to load.)
  const tables = state.doc.fits?.tables ?? [];
  try {
    if (typeof args.hole === 'string' && typeof args.shaft === 'string') {
      const classOfFace = (f: string) => state.doc.fits?.faces?.find(x => x.face === f || x.face === f.replace(/#\d+$/, ''))?.class;
      const hc = typeof args.hole_class === 'string' ? args.hole_class : classOfFace(args.hole), sc = typeof args.shaft_class === 'string' ? args.shaft_class : classOfFace(args.shaft);
      if (!hc || !sc) return fail(state, `[FIT_FACE] ${!hc ? args.hole : args.shaft} carries no tolerance class: give hole_class / shaft_class, or set the face's class first.`);
      const breps = partBreps(state.doc), find = (name: string) => { for (const b of breps) { const f = b.brep.faces.find(x => x.name === name) ?? b.brep.faces.find(x => x.name?.replace(/#\d+$/, '') === name); if (f) return { brep: b.brep, face: f.id }; } return null; };
      const h = find(args.hole), sh = find(args.shaft);
      if (!h || !sh) return fail(state, `[FIT_FACE] no face ${!h ? args.hole : args.shaft} on the part (names from query.summary).`);
      const c = checkFit(tables, { ...h, class: hc }, { ...sh, class: sc });
      return { state, content: json({ ...fitView(c.limits), offset: c.offset, length: c.length, margin: c.margin, mmc: c.mmc, lmc: c.lmc, contradicted: c.contradicted, message: c.message }), isError: false, changed: false, summary: `${hc}/${sc}: ${c.limits.kind}, ${c.limits.clearanceMin} … ${c.limits.clearanceMax} mm` };
    }
    if (typeof args.hole_class === 'string' && typeof args.shaft_class === 'string' && typeof args.size === 'number') {
      const l = fitLimits(tables, args.hole_class, args.shaft_class, args.size);
      return { state, content: json(fitView(l)), isError: false, changed: false, summary: `${args.hole_class}/${args.shaft_class} at Ø${args.size}: ${l.kind}` };
    }
    return fail(state, 'Give hole and shaft (faces; their classes, or hole_class and shaft_class), or hole_class, shaft_class and size (mm).');
  } catch (e) { if (e instanceof FitError) return fail(state, e.message); throw e; }
}
async function massPropertiesTool(state: ChatState, args: Record<string, unknown>): Promise<ToolOutcome> {
  const keys = strings(args.bodies), shown = keys.length ? state.bodies.filter(b => keys.includes(b.key)) : state.bodies;
  if (keys.length && shown.length !== keys.length) return fail(state, `No body ${keys.filter(k => !state.bodies.some(b => b.key === k)).join(', ')} (bodies: ${state.bodies.map(b => b.key).join(', ')}).`);
  const out = massProperties(state.doc, shown);
  const accounting = beadAccounting(state.doc, state.bodies);
  return { state, content: json({ bodies: out, ...(accounting ? { beadAccounting: accounting } : {}), ...(out.some(b => b.assumed) ? { note: 'a body without a material is taken as aluminium: set its material before using its mass' } : {}) }), isError: false, changed: false, summary: `${accounting && !accounting.complete ? 'incomplete welded-part accounting; ' : ''}mass of ${out.length} reported bodies` };
}
/** O10: the part built from nothing, each feature timed (the studio's Rebuild panel shows the last evaluation instead). */
async function rebuildReportTool(state: ChatState): Promise<ToolOutcome> {
  const report = rebuildReport(state.doc, rebuildFromScratch(state.doc, 0), { basis: 'from scratch' });
  if (!report) return fail(state, 'The part does not evaluate, so it has no rebuild to report.');
  return { state, content: json(report), isError: false, changed: false, summary: `${report.built} features built in ${(report.builtTime * 1000).toFixed(1)} ms (${(report.evaluationTime * 1000).toFixed(0)} ms in all)${report.loops.length ? `; ${report.loops.length} mate loop${report.loops.length === 1 ? '' : 's'}` : ''}` };
}
async function interferenceTool(state: ChatState, args: Record<string, unknown>, evaluate: Evaluate): Promise<ToolOutcome> {
  const out = await interference(state.doc, state.bodies, evaluate, strings(args.bodies));
  return { state, content: json({ pairs: out, note: 'overlap by the kernel; clearance on the display mesh (to its chord error on curved faces)' }), isError: false, changed: false, summary: `${out.length} pairs` };
}
async function sectionTool(state: ChatState, args: Record<string, unknown>, evaluate: Evaluate): Promise<ToolOutcome> {
  const axis = String(args.axis), at = Number(args.at);
  if (!['x', 'y', 'z'].includes(axis) || !Number.isFinite(at)) return fail(state, 'A section takes an axis (x, y or z) and where along it (at, mm).');
  const out = await section(state.doc, state.bodies, evaluate, axis as 'x' | 'y' | 'z', at);
  if (typeof out === 'string') return fail(state, out);
  return { state, content: json({ axis, at, cut: out }), isError: false, changed: false, summary: `section ${axis} = ${at}` };
}
async function wallThicknessOrDraft(name: string, state: ChatState, args: Record<string, unknown>): Promise<ToolOutcome> {
  const b = state.bodies.find(x => x.key === String(args.body)) ?? (state.bodies.length === 1 && args.body === undefined ? state.bodies[0] : undefined);
  if (!b) return fail(state, `Which body? ${state.bodies.map(x => x.key).join(', ')}`);
  if (name === 'wall_thickness') {
    const out = wallThickness(b, args.below === undefined ? undefined : Number(args.below));
    return { state, content: json({ ...out, note: 'on the display mesh: good to its chord error on curved walls' }), isError: false, changed: false, summary: `wall of ${b.key}` };
  }
  const pull = Array.isArray(args.pull) && args.pull.length === 3 ? args.pull.map(Number) as [number, number, number] : [0, 0, 1] as [number, number, number];
  const out = draftAnalysis(state.doc, b, pull, args.min_deg === undefined ? 1 : Number(args.min_deg));
  return { state, content: json(out), isError: false, changed: false, summary: `draft of ${b.key}` };
}
const wallThicknessTool = (state: ChatState, args: Record<string, unknown>) => wallThicknessOrDraft('wall_thickness', state, args);
const draftTool = (state: ChatState, args: Record<string, unknown>) => wallThicknessOrDraft('draft', state, args);
async function cutListTool(state: ChatState, args: Record<string, unknown>): Promise<ToolOutcome> {
  // (FR4a, D127: read only; the bodies' own materials, else the part's default.)
  const list = partCutList(state.doc, state.bodies);
  if (!list) return fail(state, 'The part has no frame members: make a frame (add_features kind "frame") or a structural member first.');
  // (FRb, O116: with stock lengths loaded, the pieces nested into them; else the result says how to load them.)
  const rows = list.rows.map(r => ({ ...r, names: r.pieces.map(k => list.names[k] ?? k) })), nest = nestCutList(state.doc, list);
  const nesting = nest.ok ? nest.nesting : { error: `[${nest.code}] ${nest.message}` };
  return { state, content: json({ rows, totals: list.totals, densities: 'estimates (the materials library\'s)', nesting, ...(args.csv === true ? { csv: cutListCsv(list) } : {}) }), isError: false, changed: false, summary: `${list.totals.quantity} pieces in ${list.rows.length} rows${nest.ok ? `; ${nest.nesting.totals.bars} bars, ${nest.nesting.totals.waste} mm waste` : ''}` };
}

/** The query group's handlers, by v1 tool name (R3). */
export const QUERY_HANDLERS: Readonly<Record<string, PartHandler>> = { get_part_summary: getPartSummaryTool, measure: measureTool, weld_list: weldListTool, fit_clearance: fitClearanceTool, mass_properties: massPropertiesTool, rebuild_report: rebuildReportTool, interference: interferenceTool, section: sectionTool, wall_thickness: wallThicknessTool, draft: draftTool, cut_list: cutListTool };

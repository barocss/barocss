import { readConnector, type Connector } from '../assembly/connectors';
// Chat tools for assemblies: parts as instances (each its own feature tree, built with the part tools
// by passing `part`), their placement and grounding, and mates solved by the studio's own solver
// (src/assembly/mates.ts) with its exact refusals. The assembly is re-solved after every change, as the
// studio does, so mated parts follow edits of the parts they are mated to.
import { checkPartDelete } from '../frames/skeleton';
import { firstProblem } from '../engine/refusal';
import { tslotInterfaces } from '../frames/interfaces';
import type { PartInstance, StudioDoc } from '../engine/doc';
import type { BodyResult, EvalResult } from '../engine/evaluate';
import { tableOf, withDatums } from '../assembly/faces';
import { BASE, KIND_LABEL, mateLabel, type FaceTable, type MateFace, type MateKind, type Vec3 } from '../assembly/mates';
import { rotationMatrix } from '../engine/placement';
import type { ToolDefinition } from './api';
import { addDocLibrary, addLibraryPartToBody, libraries, libraryInstance, registerDocLibraries, snapByInterfaces } from '../library/libraries';
import { faceTableOf } from '../assembly/faces';
import { printability } from '../print/rules';
import { orientPart, type OrientationScore } from '../print/orient';
import { processProfile } from '../library/materials';
import { UNLICENSED } from '../library/sharing';
import { r3Signed as r3 } from '../util/round';
import { isObj, isVec3 } from '../util/guards';
import { boundsOf } from '../engine/bounds';
import { runVariabilityTool, VARIABILITY_TOOLS } from './variability';
import { addMate, lockPart, addPart, ASSEMBLY_CODES, editMate, partCopy, placePart, solveDoc, type Edited, type Mated } from '../assembly/edit';
import { isRefusal } from '../engine/refusal';

type Evaluate = (doc: StudioDoc) => Promise<EvalResult | null>;
interface State { doc: StudioDoc; bodies: BodyResult[] }
export interface AssemblyOutcome { doc: StudioDoc; content: string; isError: boolean; changed: boolean; summary: string }

const json = (v: unknown) => JSON.stringify(v);
const fail = (doc: StudioDoc, error: string, extra: Record<string, unknown> = {}): AssemblyOutcome => ({ doc, content: json({ ok: false, error, ...extra }), isError: true, changed: false, summary: error });


/** A part's own bounds turned and moved into place (its box's corners). */
function placedBounds(inst: PartInstance, min: Vec3, max: Vec3) {
  const R = rotationMatrix(inst.rotation), lo: Vec3 = [Infinity, Infinity, Infinity], hi: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (let c = 0; c < 8; c++) {
    const p = [c & 1 ? max[0] : min[0], c & 2 ? max[1] : min[1], c & 4 ? max[2] : min[2]];
    const w = [0, 1, 2].map(i => R[i * 3] * p[0] + R[i * 3 + 1] * p[1] + R[i * 3 + 2] * p[2] + inst.position[i]);
    w.forEach((v, i) => { lo[i] = Math.min(lo[i], v); hi[i] = Math.max(hi[i], v); });
  }
  return { min: lo.map(r3), max: hi.map(r3) };
}

/** The mateable faces of a part: flat ones (normal), round ones (axis, radius), spheres, cones, then straight and circular edges (O24 c), in its own coordinates. */
function mateFaces(table: FaceTable, cap = 40) {
  const entries = Object.entries(table);
  const list = entries.slice(0, cap).map(([name, f]) => mateFaceListed(name, f));
  return entries.length > cap ? { faces: list, more: entries.length - cap } : { faces: list };
}
function mateFaceListed(name: string, f: MateFace) {
  switch (f.kind) {
    case 'plane': return { name, kind: 'flat', normal: f.normal.map(r3), point: f.point.map(r3) };
    case 'cylinder': return { name, kind: f.outer ? 'round (outer: shaft, pin)' : 'round (inner: hole, bore)', axis: f.axis.map(r3), through: f.point.map(r3), radius: r3(f.radius) };
    case 'sphere': return { name, kind: f.outer ? 'sphere (outer: ball)' : 'sphere (inner: socket)', centre: f.point.map(r3), radius: r3(f.radius) };
    case 'cone': return { name, kind: f.outer ? 'cone (outer)' : 'cone (inner: countersink, seat)', apex: f.point.map(r3), axis: f.axis.map(r3), half_angle: r3(f.half * 180 / Math.PI) };
    case 'line': return { name, kind: 'straight edge', from: f.point.map(r3), direction: f.axis.map(r3), length: r3(f.length) };
    case 'circle': return { name, kind: f.ends ? 'circular edge (arc)' : 'circular edge', centre: f.point.map(r3), normal: f.axis.map(r3), radius: r3(f.radius) };
  }
}

/** FRe (O120): a part's T-slot frame members' interfaces, for snap_part (`<body>.<id>`: role ⇄ what it accepts). */
function memberInterfaceList(bodies: readonly BodyResult[]): { member_interfaces?: string[] } {
  const out: string[] = [];
  for (const b of bodies) for (const i of tslotInterfaces(b) ?? []) out.push(`${b.key}.${i.id} (${i.role} ⇄ ${i.accepts?.join(', ') ?? 'nothing'})`);
  return out.length ? { member_interfaces: out } : {};
}

async function describe(doc: StudioDoc, base: BodyResult[], evaluate: Evaluate, detail: string | null) {
  const instances = await Promise.all((doc.instances ?? []).map(async inst => {
    const r = await evaluate(inst.doc), bodies = r?.ok ? r.bodies : [];
    const { min, max } = boundsOf(bodies);
    return {
      id: inst.id, name: inst.name, position: inst.position.map(r3), rotation_deg: inst.rotation.map(r3), ...(inst.grounded ? { grounded: true } : {}), ...(inst.hidden ? { hidden: true } : {}),
      feature_count: inst.doc.nodes.length, bodies: bodies.length, volume: r3(bodies.reduce((s, b) => s + (b.volume ?? 0), 0)),
      ...(bodies.length ? { world_bounds: placedBounds(inst, min, max) } : {}),
      ...(r && !r.ok ? { error: r.error.title } : {}),
      ...memberInterfaceList(bodies),
      ...(detail === inst.id ? mateFaces(tableOf(inst.doc)) : {}),
    };
  }));
  const mates = doc.mates ?? [];
  const solved = solveDoc(doc).problems;
  return {
    base: { id: BASE, feature_count: doc.nodes.length, bodies: base.length, volume: r3(base.reduce((s, b) => s + (b.volume ?? 0), 0)), note: 'the document\'s own part, fixed at the origin', ...memberInterfaceList(base), ...(detail === BASE ? mateFaces(withDatums(tableOf(doc), doc)) : {}) },
    instances,
    mates: mates.map((m, i) => ({ id: m.id, label: mateLabel(m, i), kind: m.kind, a: m.a, b: m.b, ...(m.distance !== undefined ? { distance: m.distance } : {}), ...(m.angle !== undefined ? { angle: m.angle } : {}), ...(m.flip ? { flip: true } : {}) })),
    ...(solved.length ? { problems: solved } : {}),
    ...(detail ? {} : { note: 'mateable faces of one part: get_assembly {"faces_of": part id or "base"}' }),
  };
}

const vec3 = (v: unknown): [number, number, number] | null => isVec3(v) ? v : null;

async function changed(doc: StudioDoc, next: StudioDoc, what: string, base: BodyResult[], evaluate: Evaluate, extra: Record<string, unknown> = {}): Promise<AssemblyOutcome> {
  const s = solveDoc(next, doc.instances);
  const parts = (s.doc.instances ?? []).map(i => ({ id: i.id, name: i.name, position: i.position.map(r3), rotation_deg: i.rotation.map(r3), ...(i.grounded ? { grounded: true } : {}) }));
  return {
    doc: s.doc, isError: false, changed: true, summary: `${what}${s.problems.length ? ` (${s.problems.length} unmet mate${s.problems.length > 1 ? 's' : ''})` : ''}`,
    content: json({ ok: true, did: what, ...extra, parts, ...(s.problems.length ? { unmet_mates: s.problems } : {}) }),
  };
}

/** An edit the core solved already (assembly/edit.ts), reported as changed() reports one. */
function reported(doc: StudioDoc, r: Edited, what: string, extra: Record<string, unknown> = {}): AssemblyOutcome {
  const parts = (r.doc.instances ?? []).map(i => ({ id: i.id, name: i.name, position: i.position.map(r3), rotation_deg: i.rotation.map(r3), ...(i.grounded ? { grounded: true } : {}) }));
  return {
    doc: r.doc, isError: false, changed: true, summary: `${what}${r.problems.length ? ` (${r.problems.length} unmet mate${r.problems.length > 1 ? 's' : ''})` : ''}`,
    content: json({ ok: true, did: what, ...extra, parts, ...(r.problems.length ? { unmet_mates: r.problems } : {}) }),
  };
}

export const ASSEMBLY_TOOL_NAMES = new Set(['get_assembly', 'add_part', 'place_part', 'delete_part', 'add_mate', 'edit_mate', 'lock_part', 'delete_mate', 'list_library', 'insert_part', 'snap_part', 'add_library', 'add_library_part', 'check_printability', 'orient_for_print', 'set_inputs', 'set_variants']);

export async function runAssemblyTool(state: State, name: string, args: Record<string, unknown>, evaluate: Evaluate): Promise<AssemblyOutcome> {
  const doc = state.doc, instances = doc.instances ?? [], mates = doc.mates ?? [];
  const byId = (id: unknown) => instances.find(i => i.id === id);
  const partList = () => [BASE, ...instances.map(i => i.id)].join(', ');
  switch (name) {
    case 'get_assembly': {
      const detail = args.faces_of === undefined ? null : String(args.faces_of);
      if (detail && detail !== BASE && !byId(detail)) return fail(doc, `No part "${detail}"; parts: ${partList()}.`);
      const out = await describe(doc, state.bodies, evaluate, detail);
      return { doc, content: json(out), isError: false, changed: false, summary: `${instances.length} parts, ${mates.length} mates` };
    }
    case 'add_part': {
      const label = typeof args.name === 'string' && args.name.trim() ? args.name.trim() : null;
      if (!label) return fail(doc, '"name" is required (e.g. "Shaft").');
      try {
        const copy = args.copy_of !== undefined ? partCopy(doc, String(args.copy_of)) : undefined;
        const r = addPart(doc, { name: label, ...(copy ? { doc: copy } : {}), position: vec3(args.position) ?? [0, 0, 0], rotation: vec3(args.rotation) ?? [0, 0, 0], grounded: !!args.grounded });
        return reported(doc, r, `added part ${r.id} "${label}"${args.copy_of !== undefined ? ` (a copy of ${String(args.copy_of)})` : ''}`,
          { part: r.id, note: copy?.nodes.length ? 'build or edit it with the part tools and "part": id' : 'empty: build it with run_command / add_features and "part": id (its own coordinates; place it with place_part or mates)' });
      } catch (e) { if (isRefusal(e, ...ASSEMBLY_CODES)) return fail(doc, e.message); throw e; }
    }
    case 'place_part': {
      const inst = byId(args.part);
      const position = args.position === undefined ? undefined : vec3(args.position), rotation = args.rotation === undefined ? undefined : vec3(args.rotation);
      if (inst && (position === null || rotation === null)) return fail(doc, '"position" and "rotation" are [x, y, z] (mm; degrees about X, then Y, then Z).');
      try {
        const next = placePart(doc, { part: String(args.part), ...(position ? { position } : {}), ...(rotation ? { rotation } : {}), ...(typeof args.name === 'string' && args.name.trim() ? { name: args.name.trim() } : {}),
          ...(args.grounded === undefined ? {} : { grounded: !!args.grounded }), ...(args.hidden === undefined ? {} : { hidden: !!args.hidden }) });
        const by = mates.filter(m => m.b.part === inst!.id);
        return reported(doc, next, `placed ${inst!.id}`,
          by.length && (args.position !== undefined || args.rotation !== undefined) ? { note: `${by.length} mate${by.length > 1 ? 's' : ''} still place it: the solver keeps what they fix and moves it only where they leave it free` } : {});
      } catch (e) { if (isRefusal(e, ...ASSEMBLY_CODES)) return fail(doc, e.message); throw e; }
    }
    case 'delete_part': {
      const inst = byId(args.part);
      if (!inst) return fail(doc, `No part "${String(args.part)}"; parts: ${instances.map(i => i.id).join(', ') || 'none'}.`);
      // (FRf2, O125: a part whose sketch a base frame follows stays.)
      const held = firstProblem(checkPartDelete(doc, inst.id));
      if (held) return fail(doc, held);
      const kept = mates.filter(m => m.a.part !== inst.id && m.b.part !== inst.id);
      return changed(doc, { ...doc, instances: instances.filter(i => i !== inst), mates: kept }, `deleted ${inst.id} "${inst.name}"${kept.length < mates.length ? ` and ${mates.length - kept.length} mate${mates.length - kept.length > 1 ? 's' : ''} on it` : ''}`, state.bodies, evaluate);
    }
    case 'add_mate': case 'edit_mate': {
      let r: Mated;
      try {
        if (name === 'add_mate') {
          const ref = (v: unknown) => isObj(v) && typeof v.part === 'string' && typeof v.face === 'string' ? { part: v.part, face: v.face, ...(v.at !== undefined ? { at: readConnector(v.at) } : {}) } : null;
          const a = ref(args.a), b = ref(args.b);
          if (KIND_LABEL[String(args.kind) as MateKind] && (!a || !b)) return fail(doc, '"a" and "b" are {part, face}: part "base" or an instance id, face a persistent face name (or origin:xy / origin:xz / origin:yz, or datum:<id> on the base part).');
          r = addMate(doc, { kind: String(args.kind) as MateKind, a: a!, b: b!, ...(args.distance !== undefined ? { distance: Number(args.distance) } : {}), ...(args.angle !== undefined ? { angle: Number(args.angle) } : {}), ...(typeof args.flip === 'boolean' ? { flip: args.flip } : args.flip && String(args.kind) !== 'concentric' ? { flip: true } : {}) });
        } else r = editMate(doc, { id: String(args.id), ...(args.connectors !== undefined ? { connectors: args.connectors as { a?: Connector | null; b?: Connector | null } } : {}), ...(args.distance !== undefined ? { distance: Number(args.distance) } : {}), ...(args.angle !== undefined ? { angle: Number(args.angle) } : {}), ...(typeof args.flip === 'boolean' ? { flip: args.flip } : {}) });
      } catch (e) {
        if (!isRefusal(e, ...ASSEMBLY_CODES)) throw e;
        // (The tool's own hints after the core's words: where the faces are listed; that nothing was kept.)
        if (e.code === 'MATE_FACE_UNKNOWN') return fail(doc, `${e.message}. List mateable faces with get_assembly {"faces_of": part}.`);
        if (e.code === 'MATE_UNMET') return fail(doc, e.message, { kept: 'the assembly is unchanged' });
        return fail(doc, e.message);
      }
      const list = r.doc.mates!, moved = r.doc.instances!.find(i => i.id === r.mate.b.part)!;
      return reported(doc, r, `${name === 'add_mate' ? 'added' : 'edited'} ${mateLabel(r.mate, list.findIndex(m => m.id === r.mate.id))} (${r.mate.id}): ${r.mate.b.part}.${r.mate.b.face} to ${r.mate.a.part}.${r.mate.a.face}`,
        { mate: r.mate.id, moved: { part: moved.id, position: moved.position.map(r3), rotation_deg: moved.rotation.map(r3) }, freedom_left: r.freedom });
    }
    case 'lock_part': {
      // (PG-8: the studio's Lock — a part fixed to another where they stand.)
      if (typeof args.part !== 'string' || typeof args.to !== 'string') return fail(doc, '"part" and "to" are part ids ("base" or an instance id): part is locked to to where they stand.');
      let r: Mated;
      try { r = lockPart(doc, { part: args.part, to: args.to }); } catch (e) { if (!isRefusal(e, ...ASSEMBLY_CODES)) throw e; return fail(doc, e.message, e.code === 'MATE_UNMET' ? { kept: 'the assembly is unchanged' } : {}); }
      return reported(doc, r, `locked ${r.mate.b.part} to ${r.mate.a.part} (${r.mate.id}) where they stand`, { mate: r.mate.id, freedom_left: r.freedom });
    }
    case 'list_library': {
      // (LIB4: what the libraries hold — read only.)
      registerDocLibraries(doc);
      const only = typeof args.library === 'string' ? args.library : null, list = libraries().filter(e => !only || e.library.manifest.id === only);
      if (only && !list.length) return fail(doc, `No library "${only}"; libraries: ${libraries().map(e => e.library.manifest.id).join(', ')}.`);
      const out = list.map(({ library: { manifest: m }, source, license, estimates, authoredBy, confirmed }) => ({
        id: m.id, name: m.name, version: m.libraryVersion, source, license: license ?? UNLICENSED, estimates, ...(authoredBy === 'agent' ? { authored_by: 'agent', confirmed } : {}), ...(m.provenance ? { provenance: m.provenance } : {}),
        parts: m.parts.map(p => ({ id: p.id, name: p.name, ...(p.category ? { category: p.category } : {}), ...(p.simplified ? { simplified: true } : {}),
          ...(p.variants?.length ? { variants: p.variants.map(v => ({ id: v.id, ...(v.name ? { name: v.name } : {}) })) } : {}),
          parameters: Object.fromEntries(Object.entries(p.parameters).filter(([, q]) => typeof q.value === 'number').map(([k, q]) => [k, { value: q.value, ...(q.unit ? { unit: q.unit } : {}), ...(q.min !== undefined ? { min: q.min } : {}), ...(q.max !== undefined ? { max: q.max } : {}), ...(q.estimate ? { estimate: true } : {}), ...(q.description ? { about: q.description } : {}) }])),
          interfaces: (p.interfaces ?? []).map(i => ({ id: i.id, role: i.role, ...(i.accepts ? { accepts: i.accepts } : {}), ...(i.when ? { when: i.when } : {}) })) })),
        ...(m.fits?.length ? { fits: m.fits.map(f => ({ id: f.id, a: f.a, b: f.b, ...(f.offset ? { offset: f.offset } : {}) })) } : {}),
      }));
      return { doc, content: json({ libraries: out, note: 'insert_part {library, part, variant?, params?} adds one as a new placed part; snap_part {a: {part, interface}, b: {part, interface}, offset?} places b onto a by their interfaces with real mates' }), isError: false, changed: false, summary: `${out.length} librar${out.length === 1 ? 'y' : 'ies'}` };
    }
    case 'insert_part': {
      if (typeof args.library !== 'string' || typeof args.part !== 'string') return fail(doc, '"library" and "part" are required (list_library lists them).');
      const params = args.params === undefined ? undefined : isObj(args.params) && Object.values(args.params).every(v => typeof v === 'number') ? args.params as Record<string, number> : null;
      if (params === null) return fail(doc, '"params" maps parameter names to numbers.');
      try {
        const r = libraryInstance(doc, args.library, args.part, { ...(typeof args.variant === 'string' ? { variant: args.variant } : {}), ...(params ? { params } : {}), ...(typeof args.name === 'string' && args.name.trim() ? { name: args.name.trim() } : {}), ...(vec3(args.position) ? { position: vec3(args.position)! } : {}), ...(vec3(args.rotation) ? { rotation: vec3(args.rotation)! } : {}) });
        const inst = r.doc.instances!.find(i => i.id === r.id)!, node = inst.doc.nodes[0] as Extract<StudioDoc['nodes'][number], { kind: 'library' }>;
        return changed(doc, r.doc, `inserted ${r.id} "${inst.name}" from ${args.library}`, state.bodies, evaluate,
          { part: r.id, interfaces: node.interfaces.map(i => ({ id: i.id, role: i.role, ...(i.accepts ? { accepts: i.accepts } : {}) })), ...(node.warnings.length ? { warnings: node.warnings } : {}) });
      } catch (cause) { return fail(doc, cause instanceof Error ? cause.message.replace(/^library: /, '') : String(cause)); }
    }
    case 'add_library': {
      // (An agent's library: data, checked as any; kept with the document, marked until a person confirms it.)
      if (!isObj(args.library)) return fail(doc, '"library" is the library\'s JSON: {format: "barocss-cad-library", version: 1, id, name, libraryVersion, units: "mm", license, parts, fits?}.');
      try {
        const r = addDocLibrary(doc, args.library, 'agent');
        return { doc: r.doc, isError: false, changed: true, summary: `added library ${String(args.library.id)} (${r.check.ok ? 'checked' : `${r.check.problems.length} problems`})`,
          content: json({ ok: true, library: args.library.id, check: r.check, license: r.license ?? UNLICENSED, estimates: r.estimates, authored_by: 'agent', note: 'kept with this document, marked as an agent\'s until a person confirms it; insert its parts with insert_part' }) };
      } catch (cause) { return fail(doc, cause instanceof Error ? cause.message.replace(/^library: /, '') : String(cause)); }
    }
    case 'add_library_part': {
      // (R6b: a library part added to a body of the base part, on a flat face at a point, as one step.)
      if (typeof args.library !== 'string' || typeof args.part !== 'string' || typeof args.face !== 'string') return fail(doc, '"library", "part" and "face" (a flat face\'s name) are required, with "point" on it.');
      const point = vec3(args.point); if (!point) return fail(doc, '"point" is [x, y, z] on the face.');
      const face = faceTableOf(doc)[args.face.replace(/#\d+$/, '')];
      if (!face || face.kind !== 'plane') return fail(doc, `"${args.face}" is not a flat face of the part.`);
      const body = state.bodies.find(b => b.ref && b.mesh.faces.some(f => f.name === args.face || f.name.replace(/#\d+$/, '') === args.face));
      if (!body?.ref) return fail(doc, `No body has the face "${args.face}".`);
      const num = (v: unknown) => isObj(v) && Object.values(v).every(x => typeof x === 'number') ? v as Record<string, number> : undefined;
      const r = addLibraryPartToBody(doc, args.library, args.part, { ...(typeof args.variant === 'string' ? { variant: args.variant } : {}), ...(num(args.params) ? { params: num(args.params) } : {}), ...(num(args.context) ? { context: num(args.context) } : {}) },
        { body: body.ref, face: args.face, point, normal: face.normal, ...(vec3(args.x_direction) ? { xDir: vec3(args.x_direction)! } : {}) });
      if ('error' in r) return fail(doc, r.error);
      return { doc: r.doc, isError: false, changed: true, summary: `added ${r.node.name} to the body on ${args.face}`,
        content: json({ ok: true, added: r.node.name, feature: r.doc.nodes.length - 1, ...(r.node.context ? { context: r.node.context } : {}), warnings: r.node.warnings }) };
    }
    case 'check_printability': {
      // (AM3, IM1, CNC1, IM8a: the manufacturability rules for the part's process — printing, moulding, machining, casting — read only.)
      const dir = vec3(args.direction);
      if (args.finish !== undefined && typeof args.finish !== 'string') return fail(doc, '"finish" is a moulding finish id.');
      const sides = args.sides === undefined ? undefined : isObj(args.sides) && Object.values(args.sides).every(v => v === '+' || v === '-') ? args.sides as Record<string, '+' | '-'> : null;
      if (sides === null) return fail(doc, '"sides" is {face name: "+" | "-"}: the half each face goes to.');
      const report = await printability(doc, state.bodies, evaluate, { ...(dir ? { direction: dir } : {}), ...(typeof args.finish === 'string' ? { finish: args.finish } : {}), ...(sides ? { sides } : {}) });
      return { doc, content: json(report), isError: false, changed: false, summary: `${report.process ?? 'no process'}: ${report.rules.filter(r => r.status === 'fail').length} failing, ${report.rules.filter(r => r.status === 'warn').length} warned` };
    }
    case 'orient_for_print': {
      // (AM4: which way up — the best of a fixed candidate set, deterministic; applied unless apply is false.)
      const r = orientPart(doc, state.bodies, faceTableOf(doc), processProfile(doc.process));
      if (typeof r === 'string') return fail(doc, r);
      const round = (o: OrientationScore) => ({ direction: o.direction.map(v => +v.toFixed(6)), score: +o.score.toFixed(6), terms: Object.fromEntries(Object.entries(o.terms).map(([k, v]) => [k, +v.toFixed(6)])), support_mm3: +(o.supportMM3 ?? 0).toFixed(3), overhang_mm2: +o.overhangMM2.toFixed(3), height_mm: +o.height.toFixed(3), contact_mm2: +o.contactMM2.toFixed(3) });
      const out = { best: round(r.best), top: r.top.map(round), candidates: r.candidates, weights: r.weights, ms: Math.round(r.ms) };
      if (args.apply === false) return { doc, content: json(out), isError: false, changed: false, summary: 'orientation scored' };
      return { doc: { ...doc, print: { direction: r.best.direction.map(v => v + 0) as [number, number, number] } }, content: json({ ...out, applied: true }), isError: false, changed: true, summary: `oriented for printing: up ${out.best.direction.join(', ')}` };
    }
    case 'snap_part': {
      const end = (v: unknown) => isObj(v) && typeof v.part === 'string' && typeof v.interface === 'string' ? { part: v.part, interface: v.interface } : null;
      const a = end(args.a), b = end(args.b), offset = args.offset === undefined ? [0, 0, 0] : vec3(args.offset);
      if (!a || !b) return fail(doc, '"a" and "b" are {part, interface}: b moves onto a (list_library and insert_part give the interfaces).');
      if (!offset) return fail(doc, '"offset" is [x, y, z] in a\'s interface frame (x along it).');
      const r = snapByInterfaces(doc, a, b, offset);
      if ('error' in r) return fail(doc, r.error);
      return changed(doc, r.doc, `snapped ${b.part}.${b.interface} onto ${a.part}.${a.interface}`, state.bodies, evaluate, { mates: r.mates.map(m => ({ id: m.id, kind: m.kind, a: m.a, b: m.b })) });
    }
    // (O11: the inputs and variants, written to the master's variability only.)
    case 'set_inputs': case 'set_variants': return runVariabilityTool(doc, name, args);
    case 'delete_mate': {
      if (!mates.some(m => m.id === args.id)) return fail(doc, `No mate "${String(args.id)}"; mates: ${mates.map(m => m.id).join(', ') || 'none'}.`);
      return changed(doc, { ...doc, mates: mates.filter(m => m.id !== args.id) }, `deleted mate ${String(args.id)} (its part stays where it is)`, state.bodies, evaluate);
    }
  }
  return fail(doc, `Unknown tool "${name}".`);
}

const connector = { type: 'object', properties: { point: { type: 'string', enum: ['centre', 'start', 'mid', 'end', 'apex'] }, offset: { type: 'array', items: { type: 'number' }, minItems: 3, maxItems: 3 }, turn: { type: 'number' }, flip: { type: 'boolean' } }, additionalProperties: false };
const ref = { type: 'object', properties: { part: { type: 'string' }, face: { type: 'string' }, at: connector }, required: ['part', 'face'], additionalProperties: false };
const end = { type: 'object', properties: { part: { type: 'string' }, interface: { type: 'string' } }, required: ['part', 'interface'], additionalProperties: false };
const xyz = { type: 'array', items: { type: 'number' }, minItems: 3, maxItems: 3 };

export const ASSEMBLY_TOOLS: ToolDefinition[] = [
  ...VARIABILITY_TOOLS,
  {
    name: 'get_assembly',
    description: 'The assembly: the base part (the document\'s own part, fixed at the origin) and every placed part (instance id, name, placement, grounded, volume, bounds in the assembly), the mates and any that cannot be met. With faces_of, also that part\'s mateable faces and edges (flat: normal; round: axis, radius, inner hole or outer shaft; sphere: centre, radius; cone: apex, axis, half-angle; straight or circular edge: direction or normal, length or radius) in its own coordinates.',
    input_schema: { type: 'object', properties: { faces_of: { type: 'string', description: 'A part id or "base".' } }, additionalProperties: false },
  },
  {
    name: 'add_part',
    description: 'Adds a separate part to the assembly (an instance with its own feature tree), empty or a copy of another part. Build it with the part tools (run_command, add_features, edit_feature, …, extrude/inflate_image_layer) by passing "part": its id; its features are in its own coordinates. Then place it with mates (preferred: they keep it right when parts change) or place_part.',
    input_schema: { type: 'object', properties: { name: { type: 'string' }, copy_of: { type: 'string', description: 'A part id or "base" to copy.' }, position: xyz, rotation: xyz, grounded: { type: 'boolean' } }, required: ['name'], additionalProperties: false },
  },
  {
    name: 'place_part',
    description: 'Moves, turns (degrees about X, then Y, then Z), renames, grounds (fixes in place: mates never move it) or hides a part. Mates on a part keep what they fix.',
    input_schema: { type: 'object', properties: { part: { type: 'string' }, position: xyz, rotation: xyz, name: { type: 'string' }, grounded: { type: 'boolean' }, hidden: { type: 'boolean' } }, required: ['part'], additionalProperties: false },
  },
  {
    name: 'delete_part',
    description: 'Removes a placed part and the mates on it.',
    input_schema: { type: 'object', properties: { part: { type: 'string' } }, required: ['part'], additionalProperties: false },
  },
  {
    name: 'add_mate',
    description: 'Places a part by its faces, solved exactly by the studio\'s mate solver; a mate that conflicts with the others is refused with the reason. "a" stays, "b" moves (swapped when b\'s part is fixed). Kinds: coincident (a straight edge on a flat face, two straight edges on one line, or two flat faces flush, facing each other; flip: facing the same way; with an origin plane the default is the same way and flip opposes them), distance (the same, `distance` mm apart), angle (two flat faces `angle` degrees apart), concentric (round faces, cones, straight or circular edges on one axis; two spheres at one centre; flip true/false sets the axis sense), tangent (a round face touching a flat or another round face, or a sphere touching a flat face), cam (a: a face of the cam part, b: its follower\'s flat face, seated on the lobe — no hold on b, whose own mates make it slide; get_joints couples its slide to the cam\'s turn by the lobe\'s lift, or to a sliding a\'s slide: a pushed valve). Faces are persistent names (from get_assembly faces_of, or part results), or a part\'s origin planes origin:xy / origin:xz / origin:yz, or the base part\'s datums datum:<id> (add_datum: a plane flat, an axis round). A reference may carry at: {point?, offset?, turn?, flip?}: select centre/start/mid/end/apex, flip local Z, turn in degrees about that Z, then offset in the resulting frame (mm). Missing centres/spans and unsupported points are refused. Connectors act as planes for coincident/distance/angle and zero-radius axes for concentric/tangent; they keep those mates\' free motions. The result says what the moved part can still do (free turns and slides).',
    input_schema: { type: 'object', properties: { kind: { type: 'string', enum: Object.keys(KIND_LABEL) }, a: ref, b: ref, distance: { type: 'number' }, angle: { type: 'number' }, flip: { type: 'boolean' } }, required: ['kind', 'a', 'b'], additionalProperties: false },
  },
  {
    name: 'lock_part',
    description: 'Locks a part to another where they stand (the studio\'s Lock: a lock mate keeping its placement in the other\'s coordinates), so it moves with it — a gear on its shaft, a fastened cover. A fixed part and a free one swap, as add_mate swaps them; refused when both are fixed or the solver cannot keep it. The assembly\'s, so it is proposed (propose) for the user to accept.',
    input_schema: { type: 'object', properties: { part: { type: 'string' }, to: { type: 'string' } }, required: ['part', 'to'], additionalProperties: false },
  },
  {
    name: 'edit_mate',
    description: 'Changes a mate\'s distance, angle, flip or connectors {a?, b?} (null removes one), re-solving; refused (unchanged) when it cannot be met.',
    input_schema: { type: 'object', properties: { id: { type: 'string' }, connectors: { type: 'object', properties: { a: { anyOf: [connector, { type: 'null' }] }, b: { anyOf: [connector, { type: 'null' }] } }, additionalProperties: false }, distance: { type: 'number' }, angle: { type: 'number' }, flip: { type: 'boolean' } }, required: ['id'], additionalProperties: false },
  },
  {
    name: 'list_library',
    description: 'The part libraries (built-in, team, user): each part with its variants, parameters (value, unit, limits; estimate: not from a source), interfaces (role, the roles they accept) and the library\'s declared fits. Library parts are data: catalogue parts made of ordinary features.',
    input_schema: { type: 'object', properties: { library: { type: 'string', description: 'One library\'s id; all when left out.' } }, additionalProperties: false },
  },
  {
    name: 'insert_part',
    description: 'Inserts a library part as a new placed part (an instance): its features kept with the document, so it opens without the library. Its estimates and caveats come back as warnings. Place it with snap_part (by interfaces), mates or place_part.',
    input_schema: { type: 'object', properties: { library: { type: 'string' }, part: { type: 'string' }, variant: { type: 'string' }, params: { type: 'object', additionalProperties: { type: 'number' } }, name: { type: 'string' }, position: xyz, rotation: xyz }, required: ['library', 'part'], additionalProperties: false },
  },
  {
    name: 'add_library',
    description: 'Adds a part library written as data (a manifest of parts: parameters each with a source or estimate: true, variants, a recipe of ordinary part-model features with {expr} values and `when`, interfaces with frames, declared fits). Checked at once: it loads, every part builds valid in every variant, its fits touch without overlapping. Kept with the document, marked as written by an agent until a person confirms it. No imported models (STEP, meshes) in a library.',
    input_schema: { type: 'object', properties: { library: { type: 'object' } }, required: ['library'], additionalProperties: false },
  },
  {
    name: 'add_library_part',
    description: 'Adds a library part (a screw boss, a standoff …) to a body of the part as one step: its base put on a flat face at a point (facing out of it), united with the body. Its rules are checked against the wall measured there (or "context": {wall}) — warnings with margins, a rule that cannot be met refused; refused too when its base is not all on the body. Changes the part: at L2 it is a proposal unless the part is empty.',
    input_schema: { type: 'object', properties: { library: { type: 'string' }, part: { type: 'string' }, variant: { type: 'string' }, params: { type: 'object', additionalProperties: { type: 'number' } }, face: { type: 'string' }, point: xyz, x_direction: xyz, context: { type: 'object', additionalProperties: { type: 'number' } } }, required: ['library', 'part', 'face', 'point'], additionalProperties: false },
  },
  {
    name: 'check_printability',
    description: 'The manufacturability report for the part\'s process (printing, injection moulding, machining, casting), naming the process it judged by (none chosen: it says so, none assumed); each rule pass, warn, fail, unknown (why) or n/a, with values, limits and their sources. Printing (the process and printer): wall, hole, horizontal holes, gaps between bodies, enclosed cavities, bed fit, overhang, warp, tipping, as it lies (direction: the build direction, else the chosen one). Injection moulding: the pull (direction, else the document\'s), the finish and its least draft (finish: smooth, pm-t1, pm-t2, else the document\'s), walls against the process and the material\'s range, the largest part; draft, undercuts, walls, ribs, bosses, inside corners, sink; the parting line (sides: {face: "+" | "-"} puts a face in a half). Die and sand casting (IM8a): the material\'s casting family, the pull (direction, else the document\'s), the thinnest wall, every face\'s draft against the family\'s least and achievable, the tolerance where a page gives it.',
    input_schema: { type: 'object', properties: { direction: xyz, finish: { type: 'string' }, sides: { type: 'object', additionalProperties: { type: 'string', enum: ['+', '-'] } } }, additionalProperties: false },
  },
  {
    name: 'orient_for_print',
    description: 'Chooses which way up to print (the build direction) for the part\'s printing process: a fixed set of candidates scored on support volume, overhang, height and bed contact (normalised, the process\'s weights), deterministic. Returns the best and the top three with their terms; applies the best (doc print direction) unless apply is false. The printability rules then read it.',
    input_schema: { type: 'object', properties: { apply: { type: 'boolean' } }, additionalProperties: false },
  },
  {
    name: 'snap_part',
    description: 'Snaps part b onto part a by their interfaces — a library part\'s (list_library, insert_part), or a T-slot frame member\'s (`<body>.slot-t1` …, get_assembly\'s member_interfaces): placed exactly (b\'s interface facing a\'s, moved by offset along a\'s interface frame: x along it — a slot\'s length — then y, z) and held by real mates on the interfaces\' faces (flat flush, round on one axis), leaving free what they leave free (a nut slides along its slot). The roles must accept each other.',
    input_schema: { type: 'object', properties: { a: end, b: end, offset: xyz }, required: ['a', 'b'], additionalProperties: false },
  },
  {
    name: 'delete_mate',
    description: 'Deletes a mate; its part stays where it is.',
    input_schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false },
  },
];

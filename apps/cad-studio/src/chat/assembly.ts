// Chat tools for assemblies: parts as instances (each its own feature tree, built with the part tools
// by passing `part`), their placement and grounding, and mates solved by the studio's own solver
// (src/assembly/mates.ts) with its exact refusals. The assembly is re-solved after every change, as the
// studio does, so mated parts follow edits of the parts they are mated to.
import { emptyDoc, type PartInstance, type StudioDoc } from '../engine/doc';
import type { BodyResult, EvalResult } from '../engine/evaluate';
import { faceKey, faceTableOf } from '../assembly/faces';
import { BASE, KIND_LABEL, kindsFor, mateLabel, mateRefusal, rotationMatrix, solveAssembly, type FaceTable, type Mate, type MateKind, type Vec3 } from '../assembly/mates';
import type { ToolDefinition } from './api';

type Evaluate = (doc: StudioDoc) => Promise<EvalResult | null>;
interface State { doc: StudioDoc; bodies: BodyResult[] }
export interface AssemblyOutcome { doc: StudioDoc; content: string; isError: boolean; changed: boolean; summary: string }

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const json = (v: unknown) => JSON.stringify(v);
const fail = (doc: StudioDoc, error: string, extra: Record<string, unknown> = {}): AssemblyOutcome => ({ doc, content: json({ ok: false, error, ...extra }), isError: true, changed: false, summary: error });

// Face tables by part content (reading them evaluates the part).
const tableCache = new Map<string, FaceTable>();
function tableOf(doc: StudioDoc): FaceTable {
  const key = faceKey(doc);
  let t = tableCache.get(key);
  if (!t) { t = faceTableOf(doc); tableCache.set(key, t); if (tableCache.size > 32) tableCache.delete(tableCache.keys().next().value!); }
  return t;
}
const partDoc = (doc: StudioDoc, part: string) => part === BASE ? doc : doc.instances?.find(i => i.id === part)?.doc;
const tablesFor = (doc: StudioDoc) => (part: string) => { const d = partDoc(doc, part); return d ? tableOf(d) : undefined; };

/** The document with its mates solved (from the placements it has), and what cannot be met. */
export function solveDoc(doc: StudioDoc, before?: readonly PartInstance[]): { doc: StudioDoc; problems: { mate: string; reason: string }[] } {
  if (!doc.mates?.length || !doc.instances?.length) return { doc, problems: [] };
  const r = solveAssembly(doc.instances, doc.mates, tablesFor(doc), before ?? doc.instances);
  return { doc: { ...doc, instances: r.instances }, problems: r.problems };
}

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

/** The mateable faces of a part: flat ones (normal) and round ones (axis, radius), in its own coordinates. */
function mateFaces(table: FaceTable, cap = 40) {
  const entries = Object.entries(table);
  const list = entries.slice(0, cap).map(([name, f]) => f.kind === 'plane'
    ? { name, kind: 'flat', normal: f.normal.map(r3), point: f.point.map(r3) }
    : { name, kind: f.outer ? 'round (outer: shaft, pin)' : 'round (inner: hole, bore)', axis: f.axis.map(r3), through: f.point.map(r3), radius: r3(f.radius) });
  return entries.length > cap ? { faces: list, more: entries.length - cap } : { faces: list };
}

async function describe(doc: StudioDoc, base: BodyResult[], evaluate: Evaluate, detail: string | null) {
  const instances = await Promise.all((doc.instances ?? []).map(async inst => {
    const r = await evaluate(inst.doc), bodies = r?.ok ? r.bodies : [];
    const min = [0, 1, 2].map(k => Math.min(...bodies.map(b => b.mesh.bounds.min[k]))) as Vec3, max = [0, 1, 2].map(k => Math.max(...bodies.map(b => b.mesh.bounds.max[k]))) as Vec3;
    return {
      id: inst.id, name: inst.name, position: inst.position.map(r3), rotation_deg: inst.rotation.map(r3), ...(inst.grounded ? { grounded: true } : {}), ...(inst.hidden ? { hidden: true } : {}),
      feature_count: inst.doc.nodes.length, bodies: bodies.length, volume_mm3: r3(bodies.reduce((s, b) => s + (b.volumeMM3 ?? 0), 0)),
      ...(bodies.length ? { world_bounds: placedBounds(inst, min, max) } : {}),
      ...(r && !r.ok ? { error: r.error.title } : {}),
      ...(detail === inst.id ? mateFaces(tableOf(inst.doc)) : {}),
    };
  }));
  const mates = doc.mates ?? [];
  const solved = solveDoc(doc).problems;
  return {
    base: { id: BASE, feature_count: doc.nodes.length, bodies: base.length, volume_mm3: r3(base.reduce((s, b) => s + (b.volumeMM3 ?? 0), 0)), note: 'the document\'s own part, fixed at the origin', ...(detail === BASE ? mateFaces(tableOf(doc)) : {}) },
    instances,
    mates: mates.map((m, i) => ({ id: m.id, label: mateLabel(m, i), kind: m.kind, a: m.a, b: m.b, ...(m.distance !== undefined ? { distance: m.distance } : {}), ...(m.angle !== undefined ? { angle: m.angle } : {}), ...(m.flip ? { flip: true } : {}) })),
    ...(solved.length ? { problems: solved } : {}),
    ...(detail ? {} : { note: 'mateable faces of one part: get_assembly {"faces_of": part id or "base"}' }),
  };
}

const nextId = (used: Set<string>, prefix: string) => { let n = 1; while (used.has(`${prefix}${n}`)) n++; return `${prefix}${n}`; };
const vec3 = (v: unknown): [number, number, number] | null => Array.isArray(v) && v.length === 3 && v.every(x => typeof x === 'number' && Number.isFinite(x)) ? v as [number, number, number] : null;

async function changed(doc: StudioDoc, next: StudioDoc, what: string, base: BodyResult[], evaluate: Evaluate, extra: Record<string, unknown> = {}): Promise<AssemblyOutcome> {
  const s = solveDoc(next, doc.instances);
  const parts = (s.doc.instances ?? []).map(i => ({ id: i.id, name: i.name, position: i.position.map(r3), rotation_deg: i.rotation.map(r3), ...(i.grounded ? { grounded: true } : {}) }));
  return {
    doc: s.doc, isError: false, changed: true, summary: `${what}${s.problems.length ? ` (${s.problems.length} unmet mate${s.problems.length > 1 ? 's' : ''})` : ''}`,
    content: json({ ok: true, did: what, ...extra, parts, ...(s.problems.length ? { unmet_mates: s.problems } : {}) }),
  };
}

export const ASSEMBLY_TOOL_NAMES = new Set(['get_assembly', 'add_part', 'place_part', 'delete_part', 'add_mate', 'edit_mate', 'delete_mate']);

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
      const id = nextId(new Set(instances.map(i => i.id)), 'p');
      let partDocument = emptyDoc();
      if (args.copy_of !== undefined) {
        const src = partDoc(doc, String(args.copy_of));
        if (!src) return fail(doc, `No part "${String(args.copy_of)}" to copy; parts: ${partList()}.`);
        partDocument = { ...src, instances: undefined, mates: undefined, render: undefined, drawing: undefined, direct: undefined };
      }
      const position = vec3(args.position) ?? [0, 0, 0], rotation = vec3(args.rotation) ?? [0, 0, 0];
      const inst: PartInstance = { id, name: label, doc: partDocument, position, rotation, ...(args.grounded ? { grounded: true } : {}) };
      return changed(doc, { ...doc, instances: [...instances, inst] }, `added part ${id} "${label}"${args.copy_of !== undefined ? ` (a copy of ${String(args.copy_of)})` : ''}`, state.bodies, evaluate,
        { part: id, note: partDocument.nodes.length ? 'build or edit it with the part tools and "part": id' : 'empty: build it with run_command / add_features and "part": id (its own coordinates; place it with place_part or mates)' });
    }
    case 'place_part': {
      const inst = byId(args.part);
      if (!inst) return fail(doc, `No part "${String(args.part)}"; parts: ${instances.map(i => i.id).join(', ') || 'none (the base part is fixed at the origin)'}.`);
      const position = args.position === undefined ? inst.position : vec3(args.position), rotation = args.rotation === undefined ? inst.rotation : vec3(args.rotation);
      if (!position || !rotation) return fail(doc, '"position" and "rotation" are [x, y, z] (mm; degrees about X, then Y, then Z).');
      const by = mates.filter(m => m.b.part === inst.id);
      if (args.grounded === true && by.length) return fail(doc, `${by.length} mate${by.length > 1 ? 's' : ''} move ${inst.name}; delete ${by.length > 1 ? 'them' : 'it'} first, or fix the other part.`);
      const next: PartInstance = { ...inst, position, rotation, ...(typeof args.name === 'string' && args.name.trim() ? { name: args.name.trim() } : {}),
        ...(args.grounded === undefined ? {} : { grounded: args.grounded ? true : undefined }), ...(args.hidden === undefined ? {} : { hidden: args.hidden ? true : undefined }) };
      const out = await changed(doc, { ...doc, instances: instances.map(i => i.id === inst.id ? next : i) }, `placed ${inst.id}`, state.bodies, evaluate,
        by.length && (args.position !== undefined || args.rotation !== undefined) ? { note: `${by.length} mate${by.length > 1 ? 's' : ''} still place it: the solver keeps what they fix and moves it only where they leave it free` } : {});
      return out;
    }
    case 'delete_part': {
      const inst = byId(args.part);
      if (!inst) return fail(doc, `No part "${String(args.part)}"; parts: ${instances.map(i => i.id).join(', ') || 'none'}.`);
      const kept = mates.filter(m => m.a.part !== inst.id && m.b.part !== inst.id);
      return changed(doc, { ...doc, instances: instances.filter(i => i !== inst), mates: kept }, `deleted ${inst.id} "${inst.name}"${kept.length < mates.length ? ` and ${mates.length - kept.length} mate${mates.length - kept.length > 1 ? 's' : ''} on it` : ''}`, state.bodies, evaluate);
    }
    case 'add_mate': case 'edit_mate': {
      let mate: Mate, list: Mate[];
      if (name === 'add_mate') {
        const kind = String(args.kind) as MateKind;
        if (!KIND_LABEL[kind]) return fail(doc, `"kind" is one of ${Object.keys(KIND_LABEL).join(', ')}.`);
        const ref = (v: unknown) => isObj(v) && typeof v.part === 'string' && typeof v.face === 'string' ? { part: v.part, face: v.face } : null;
        let a = ref(args.a), b = ref(args.b);
        if (!a || !b) return fail(doc, '"a" and "b" are {part, face}: part "base" or an instance id, face a persistent face name (or origin:xy / origin:xz / origin:yz).');
        for (const r of [a, b]) if (!partDoc(doc, r.part)) return fail(doc, `No part "${r.part}"; parts: ${partList()}.`);
        if (a.part === b.part) return fail(doc, 'Both faces are on the same part; mate faces of two different parts.');
        // b moves; when it is fixed and a is not, they swap (as when picking in the studio).
        const fixed = (p: string) => p === BASE || !!byId(p)?.grounded;
        if (fixed(b.part)) { if (fixed(a.part)) return fail(doc, 'Both parts are fixed (the base part and grounded parts never move): one of them must be free.'); [a, b] = [b, a]; }
        mate = { id: nextId(new Set(mates.map(m => m.id)), 'm'), kind, a, b,
          ...(kind === 'distance' ? { distance: Number(args.distance) } : {}), ...(kind === 'angle' ? { angle: Number(args.angle) } : {}), ...(kind !== 'concentric' && args.flip ? { flip: true } : {}), ...(kind === 'concentric' && typeof args.flip === 'boolean' ? { flip: args.flip } : {}) };
        list = [...mates, mate];
      } else {
        const old = mates.find(m => m.id === args.id);
        if (!old) return fail(doc, `No mate "${String(args.id)}"; mates: ${mates.map(m => m.id).join(', ') || 'none'}.`);
        mate = { ...old, ...(args.distance !== undefined ? { distance: Number(args.distance) } : {}), ...(args.angle !== undefined ? { angle: Number(args.angle) } : {}), ...(typeof args.flip === 'boolean' ? { flip: args.flip } : {}) };
        list = mates.map(m => m.id === mate.id ? mate : m);
      }
      const tables = tablesFor(doc), fa = tables(mate.a.part)?.[mate.a.face], fb = tables(mate.b.part)?.[mate.b.face];
      const missing = [!fa && mate.a, !fb && mate.b].filter(Boolean) as { part: string; face: string }[];
      if (missing.length) return fail(doc, `${missing.map(r => `"${r.face}" is not a flat or round face of ${r.part}`).join('; ')}. List mateable faces with get_assembly {"faces_of": part}.`);
      const why = mateRefusal(mate, fa, fb);
      if (why) return fail(doc, `${why}${fa && fb ? ` (these faces admit: ${kindsFor(fa, fb).join(', ')})` : ''}`);
      const r = solveAssembly(instances, list, tables, instances);
      const problem = r.problems.find(p => p.mate === mate.id);
      if (problem) return fail(doc, problem.reason, { kept: 'the assembly is unchanged' });
      const moved = r.instances.find(i => i.id === mate.b.part)!;
      return changed(doc, { ...doc, instances: r.instances, mates: list }, `${name === 'add_mate' ? 'added' : 'edited'} ${mateLabel(mate, list.indexOf(mate))} (${mate.id}): ${mate.b.part}.${mate.b.face} to ${mate.a.part}.${mate.a.face}`, state.bodies, evaluate,
        { mate: mate.id, moved: { part: moved.id, position: moved.position.map(r3), rotation_deg: moved.rotation.map(r3) }, freedom_left: r.freedom[moved.id] });
    }
    case 'delete_mate': {
      if (!mates.some(m => m.id === args.id)) return fail(doc, `No mate "${String(args.id)}"; mates: ${mates.map(m => m.id).join(', ') || 'none'}.`);
      return changed(doc, { ...doc, mates: mates.filter(m => m.id !== args.id) }, `deleted mate ${String(args.id)} (its part stays where it is)`, state.bodies, evaluate);
    }
  }
  return fail(doc, `Unknown tool "${name}".`);
}

const ref = { type: 'object', properties: { part: { type: 'string' }, face: { type: 'string' } }, required: ['part', 'face'], additionalProperties: false };
const xyz = { type: 'array', items: { type: 'number' }, minItems: 3, maxItems: 3 };

export const ASSEMBLY_TOOLS: ToolDefinition[] = [
  {
    name: 'get_assembly',
    description: 'The assembly: the base part (the document\'s own part, fixed at the origin) and every placed part (instance id, name, placement, grounded, volume, bounds in the assembly), the mates and any that cannot be met. With faces_of, also that part\'s mateable faces (flat: normal; round: axis, radius, inner hole or outer shaft) in its own coordinates.',
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
    description: 'Places a part by its faces, solved exactly by the studio\'s mate solver; a mate that conflicts with the others is refused with the reason. "a" stays, "b" moves (swapped when b\'s part is fixed). Kinds: coincident (two flat faces flush, facing each other; flip: facing the same way; with an origin plane the default is the same way and flip opposes them), distance (the same, `distance` mm apart), angle (two flat faces `angle` degrees apart), concentric (two round faces on one axis: a shaft in a bore; flip true/false sets the axis sense), tangent (a round face touching a flat or another round face). Faces are persistent names (from get_assembly faces_of, or part results), or a part\'s origin planes origin:xy / origin:xz / origin:yz. The result says what the moved part can still do (free turns and slides).',
    input_schema: { type: 'object', properties: { kind: { type: 'string', enum: Object.keys(KIND_LABEL) }, a: ref, b: ref, distance: { type: 'number' }, angle: { type: 'number' }, flip: { type: 'boolean' } }, required: ['kind', 'a', 'b'], additionalProperties: false },
  },
  {
    name: 'edit_mate',
    description: 'Changes a mate\'s distance, angle or flip, re-solving; refused (unchanged) when it cannot be met.',
    input_schema: { type: 'object', properties: { id: { type: 'string' }, distance: { type: 'number' }, angle: { type: 'number' }, flip: { type: 'boolean' } }, required: ['id'], additionalProperties: false },
  },
  {
    name: 'delete_mate',
    description: 'Deletes a mate; its part stays where it is.',
    input_schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false },
  },
];

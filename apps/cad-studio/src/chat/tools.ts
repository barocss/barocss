// The chat's tools: the studio's own commands (validated by the same `available` / `fields` rules as
// the HUD and built by the same `build`), raw feature nodes for what has no command (sketched profiles,
// revolves, sweeps, lofts), the feature editor's fields, delete, measure, select and a part summary.
// Each change is evaluated by the engine before it is kept; the result is what the model reads back.
import { commandById, commands, refOf, shownFields, type Ctx, type Field, type Selection, type Values } from '../app/commands';
import { editFields } from '../app/editFields';
import { measureBetween, measureItem, type MeasurePick } from '../app/measure';
import { featureLabel, prefixDoc, withNode, type ModelNode, type StudioDoc } from '../engine/doc';
import type { BodyResult, EvalResult } from '../engine/evaluate';
import type { ToolDefinition } from './api';
import { checkNode, deleteFeature } from './features';

/** A selection by persistent names (stable across evaluations, unlike mesh indices). */
export interface NameSelection { faces: string[]; edges: string[]; bodies: string[] }
/** The part as the chat turn has built it so far. */
export interface ChatState { doc: StudioDoc; bodies: BodyResult[]; selection?: NameSelection }
export type Evaluate = (doc: StudioDoc) => Promise<EvalResult | null>;
export interface ToolOutcome { state: ChatState; content: string; isError: boolean; changed: boolean; summary: string }

/** Commands the chat can run (the ones that build; sketch-mode and measure UI actions are tools of their own). */
export const CHAT_COMMANDS = commands.filter(c => c.build).map(c => c.id);

/** What each command needs selected and what its values mean. */
export const COMMAND_DOCS: Record<string, { selection: string; values: Record<string, string> }> = {
  box: { selection: 'none (or a top face to stack on)', values: { w: 'width along X', d: 'depth along Y', h: 'height along Z', x: 'min corner X', y: 'min corner Y', z: 'base Z' } },
  cylinder: { selection: 'none', values: { r: 'radius', h: 'height', x: 'centre X', y: 'centre Y', z: 'base Z' } },
  hole: { selection: 'faces: [one flat face facing ±X/±Y/±Z]', values: { d: 'diameter (through all)', x: 'centre, first axis of the face plane (Z face: X; X face: Y; Y face: X)', y: 'centre, second axis (Z face: Y; X face: Z; Y face: Z)' } },
  chamfer: { selection: 'edges: [edges of one body]', values: { distance: 'chamfer distance' } },
  fillet: { selection: 'edges: [edges of one body]', values: { radius: 'fillet radius' } },
  shell: { selection: 'faces to open (all of one body), or bodies: [one body] for a closed hollow', values: { t: 'wall thickness' } },
  move: { selection: 'bodies: [one body]', values: { x: 'ΔX', y: 'ΔY', z: 'ΔZ' } },
  rotate: { selection: 'bodies: [one body]', values: { axis: 'x | y | z (through the origin)', angle: 'degrees' } },
  mirror: { selection: 'bodies: [one body]', values: { plane: 'yz | xz | xy (through the origin); keeps the original' } },
  'linear-pattern': { selection: 'bodies: [one body]', values: { axis: 'x | y | z', spacing: 'mm between copies', count: 'copies including the original' } },
  'circular-pattern': { selection: 'bodies: [one body]', values: { axis: 'z (even full turn) | x | y (quarter turns)', count: 'copies including the original' } },
  split: { selection: 'bodies: [one body]', values: { axis: 'normal of the cutting plane: x | y | z', at: 'plane position' } },
  union: { selection: 'bodies: [two bodies]', values: {} },
  difference: { selection: 'bodies: [body to cut, tool body]', values: {} },
  intersect: { selection: 'bodies: [two bodies]', values: {} },
};

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const v3 = (v: readonly number[]) => v.map(r3);
const json = (v: unknown) => JSON.stringify(v);

/** Faces, edges and bodies by name → mesh indices; unknown names are returned. */
export function resolveNames(bodies: BodyResult[], names: Partial<NameSelection>): { selection: Selection; unknown: string[] } {
  const selection: Selection = { faces: [], edges: [], bodies: [] }, unknown: string[] = [];
  for (const name of names.faces ?? []) {
    const hit = bodies.flatMap((b, bi) => b.mesh.faces.flatMap(f => f.name.split('+').includes(name) || f.id === name ? [{ body: bi, face: f.index }] : []))[0];
    if (hit) { if (!selection.faces.some(f => f.body === hit.body && f.face === hit.face)) selection.faces.push(hit); } else unknown.push(name);
  }
  for (const name of names.edges ?? []) {
    const hit = bodies.flatMap((b, bi) => b.mesh.edges.flatMap(e => e.names.includes(name) ? [{ body: bi, edge: e.index }] : []))[0];
    if (hit) { if (!selection.edges.some(e => e.body === hit.body && e.edge === hit.edge)) selection.edges.push(hit); } else unknown.push(name);
  }
  for (const key of names.bodies ?? []) {
    const i = bodies.findIndex(b => b.key === key);
    if (i >= 0) { if (!selection.bodies.includes(i)) selection.bodies.push(i); } else unknown.push(key);
  }
  return { selection, unknown };
}

/** The visible bodies, with their faces and edges by name when `detail` (capped for big parts). */
export function describeBodies(doc: StudioDoc, bodies: BodyResult[], detail: boolean, cap = 120) {
  return bodies.map(b => {
    const ref = refOf(b), node = doc.nodes[ref.node], m = b.mesh;
    const out: Record<string, unknown> = {
      key: b.key, made_by: node ? `${ref.node}: ${featureLabel(node, ref.node, doc.nodes)}` : undefined,
      volume_mm3: b.volumeMM3 === null ? null : r3(b.volumeMM3), bounds: { min: v3(m.bounds.min), max: v3(m.bounds.max) },
      face_count: m.faces.length, edge_count: m.edges.length,
    };
    if (detail) {
      out.faces = m.faces.slice(0, cap).map(f => ({ name: f.name.split('+')[0], ...(f.name.includes('+') ? { also: f.name.split('+').slice(1) } : {}), kind: f.kind, normal: v3(f.normal), centre: v3(f.centroid), area_mm2: r3(f.areaMM2), ...(f.radius ? { radius: r3(f.radius) } : {}) }));
      out.edges = m.edges.slice(0, cap).map(e => ({ name: e.names[0], from: v3(e.a), to: v3(e.b), ...(e.straight ? { line: e.axis ? `along ${e.axis}` : 'oblique' } : { line: 'curve' }) }));
      if (m.faces.length > cap || m.edges.length > cap) out.truncated = `first ${cap} faces/edges shown`;
    }
    return out;
  });
}

function features(doc: StudioDoc) {
  return doc.nodes.map((n, i) => ({ index: i, label: featureLabel(n, i, doc.nodes), node: n }));
}

const MUTATORS = new Set(['run_command', 'add_features', 'edit_feature', 'delete_feature']);
const DETAIL_LIMIT = 80;

/** Evaluates a candidate document: the new state, or the engine's refusal as a tool error. */
async function accept(state: ChatState, next: StudioDoc, evaluate: Evaluate, what: string, extra: Record<string, unknown> = {}): Promise<ToolOutcome> {
  const r = await evaluate(next);
  if (!r) return fail(state, 'The evaluation was superseded; try again.');
  if (!r.ok) return fail(state, `${r.error.title}. ${r.error.hint}`, { detail: r.error.detail, kept: 'the part is unchanged' });
  const entries = r.bodies.reduce((s, b) => s + b.mesh.faces.length + b.mesh.edges.length, 0);
  const result = {
    ok: true, did: what, ...extra, feature_count: next.nodes.length,
    bodies: describeBodies(next, r.bodies, entries <= DETAIL_LIMIT),
    ...(entries > DETAIL_LIMIT ? { note: 'call get_part_summary for face and edge names' } : {}),
  };
  return { state: { ...state, doc: next, bodies: r.bodies }, content: json(result), isError: false, changed: true, summary: `${what} → ${r.bodies.length} bod${r.bodies.length === 1 ? 'y' : 'ies'}${r.bodies[0]?.volumeMM3 != null ? `, ${Math.round(r.bodies.reduce((s, b) => s + (b.volumeMM3 ?? 0), 0))} mm³` : ''}` };
}

function fail(state: ChatState, reason: string, extra: Record<string, unknown> = {}): ToolOutcome {
  return { state, content: json({ ok: false, error: reason, ...extra }), isError: true, changed: false, summary: reason };
}

function checkValues(fields: Field[], values: Values): string | null {
  for (const f of shownFields(fields, values)) {
    const v = values[f.key];
    if (v === undefined || v === '') return `"${f.key}" (${f.label}) is required.`;
    if (f.kind === 'choice') { if (!f.options.some(o => o.value === String(v))) return `"${f.key}" is one of ${f.options.map(o => o.value).join(', ')}.`; continue; }
    const n = Number(v);
    if (!Number.isFinite(n)) return `"${f.key}" (${f.label}) must be a number.`;
    if (f.kind === 'count' && !Number.isInteger(n)) return `"${f.key}" must be a whole number.`;
    if (f.min !== undefined && n < f.min) return `"${f.key}" (${f.label}) must be at least ${f.min}.`;
    if (f.max !== undefined && n > f.max) return `"${f.key}" (${f.label}) must be at most ${f.max}.`;
  }
  return null;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const strings = (v: unknown) => Array.isArray(v) ? v.map(String) : [];

/** Runs one tool call against the turn's state. */
export async function runTool(state: ChatState, name: string, input: unknown, evaluate: Evaluate): Promise<ToolOutcome> {
  const args = isObj(input) ? input : {};
  if ('__invalid_json' in args) return fail(state, 'The tool input was not valid JSON; send it again.');
  switch (name) {
    case 'get_part_summary': {
      const body = { feature_count: state.doc.nodes.length, parameters: state.doc.parameters, features: features(state.doc), bodies: describeBodies(state.doc, state.bodies, true) };
      return { state, content: json(body), isError: false, changed: false, summary: `${state.doc.nodes.length} features, ${state.bodies.length} bod${state.bodies.length === 1 ? 'y' : 'ies'}` };
    }
    case 'run_command': {
      const cmd = commandById(String(args.command));
      if (!cmd?.build) return fail(state, `Unknown command "${String(args.command)}". Commands: ${CHAT_COMMANDS.join(', ')}.`);
      const { selection, unknown } = resolveNames(state.bodies, { faces: strings(args.faces), edges: strings(args.edges), bodies: strings(args.bodies) });
      if (unknown.length) return fail(state, `No face, edge or body named ${unknown.map(n => `"${n}"`).join(', ')} on the current part. Use the names from the last result or get_part_summary.`);
      const point = Array.isArray(args.point) && args.point.length === 3 ? args.point.map(Number) as [number, number, number] : undefined;
      const ctx: Ctx = { doc: state.doc, bodies: state.bodies, selection, pick: point };
      const avail = cmd.available(ctx);
      if (!avail.ok) return fail(state, `${cmd.label} can’t run: ${avail.reason}`);
      const fields = cmd.fields?.(ctx) ?? [];
      const given = isObj(args.values) ? args.values : {};
      const bad = Object.keys(given).filter(k => !fields.some(f => f.key === k));
      if (bad.length) return fail(state, `${cmd.label} has no value ${bad.map(k => `"${k}"`).join(', ')}; its values are ${fields.map(f => `${f.key} (${f.label})`).join(', ') || 'none'}.`);
      const values: Values = { ...(cmd.defaults?.(ctx) ?? {}) };
      for (const [k, v] of Object.entries(given)) values[k] = typeof v === 'number' ? v : String(v);
      const why = checkValues(fields, values);
      if (why) return fail(state, `${cmd.label}: ${why}`);
      const next = cmd.build(ctx, values);
      const shown = Object.fromEntries(shownFields(fields, values).map(f => [f.key, values[f.key]]));
      return accept(state, next, evaluate, `${cmd.label} ${json(shown)}`, { added: next.nodes.slice(state.doc.nodes.length).map((n, k) => `${state.doc.nodes.length + k}: ${featureLabel(n, state.doc.nodes.length + k, next.nodes)}`) });
    }
    case 'add_features': {
      const list = Array.isArray(args.features) ? args.features : null;
      if (!list?.length) return fail(state, '"features" is a non-empty list of feature nodes.');
      let doc = state.doc;
      for (const [k, node] of list.entries()) {
        const why = checkNode(node, doc.nodes, doc.parameters);
        if (why) return fail(state, `Feature ${k + 1} of ${list.length} (would be index ${doc.nodes.length}): ${why}`, { kept: 'nothing was added' });
        doc = withNode(doc, node as ModelNode);
      }
      return accept(state, doc, evaluate, `added ${list.length} feature${list.length > 1 ? 's' : ''}`, { added: doc.nodes.slice(state.doc.nodes.length).map((n, k) => `${state.doc.nodes.length + k}: ${featureLabel(n, state.doc.nodes.length + k, doc.nodes)}`) });
    }
    case 'edit_feature': {
      const index = Number(args.index), nodes = state.doc.nodes;
      if (!Number.isInteger(index) || !nodes[index]) return fail(state, `There is no feature ${String(args.index)} (features 0–${nodes.length - 1}).`);
      let next: ModelNode[];
      if (args.feature !== undefined) {
        const why = checkNode(args.feature, nodes.slice(0, index), state.doc.parameters);
        if (why) return fail(state, `Feature ${index}: ${why}`);
        next = nodes.map((n, i) => i === index ? args.feature as ModelNode : n);
      } else {
        const fields = editFields(nodes, index), given = isObj(args.values) ? args.values : {};
        if (!Object.keys(given).length) return fail(state, `Pass "values" or a whole "feature". Feature ${index}'s values: ${fields.map(f => `${f.key} (${f.label} = ${String(f.get(nodes))})`).join(', ') || 'none — replace it with "feature"'}.`);
        next = [...nodes];
        for (const [key, v] of Object.entries(given)) {
          const f = fields.find(x => x.key === key);
          if (!f) return fail(state, `Feature ${index} has no value "${key}"; its values are ${fields.map(x => `${x.key} (${x.label})`).join(', ') || 'none'}.`);
          if (f.kind === 'number') { if (typeof v !== 'number' || !Number.isFinite(v)) return fail(state, `"${key}" must be a number.`); next = f.set(next, v); }
          else if (f.kind === 'choice') { if (!f.options.some(o => o.value === v)) return fail(state, `"${key}" is one of ${f.options.map(o => o.value).join(', ')}.`); next = f.set(next, String(v)); }
          else next = f.set(next, Boolean(v));
        }
      }
      return accept(state, prefixDoc({ ...state.doc, nodes: next }, next.length), evaluate, `edited ${index}: ${featureLabel(next[index], index, next)}`);
    }
    case 'delete_feature': {
      const r = deleteFeature(state.doc, Number(args.index));
      if ('error' in r) return fail(state, r.error);
      return accept(state, r.doc, evaluate, `deleted feature${r.removed.length > 1 ? 's' : ''} ${r.removed.join(', ')}`, { note_indices: 'later features moved down; face and edge names were renumbered' });
    }
    case 'measure': {
      const names = [String(args.a ?? ''), ...(args.b === undefined ? [] : [String(args.b)])];
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
      return { state, content: json(out), isError: false, changed: false, summary: json(out) };
    }
    case 'select': {
      const sel: NameSelection = { faces: strings(args.faces), edges: strings(args.edges), bodies: strings(args.bodies) };
      const { unknown } = resolveNames(state.bodies, sel);
      if (unknown.length) return fail(state, `No face, edge or body named ${unknown.map(n => `"${n}"`).join(', ')}.`);
      const count = sel.faces.length + sel.edges.length + sel.bodies.length;
      return { state: { ...state, selection: sel }, content: json({ ok: true, selected: sel }), isError: false, changed: false, summary: `${count} selected` };
    }
  }
  return fail(state, `Unknown tool "${name}".`);
}

export const isMutator = (name: string) => MUTATORS.has(name);

const nameList = { type: 'array', items: { type: 'string' } };
const commandDoc = CHAT_COMMANDS.map(id => {
  const c = commandById(id)!, d = COMMAND_DOCS[id];
  const values = Object.entries(d.values).map(([k, v]) => `${k}: ${v}`).join('; ');
  return `- ${id} (${c.label}) — select ${d.selection}${values ? `; values: ${values}` : ''}`;
}).join('\n');

export const TOOLS: ToolDefinition[] = [
  {
    name: 'get_part_summary',
    description: 'The current part: every feature node by index (with its JSON), parameters, and each visible body with volume, bounds, and its faces and edges by persistent name (e.g. face "n1.top", edge "n1.side0|n1.side1"). Call it before referring to faces or edges you have not seen in a result.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'run_command',
    description: `Runs one studio command, exactly as the toolbar and its HUD would: the same availability rules, value ranges and defaults (omitted values take the HUD default). Faces, edges and bodies are selected by name; the command applies to that selection. Commands:\n${commandDoc}\nThe result has the bodies after evaluation (volume, bounds, face and edge names) or the refusal reason; nothing changes on a refusal.`,
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'string', enum: CHAT_COMMANDS },
        values: { type: 'object', description: 'Command values by key (numbers in mm or degrees; choices as strings).', additionalProperties: { type: ['number', 'string'] } },
        faces: { ...nameList, description: 'Face names to select.' },
        edges: { ...nameList, description: 'Edge names to select.' },
        bodies: { ...nameList, description: 'Body keys to select (e.g. "b1").' },
        point: { type: 'array', items: { type: 'number' }, description: 'Optional picked point [x, y, z] on the face (hole default centre).' },
      },
      required: ['command'], additionalProperties: false,
    },
  },
  {
    name: 'add_features',
    description: `Appends raw feature nodes for what no command covers: sketched profiles and the solids made from them (polygon or line/arc outlines, sketches on other planes, extrudes with draft or a start Z, revolves, sweeps, lofts), blind holes, or feature-level control. Nodes are checked, appended in order (each new node gets the next index) and evaluated together; on any error nothing is added. Node kinds (dimensions in mm; Dim = number or {"parameter": name}):
- {"kind":"sketch","profile":"rectangle","min":[x,y],"max":[x,y]} | {"kind":"sketch","profile":"circle","center":[x,y],"radius":r} | {"kind":"sketch","profile":"polygon","points":[[x,y],...]} | {"kind":"sketch","profile":"loop","segments":[{"kind":"line","start":[x,y]} | {"kind":"arc","start":[x,y],"center":[x,y],"direction":"ccw"|"cw"}, ...]}; optional "plane":{origin,normal,xAxis} (default XY at Z 0), "regions" (more loops), "holes" (loops cut out; straight extrudes only)
- {"kind":"extrude","sketch":i,"height":h,"from"?:z,"draft"?:deg}
- {"kind":"revolve","sketch":i,"axis":"x"|"y","origin"?:[a,b],"angleDegrees":deg} (about the sketch's own axis)
- {"kind":"sweep","sketch":i,"path":[{"kind":"straight","length":l} | {"kind":"bend","radius":r,"angleDegrees":deg,"toward":"x"|"-x"|"y"|"-y"}]} (from the sketch plane up +Z)
- {"kind":"loft","sections":[{"sketch":i,"z":z},...],"smooth"?:bool}
- {"kind":"hole","parent":Ref,"center":[a,b],"radius":r,"axis"?:"x"|"y"|"z","side"?:"min"|"max","depth"?:d} (omit depth for through)
- {"kind":"fillet","parent":Ref,"edges":[names],"radius":r} | {"kind":"chamfer","parent":Ref,"edges":[names],"distance":d} | {"kind":"shell","parent":Ref,"thickness":t,"open":[face names]}
- {"kind":"union"|"intersect","left":Ref,"right":Ref} | {"kind":"difference","parent":Ref,"tool":Ref} | {"kind":"split","parent":Ref,"axis":"x"|"y"|"z","at":v}
- {"kind":"translate","parent":Ref,"offset":[dx,dy,dz]} | {"kind":"rotate","parent":Ref,"axis":"x"|"y"|"z","angleDegrees":deg} | {"kind":"mirror","parent":Ref,"plane":"xy"|"xz"|"yz"} | {"kind":"scale","parent":Ref,"factor":k} | {"kind":"linear-pattern","parent":Ref,"axis":a,"spacing":s,"count":n} | {"kind":"circular-pattern","parent":Ref,"axis":a,"angleDegrees":deg,"count":n}
Ref = {"node": index of the feature that made a visible body, "side": "solid"} (split halves: "negative"/"positive"). Body key "b5" is {"node":5,"side":"solid"}.`,
    input_schema: { type: 'object', properties: { features: { type: 'array', items: { type: 'object' }, minItems: 1 } }, required: ['features'], additionalProperties: false },
  },
  {
    name: 'edit_feature',
    description: 'Changes an existing feature, as the feature editor does: "values" sets its editable dimensions by key (an extrude also edits its sketch: w, d, c0, c1 for a rectangle; dia, cc0, cc1 for a circle; h height; from; draft — a hole: dia, c0, c1, depth; fillet r; chamfer d; shell t; …). Call it with an index and no values to list the keys. Or pass a whole replacement "feature" node (same rules as add_features). Later features follow the edit.',
    input_schema: { type: 'object', properties: { index: { type: 'integer' }, values: { type: 'object', additionalProperties: { type: ['number', 'string', 'boolean'] } }, feature: { type: 'object' } }, required: ['index'], additionalProperties: false },
  },
  {
    name: 'delete_feature',
    description: 'Deletes a feature (and the sketches only it used). Refused while a later feature uses it. Later features move down one index per deleted node; names in results are renumbered accordingly.',
    input_schema: { type: 'object', properties: { index: { type: 'integer' } }, required: ['index'], additionalProperties: false },
  },
  {
    name: 'measure',
    description: 'Measures one face or edge (area, length, radius), or the distance between two (and the angle between planes or straight edges, the normal distance between parallel planes).',
    input_schema: { type: 'object', properties: { a: { type: 'string', description: 'Face or edge name.' }, b: { type: 'string', description: 'Optional second face or edge name.' } }, required: ['a'], additionalProperties: false },
  },
  {
    name: 'select',
    description: 'Highlights faces, edges or bodies in the user’s viewport when the turn ends (for example to show what was filleted). Does not change the part.',
    input_schema: { type: 'object', properties: { faces: nameList, edges: nameList, bodies: nameList }, additionalProperties: false },
  },
];

export const SYSTEM_PROMPT = `You are the modeling assistant inside barocss CAD Studio, a parametric part modeler. The user describes a part or a change; you build it with the tools, which edit the part's feature tree exactly like the studio's own commands. Every change you make is evaluated by the geometry kernel and the result (bodies, volumes, bounds, face and edge names, or the exact refusal) comes back to you.

Conventions: millimetres; Z is up; sketches and boxes start on the XY plane at Z 0 unless placed otherwise; a box's x, y are its minimum corner. Holes go through the whole body by default. Faces and edges are referred to by their persistent names from results (e.g. the top face of the first extrude is "n1.top", a vertical corner edge "n1.side0|n1.side1"); vertical edges are the straight edges "along z".

Work like an engineer: prefer the commands (box, cylinder, hole, fillet, chamfer, shell, patterns, Booleans) and use add_features for profiles and solids no command makes. Make each change, read the result, and correct yourself when a tool refuses or a volume or bound is not what the request implies. Ask a short question only when the request is genuinely ambiguous; otherwise choose sensible dimensions and say what you chose. When the user attaches images (a sketch, a photo, a dimensioned drawing), model the part they show: take dimensions written on a drawing as given; read views (top, front, side) together; for a photo or an undimensioned sketch, estimate proportions from the picture and scale them by any one known size, and if no size is given or implied, ask for one key dimension before building. Always say which dimensions you read and which you assumed.

Finish with one or two sentences: what was built and its key numbers (volume, overall size). The user can undo your whole turn with one undo.`;

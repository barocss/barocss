// The agent tool layer's contract (A5.1, O9): what each tool promises an MCP client beyond its input schema — its
// annotations (read only, destructive, idempotent; nothing reaches outside the document) and, for the tools that only
// read, the shape of their result (`outputSchema`, returned as `structuredContent`). The names, input schemas,
// annotations and output schemas are frozen in `tools-v1.json`; a change that would break a client (a tool or a
// property gone, a type or enum narrowed, a property newly required) needs a new contract version.

import { GROUPS } from './groups';

export const TOOL_CONTRACT_VERSION = 'barocss-cad-tools-v1';
/** The consolidated tools (A5.3, O11): 13 tools, each action a v1 tool (groups.ts), frozen in `tools-v2.json`. */
export const TOOL_CONTRACT_V2 = 'barocss-cad-tools-v2';

export type JsonSchema = { type?: string | string[]; properties?: Record<string, JsonSchema>; required?: string[]; items?: JsonSchema; enum?: unknown[]; additionalProperties?: boolean | JsonSchema; anyOf?: JsonSchema[]; description?: string; [k: string]: unknown };
export interface ToolAnnotations { title: string; readOnlyHint: boolean; destructiveHint: boolean; idempotentHint: boolean; openWorldHint: false }

const o = (properties: Record<string, JsonSchema>, required: string[] = []): JsonSchema => ({ type: 'object', properties, ...(required.length ? { required } : {}) });
const num: JsonSchema = { type: 'number' }, str: JsonSchema = { type: 'string' }, arr: JsonSchema = { type: 'array' }, obj: JsonSchema = { type: 'object' }, bool: JsonSchema = { type: 'boolean' }, objOrNull: JsonSchema = { type: ['object', 'null'] };

/**
 * The tools that change nothing in the document (the part, its drawing, requirements, proposals, assembly), each with
 * its result's shape where it is fixed. (`checkpoint` keeps a snapshot for the session and `select` sets the viewport
 * selection: neither changes the document.)
 */
const READ: Record<string, JsonSchema | null> = {
  get_part_summary: o({ feature_count: num, facts: obj, parameters: obj, features: arr, bodies: arr }, ['feature_count', 'facts', 'parameters', 'features', 'bodies']),
  get_image_layers: null,
  measure: o({ label: str, area: num, length: num, radius: num, distance: num, from: arr, to: arr, angle_deg: num, normal_distance: num, resolved: arr }),
  mass_properties: o({ bodies: arr, note: str }, ['bodies']),
  interference: o({ pairs: arr, note: str }, ['pairs']),
  section: o({ axis: str, at: num, cut: arr }, ['axis', 'at', 'cut']),
  wall_thickness: o({ body: str, thinnest_mm: num, at: arr, face: str, note: str }, ['body']),
  draft: o({ body: str, pull: arr, walls: arr, under_min: arr, note: str }, ['body', 'walls']),
  check_spec: o({ model_hash: str, summary: obj, failures: arr, unknowns: arr, policy: obj, validation: obj }, ['model_hash', 'summary']),
  diff: o({ from: str, to: str, diff: obj }, ['diff']),
  list_proposals: o({ proposals: arr }, ['proposals']),
  render_views: o({ legend: obj, views: obj, layout: str, notes: arr }, ['views']),
  inspect: o({ faces: arr, edges: arr }),
  select: o({ ok: bool, selected: obj }, ['ok']),
  checkpoint: o({ ok: bool, checkpoint: str, model_hash: str, checkpoints: arr }, ['ok', 'checkpoint']),
  subd_cage: o({ ok: bool, index: num, vertices: num, faces: num, creases: num, bounds: obj, validation: obj }, ['ok', 'index']),
  subd_select: o({ ok: bool, faces: arr, vertices: arr, edges: arr, count: num }, ['ok']),
  drawing_issues: o({ sheet: obj, issues: arr }, ['sheet', 'issues']),
  tolerance_suggestions: o({ mode: str, suggestions: arr }, ['mode', 'suggestions']),
  get_assembly: o({ base: obj, instances: arr, mates: arr, note: str }, ['base']),
  list_library: o({ libraries: arr, note: str }, ['libraries']),
  check_printability: o({ direction: { type: ['object', 'null'] }, rules: arr }, ['rules']),
  link_inertia: o({ links: arr }, ['links']),
  motion_torques: o({ profile: str, duration_s: num, joints: obj, sampling: str, gravity_m_s2: num }, ['profile', 'duration_s', 'joints', 'sampling']),
  size_actuators: o({ profile: str, move_s: num, cycle_s: num, joints: arr, skipped: arr, model: str, sampling: str, pending_worked_examples: arr }, ['profile', 'move_s', 'cycle_s', 'joints', 'skipped', 'model', 'sampling', 'pending_worked_examples']),
  get_brief: o({ brief: objOrNull, gaps: arr, complete: bool, unverified: arr, asked: obj, process: objOrNull, material: objOrNull }, ['brief', 'gaps', 'complete', 'unverified', 'asked', 'process', 'material']),
  get_references: o({ references: arr, datums: arr, keepouts: arr, problems: arr }, ['references', 'datums', 'keepouts']),
  check_keepouts: o({ results: arr, clear: num, violated: num, undecided: num }, ['results', 'clear', 'violated', 'undecided']),
  gravity_torques: o({ torques: obj, generalized: obj, units: obj, gravity_m_s2: num }, ['torques', 'generalized', 'units', 'gravity_m_s2']),
  sweep_path: o({ clear: bool, contact: obj, min_clearance: { type: ['object', 'null'] }, samples: num, pairs: num, skipped: arr }, ['clear', 'samples', 'pairs', 'skipped']),
  export_mjcf: o({ mjcf: str, files: arr, notes: arr, check: arr }, ['mjcf', 'files', 'notes', 'check']),
  export_urdf: o({ urdf: str, files: arr, notes: arr, check: arr }, ['urdf', 'files', 'notes', 'check']),
  forward_kinematics: o({ values: obj, links: arr, gears: arr, out_of_limits: arr }, ['values', 'links', 'gears', 'out_of_limits']),
  get_joints: o({ version: num, base: str, links: arr, joints: arr, loops: arr, couplings: arr, problems: arr, notes: arr }, ['version', 'base', 'links', 'joints', 'loops', 'couplings', 'problems', 'notes']),
};
/** Changes that only add (a feature, a part, a mate, a proposal, a library): nothing there before is altered. */
const ADDS = new Set(['run_command', 'add_features', 'extrude_image_layer', 'inflate_image_layer', 'add_part', 'add_mate', 'insert_part', 'add_library', 'add_library_part', 'propose']);
/** Changes that may alter or remove what is there; `true`: the same call twice has no further effect. */
const ALTERS: Record<string, boolean> = {
  edit_feature: true, delete_feature: true, apply_ops: false, run_script: false, restore: true, restore_best: true, set_requirements: true, set_brief: true, ask_user: false, add_reference: false, add_datum: false, add_keepout: false, delete_reference_item: true, accept_proposal: true,
  subd_move: false, subd_extrude: false, subd_insert_loop: false, subd_bridge: false, subd_fill: false, subd_weld: false, subd_crease: true, subd_delete: false,
  place_part: true, delete_part: true, edit_mate: true, delete_mate: true, snap_part: true, orient_for_print: true,
  auto_dimension: true, fix_drawing: false, accept_tolerances: false, set_drawing: true, set_joints: true,
};

const titleOf = (name: string) => name.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());

/** A tool's annotations; throws for a tool the contract does not classify (each new tool must be). */
export function annotationsOf(name: string): ToolAnnotations {
  // (A consolidated tool: read only if every action is, destructive if any is, idempotent if all are; describe reads.)
  if (name === 'describe') return { title: GROUPS.describe.title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
  if (name in GROUPS) {
    const each = Object.values(GROUPS[name].actions).map(([v1]) => annotationsOf(v1));
    return { title: GROUPS[name].title, readOnlyHint: each.every(a => a.readOnlyHint), destructiveHint: each.some(a => a.destructiveHint), idempotentHint: each.every(a => a.idempotentHint), openWorldHint: false };
  }
  if (name in READ) return { title: titleOf(name), readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
  if (ADDS.has(name)) return { title: titleOf(name), readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
  if (name in ALTERS) return { title: titleOf(name), readOnlyHint: false, destructiveHint: true, idempotentHint: ALTERS[name], openWorldHint: false };
  throw new Error(`The tool contract does not classify "${name}": add it to READ, ADDS or ALTERS in src/chat/contract.ts.`);
}
/** A read tool's result shape (undefined: the tool changes the document, or its result has no fixed shape). */
export const outputSchemaOf = (name: string): JsonSchema | undefined => READ[name] ?? undefined;

/** Problems of a value against a schema (type, required, properties, items, enum); empty when it conforms. */
export function validate(schema: JsonSchema, value: unknown, at = '$'): string[] {
  const out: string[] = [];
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const kind = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value === 'number' && Number.isInteger(value) && types.includes('integer') ? 'integer' : typeof value;
    if (!types.includes(kind) && !(kind === 'integer' && types.includes('number'))) return [`${at}: ${kind}, not ${types.join(' | ')}`];
  }
  if (schema.enum && !schema.enum.some(e => JSON.stringify(e) === JSON.stringify(value))) out.push(`${at}: not one of ${JSON.stringify(schema.enum)}`);
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const rec = value as Record<string, unknown>;
    for (const k of schema.required ?? []) if (!(k in rec)) out.push(`${at}.${k}: missing`);
    for (const [k, sub] of Object.entries(schema.properties ?? {})) if (k in rec) out.push(...validate(sub, rec[k], `${at}.${k}`));
    if (schema.additionalProperties === false) for (const k of Object.keys(rec)) if (!(k in (schema.properties ?? {}))) out.push(`${at}.${k}: not allowed`);
  }
  if (Array.isArray(value) && schema.items) value.forEach((x, i) => out.push(...validate(schema.items!, x, `${at}[${i}]`)));
  return out;
}

/** A schema without its descriptions (wording may change freely; the shape may not). */
export function shapeOf(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(shapeOf);
  if (!schema || typeof schema !== 'object') return schema;
  return Object.fromEntries(Object.entries(schema as Record<string, unknown>).filter(([k]) => k !== 'description').sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => [k, k === 'properties' ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a < b ? -1 : 1).map(([p, s]) => [p, shapeOf(s)])) : shapeOf(v)]));
}

/** One tool as the contract freezes it. */
export interface ContractEntry { name: string; annotations: ToolAnnotations; input: unknown; output?: unknown }
export function contractOf(tools: readonly { name: string; input_schema: unknown }[]): ContractEntry[] {
  return tools.map(t => { const out = outputSchemaOf(t.name); return { name: t.name, annotations: annotationsOf(t.name), input: shapeOf(t.input_schema), ...(out ? { output: shapeOf(out) } : {}) }; }).sort((a, b) => a.name < b.name ? -1 : 1);
}

/**
 * What would break a client of `before` in `after`: a tool gone, an input property gone, a type or enum narrowed, a
 * property newly required, a read-only tool that now changes things; an output property gone or no longer required,
 * its type changed. (Additions, new optional properties and wider enums are compatible.)
 */
export function breakingChanges(before: readonly ContractEntry[], after: readonly ContractEntry[]): string[] {
  const out: string[] = [], now = new Map(after.map(e => [e.name, e]));
  for (const b of before) {
    const a = now.get(b.name);
    if (!a) { out.push(`${b.name}: removed`); continue; }
    if (b.annotations.readOnlyHint && !a.annotations.readOnlyHint) out.push(`${b.name}: no longer read only`);
    if (!b.annotations.destructiveHint && a.annotations.destructiveHint) out.push(`${b.name}: now destructive`);
    out.push(...narrowed(b.input as JsonSchema, a.input as JsonSchema, `${b.name} input`, 'input'));
    if (b.output) out.push(...(a.output ? narrowed(b.output as JsonSchema, a.output as JsonSchema, `${b.name} output`, 'output') : [`${b.name}: output schema removed`]));
  }
  return out;
}
function narrowed(b: JsonSchema, a: JsonSchema, at: string, side: 'input' | 'output'): string[] {
  const out: string[] = [];
  if (JSON.stringify(b.type) !== JSON.stringify(a.type) && b.type !== undefined) out.push(`${at}: type ${JSON.stringify(b.type)} → ${JSON.stringify(a.type)}`);
  if (b.enum && a.enum && b.enum.some(v => !a.enum!.some(w => JSON.stringify(w) === JSON.stringify(v)))) out.push(`${at}: enum narrowed`);
  if (!b.enum && a.enum && side === 'input') out.push(`${at}: enum added`);
  const bp = b.properties ?? {}, ap = a.properties ?? {};
  for (const k of Object.keys(bp)) {
    if (!(k in ap)) { out.push(`${at}.${k}: removed`); continue; }
    out.push(...narrowed(bp[k], ap[k], `${at}.${k}`, side));
  }
  if (side === 'input') for (const k of a.required ?? []) if (!(b.required ?? []).includes(k)) out.push(`${at}.${k}: newly required`);
  if (side === 'output') for (const k of b.required ?? []) if (!(a.required ?? []).includes(k)) out.push(`${at}.${k}: no longer required`);
  if (b.items && a.items) out.push(...narrowed(b.items, a.items, `${at}[]`, side));
  return out;
}

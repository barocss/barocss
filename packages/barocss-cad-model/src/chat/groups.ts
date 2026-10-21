// The consolidated tool set (A5.3, O11; contract `barocss-cad-tools-v2`): 13 tools, each an `action` beside the
// arguments of the v1 tool it stands for. A call is the v1 call: the same gates, results and refusals, so v1 and v2
// are one tool layer listed two ways. The v1 names stay callable (aliases) until the A/B (A5.5) decides.
// `describe` gives an action's full v1 description and schema, a command's values or a feature kind's JSON on request,
// so the list a model reads every turn stays short.

export interface Group {
  title: string;
  /** What the tool is for, one or two sentences. */
  about: string;
  /** action → [the v1 tool, a short hint of its arguments]. */
  actions: Record<string, readonly [string, string]>;
}

export const GROUPS: Record<string, Group> = {
  model: { title: 'Model (script)', about: 'Builds or changes the part with a script, all or nothing (the language is below).', actions: { run: ['run_script', 'source, dryRun?'] } },
  features: {
    title: 'Features',
    about: 'Changes the feature tree one step at a time. Faces and edges by name ("n1.top", "n1.side0|n1.side1") or selector ({"feature": 1, "role": "top"}, {"normal": [0, 0, 1], "pick": "max"}, {"between": [face, face]}).',
    actions: {
      command: ['run_command', 'command, values?, faces?, edges?, bodies?, point? — a studio command as the toolbar runs it'],
      add: ['add_features', 'features: [node] — raw feature nodes (sketches, extrudes, revolves, sweeps, lofts, …)'],
      edit: ['edit_feature', 'index, values? | feature?'],
      delete: ['delete_feature', 'index'],
      material: ['set_material', 'material, bodies?, part? — what bodies are made of'],
      stock: ['set_stock', 'rows?, allowance? — the shop\'s stock list and the allowance'],
      batch: ['apply_ops', 'ops: [{tool, args, opId?}], dryRun? — several calls all or nothing'],
    },
  },
  query: {
    title: 'Query',
    about: 'Reads the part without changing it.',
    actions: {
      summary: ['get_part_summary', 'body?, page? — features, parameters, bodies, faces and edges by name'],
      inspect: ['inspect', 'faces?, edges? — detail, neighbours, the feature that made them'],
      measure: ['measure', 'a, b? — a face or edge, or the distance and angle between two'],
      mass: ['mass_properties', 'bodies?'],
      interference: ['interference', 'bodies? — overlap and clearance'],
      section: ['section', 'axis, at'],
      wall: ['wall_thickness', 'body?, below?'],
      draft: ['draft', 'body?, pull?, min_deg?'],
      cutlist: ['cut_list', 'csv? — a frame\u2019s members to cut: rows of identical ones, lengths, end cuts, mass (FR4a)'],
      render: ['render_views', 'highlight?, section? — pictures of the part'],
      select: ['select', 'faces?, edges?, bodies? — shows them selected in the studio'],
      manufacturability: ['check_printability', 'direction?, finish?, sides? — the report for the part\'s process: printing, injection moulding (pull, finish, halves), machining'],
    },
  },
  history: {
    title: 'History',
    about: 'Snapshots of the part this session.',
    actions: { checkpoint: ['checkpoint', 'name'], restore: ['restore', 'name'], best: ['restore_best', '— the best snapshot by the checks'], diff: ['diff', 'from?, to? — checkpoint names, "best" or "current"'] },
  },
  requirements: {
    title: 'Requirements',
    about: 'The brief (the part\'s intent), the locked reference bodies it must fit (datums, keep-outs), and the checks the kernel runs.',
    actions: { set: ['set_requirements', 'requirements: [{id, source, hard?, check}], replace?'], check: ['check_spec', 'validate? — every check against the part'], brief: ['set_brief', 'fields: {purpose | process | material | …: {value, basis, source?, why?} | null} — the intent, before the checks'], gaps: ['get_brief', '— the brief, its gaps and what it applies'], references: ['get_references', '— the locked reference bodies, their faces, datums and keep-outs'], reference: ['add_reference', 'name, step | mesh, at? — a locked reference body'], datum: ['add_datum', 'reference + face + kind | reference + vertex | kind + origin + normal | direction'], keepout: ['add_keepout', 'box | cylinder | around + offset, clearance?'], drafts: ['get_drafts', '— features from an image or drawing and their dimensions to confirm'], drawing: ['import_drawing', 'dxf, name?, plane? — a DXF profile as a sketch draft'], unref: ['delete_reference_item', 'id — a datum or keep-out'], keepouts: ['check_keepouts', 'keepout?, body? — clear, violated or undecided, the chord tolerance stated'], ask: ['ask_user', 'questions: [{id, text, kind, options?, unit?, blocks: {field} | {requirement}}] — only what blocks, ≤ 5, ≤ 2 batches'] },
  },
  proposals: {
    title: 'Proposals',
    about: 'A change tried on a copy for the user to accept; the part stays as it is.',
    actions: { propose: ['propose', 'title, ops (as features.batch), plan?, requirements?'], accept: ['accept_proposal', 'id, leave_out?'], list: ['list_proposals', 'all?'] },
  },
  assembly: {
    title: 'Assembly',
    about: 'Parts placed and mated with the base part; changes to it are proposed. A part tool with "part" builds that part.',
    actions: {
      get: ['get_assembly', 'faces_of?'], add_part: ['add_part', 'name, copy_of?, position?, rotation?, grounded?'], place: ['place_part', 'part, position?, rotation?, name?, grounded?, hidden?'],
      delete_part: ['delete_part', 'part'], add_mate: ['add_mate', 'kind, a, b, distance?, angle?, flip?'], edit_mate: ['edit_mate', 'id, distance?, angle?, flip?'],
      delete_mate: ['delete_mate', 'id'], insert: ['insert_part', 'library, part, variant?, params?, name?, position?, rotation?'], snap: ['snap_part', 'a, b, offset?'],
      joints: ['get_joints', '— the assembly as links and joints from its base link'], pose: ['forward_kinematics', 'values: {joint key: radians | mm} — where each part is'], inertia: ['link_inertia', '— each link\'s mass, centre of mass and inertia (SI, link frame)'], urdf: ['export_urdf', 'name? — the robot as URDF, checked'], mjcf: ['export_mjcf', 'name? — the robot as a MuJoCo MJCF model, checked'], sweep: ['sweep_path', 'to, from? — a joint move checked for collisions, certified'], gravity: ['gravity_torques', 'values?, g? — the static torque each joint holds'], move: ['motion_torques', 'to, profile, limits, from?, joint_limits? — a move\'s peak and RMS torques'], size: ['size_actuators', 'to, profile, limits, from?, joint_limits?, dwell_s?, life_h?, estop_rad_s2?, coupled?, motors?, reducers? — a motor and reducer per joint, every value sourced'], set_joints: ['set_joints', 'base?, joints?: {key: {lower?, upper?, effort?, velocity?} | null}'],
    },
  },
  library: {
    title: 'Library',
    about: 'Standard and team parts.',
    actions: { standards: ['standards_lookup', 'table?, row?, field? — a standards-derived value and its source'], list: ['list_library', 'library?'], add: ['add_library', 'library — a library document'], add_part: ['add_library_part', 'library, part, face, point, variant?, params?, x_direction?, context?'] },
  },
  print: { title: '3D print', about: 'Printability on an FDM printer (check: as query.manufacturability).', actions: { check: ['check_printability', 'direction?'], orient: ['orient_for_print', 'apply?'] } },
  drawing: {
    title: 'Drawing',
    about: 'The part\'s 2D drawing; a drawing change is always the user\'s, so make it as ops of proposals.propose.',
    actions: {
      issues: ['drawing_issues', ''], tolerances: ['tolerance_suggestions', 'mode?'], auto: ['auto_dimension', 'layout?'], fix: ['fix_drawing', 'codes?'],
      accept: ['accept_tolerances', 'ids?, mode?'], set: ['set_drawing', 'sheet?, scale?, projection?, front?, views?, tolerancing?, title?'],
    },
  },
  subd: {
    title: 'SubD',
    about: 'A SubD cage (features.command subd-box, subd-torus or subd-tube makes one), by its feature index.',
    actions: {
      cage: ['subd_cage', 'index'], select: ['subd_select', 'index, what, normal?, within_deg?, box?, edge?, limit?'], move: ['subd_move', 'index, delta, vertices?, edges?, faces?'],
      extrude: ['subd_extrude', 'index, faces? | edges?, offset? | distance?'], insert_loop: ['subd_insert_loop', 'index, edge, t?'], bridge: ['subd_bridge', 'index, edges'],
      fill: ['subd_fill', 'index, edges'], weld: ['subd_weld', 'index, vertices, tolerance?'], crease: ['subd_crease', 'index, edges? | faces?, on?'], delete: ['subd_delete', 'index, faces'],
    },
  },
  image: {
    title: 'Image',
    about: 'A traced picture (a character, logo, icon) as solids.',
    actions: { layers: ['get_image_layers', 'image?'], extrude: ['extrude_image_layer', 'width_mm, height, image?, layer?, base?, orientation?, at?, y?'], inflate: ['inflate_image_layer', 'width_mm, depth, image?, layer?, mode?, body_depth?, orientation?, at?, y?'] },
  },
  describe: { title: 'Describe', about: '', actions: {} },
};

/** The v1 tool each group action stands for, keyed `group.action`. */
export const V1_OF: ReadonlyMap<string, string> = new Map(Object.entries(GROUPS).flatMap(([g, x]) => Object.entries(x.actions).map(([a, [v1]]) => [`${g}.${a}`, v1] as const)));
/** Actions that name a v1 tool another action already stands for (O77): kept for agents that know them. */
export const V2_ALIASES: ReadonlySet<string> = new Set(['print.check']);
/** The `group.action` of each v1 tool: its first, not an alias (query.manufacturability, not print.check). */
export const V2_OF: ReadonlyMap<string, string> = new Map([...V1_OF].filter(([k]) => !V2_ALIASES.has(k)).map(([k, v]) => [v, k]));

/** A v2 call as the v1 call it stands for, or why it is not one; null for a name that is not a group. */
export function v1Call(name: string, input: unknown): { name: string; args: Record<string, unknown> } | { error: string } | null {
  const g = GROUPS[name];
  if (!g || name === 'describe') return null;
  const args = input && typeof input === 'object' && !Array.isArray(input) ? { ...(input as Record<string, unknown>) } : {};
  const actions = Object.keys(g.actions);
  // (A group of one action takes it without saying so: model {source}.)
  const action = args.action === undefined && actions.length === 1 ? actions[0] : args.action;
  delete args.action;
  if (typeof action !== 'string' || !g.actions[action]) return { error: `${name} takes "action": one of ${actions.join(', ')}.` };
  return { name: g.actions[action][0], args };
}

/**
 * A v1 call written as its v2 call (`measure {a}` → `query {action: "measure", a}`): the test hook
 * `CAD_TOOLS_VIA_V2=1` sends every call this way, so the whole suite replays through the consolidated layer.
 */
export function viaV2(name: string, input: unknown): [string, unknown] {
  const to = V2_OF.get(name);
  if (!to || typeof process === 'undefined' || process.env?.CAD_TOOLS_VIA_V2 !== '1') return [name, input];
  const [group, action] = to.split('.');
  return [group, { ...(input && typeof input === 'object' && !Array.isArray(input) ? input : {}), action }];
}

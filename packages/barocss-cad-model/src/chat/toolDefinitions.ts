// The chat tools' definitions (R3, moved verbatim from chat/tools.ts): which tools a batch may hold and which change
// the part, the v1 tools' descriptions and input schemas, describe, the argument check, the tools list and the system
// prompt — in their order, so what a model reads is the same to the byte.
import { commandById } from '../app/commands';
import type { ToolDefinition } from './api';
import { CAGE_MUTATORS, CAGE_TOOLS } from './cageTools';
import { DRAWING_CHANGES, DRAWING_TOOLS } from './drawing';
import { OUTPUT_TOOLS } from './outputDefinitions';
import { ROW_KINDS } from '../engine/rowDefinitions';
import { GROUPS, V2_OF } from './groups';
import { ROBOT_TOOLS } from './robot';
import { BRIEF_TOOLS } from './brief';
import { QUESTION_TOOLS } from './questions';
import { DRAFT_TOOLS } from './drafts';
import { STANDARDS_TOOLS } from '../standards/provenance';
import { REFERENCE_TOOLS } from './references';
import { ASSEMBLY_TOOLS } from './assembly';
import { CHAT_COMMANDS, COMMAND_DOCS } from './part/features';

/** The tools a batch may hold (those changing the base part, one at a time). */
// (The drawing tools that change it ride in ops: an agent proposes a drawing change, R14.5.)
export const BATCHABLE = new Set([...DRAWING_CHANGES, 'load_rows', 'set_parameters', 'set_joints', 'set_frames', 'set_waypoint', 'lock_part', 'set_inputs', 'set_variants', 'set_brief', 'set_material', 'set_stock', 'set_casting', 'set_frame_stock', 'set_frame_sections', 'set_welds', 'import_drawing', 'add_keepout', 'add_datum', 'set_requirements', 'run_script', 'run_command', 'add_features', 'edit_feature', 'delete_feature', 'add_part', 'place_part', 'delete_part', 'add_mate', 'edit_mate', 'delete_mate', 'insert_part', 'snap_part', 'add_library_part', ...CAGE_MUTATORS]);
/** The tools a batch (apply_ops, a patch) may hold (A7.5: a candidate's unsupported op is refused by name before it runs). */
export const BATCHABLE_TOOLS: ReadonlySet<string> = BATCHABLE;
export const MUTATORS = new Set(['load_rows', 'set_stock', 'set_frame_stock', 'set_parameters', 'set_frame_sections', 'apply_ops', 'run_script', 'restore', 'set_requirements', 'import_drawing', 'restore_best', 'run_command', 'add_features', 'edit_feature', 'delete_feature', 'extrude_image_layer', 'inflate_image_layer', 'add_library_part', ...CAGE_MUTATORS]);

export const isMutator = (name: string) => MUTATORS.has(name);

const nameList = { type: 'array', items: { type: 'string' } };
/** A face or edge: its name, or a selector (A1.2) that resolves to it (the result reports the name). */
const SELECTOR = 'or a selector: a feature\'s face by role {"feature": index or id, "role": "top" | "bottom" | "side2" (by position) or "side[e3]" (a sketch drawn in the sketcher: by its edge\'s id) | "side" (one of its sides) | "cut" …}, the flat face facing a direction {"normal": [0, 0, 1], "pick": "max" | "min"}, either with "on": a body key and "all": true for every face that fits; an edge {"between": [face, face]}';
const selectorList = (what: string) => ({ type: 'array', items: { anyOf: [{ type: 'string' }, { type: 'object' }] }, description: `${what}: names, ${SELECTOR}.` });
const oneSelector = (what: string) => ({ anyOf: [{ type: 'string' }, { type: 'object' }], description: `${what}: a name, ${SELECTOR}.` });
const commandDoc = CHAT_COMMANDS.map(id => {
  const c = commandById(id)!, d = COMMAND_DOCS[id];
  const values = Object.entries(d.values).map(([k, v]) => `${k}: ${v}`).join('; ');
  return `- ${id} (${c.label}) — select ${d.selection}${values ? `; values: ${values}` : ''}`;
}).join('\n');

/**
 * `describe` (A5.3): what the consolidated list leaves out, on request — a tool's actions, an action's full v1
 * description and schema, a command's selection and values, a feature kind's node JSON.
 */
export function describe(args: Record<string, unknown>): Record<string, unknown> | { error: string } {
  if (typeof args.command === 'string') {
    const c = commandById(args.command.replace(/_/g, '-')), d = c && COMMAND_DOCS[c.id];
    if (!c || !d || !CHAT_COMMANDS.includes(c.id)) return { error: `No command "${args.command}"; commands: ${CHAT_COMMANDS.join(', ')}.` };
    return { command: c.id, label: c.label, hint: c.hint, selection: d.selection, values: d.values };
  }
  if (typeof args.feature === 'string') {
    const add = TOOLS.find(t => t.name === 'add_features')!, lines = add.description.split('\n').filter(l => l.includes(`"kind":"${args.feature}"`));
    if (!lines.length) return { error: `No feature kind "${args.feature}"; kinds: ${featureKinds().join(', ')}.` };
    return { feature: args.feature, nodes: lines.map(l => l.replace(/^- /, '')), note: 'Dimensions in mm; Dim = a number or {"parameter": name}; i = a node index.' };
  }
  const tool = typeof args.tool === 'string' ? args.tool : undefined, g = tool ? GROUPS[tool] : undefined;
  if (tool && (!g || tool === 'describe')) return { error: `No tool "${tool}"; tools: ${Object.keys(GROUPS).filter(n => n !== 'describe').join(', ')}.` };
  if (!g) return { tools: Object.fromEntries(Object.entries(GROUPS).filter(([n]) => n !== 'describe').map(([n, x]) => [n, Object.keys(x.actions)])) };
  const action = typeof args.action === 'string' ? args.action : undefined;
  if (action === undefined) return { tool, actions: Object.fromEntries(Object.entries(g.actions).map(([a, [, hint]]) => [a, hint])) };
  const v1 = g.actions[action]?.[0], t = v1 && TOOLS.find(x => x.name === v1);
  if (!t) return { error: `${tool} has no action "${action}"; actions: ${Object.keys(g.actions).join(', ')}.` };
  return { tool, action, description: t.description, input: t.input_schema };
}
/** The feature kinds add_features documents. */
function featureKinds(): string[] {
  const add = TOOLS.find(t => t.name === 'add_features')!;
  return [...new Set([...add.description.matchAll(/"kind":"([a-z-]+)"/g)].map(m => m[1]).filter(k => k !== 'line' && k !== 'arc'))];
}
export { featureKinds };

const PART_TOOLS: ToolDefinition[] = [
  {
    name: 'get_part_summary',
    description: 'The current part: every feature node by index (sketch outlines abbreviated), parameters, and each visible body with volume and bounds, and its faces and edges by persistent name (e.g. face "n1.top", edge "n1.side0|n1.side1"; a sketch drawn in the sketcher names its walls by its edges\' ids, "n2.side[e3]", which stay as the sketch is edited). On a big part, faces and edges are listed for the one body named in "body". Call it before referring to faces or edges you have not seen in a result.',
    input_schema: { type: 'object', properties: { body: { type: 'string', description: 'A body key (e.g. "b27") to list the faces and edges of.' }, page: { type: 'integer', description: 'The page of that body\'s faces and edges (60 a page, from 1).' } }, additionalProperties: false },
  },
  {
    name: 'run_command',
    description: `Runs one studio command, exactly as the toolbar and its HUD would: the same availability rules, value ranges and defaults (omitted values take the HUD default). Faces, edges and bodies are selected by name; the command applies to that selection. Commands:\n${commandDoc}\nThe result has the bodies after evaluation (volume, bounds, face and edge names) or the refusal reason; nothing changes on a refusal.`,
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'string', enum: CHAT_COMMANDS },
        values: { type: 'object', description: 'Command values by key (numbers in mm or degrees; choices as strings).', additionalProperties: { type: ['number', 'string'] } },
        faces: selectorList('Faces to select'),
        edges: selectorList('Edges to select'),
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
- Sheet metal (each with the sheet's rules: "thickness":T, "bendRadius":R (inner), and either "kFactor":K 0–1 (the neutral layer at R + K·T; K from the user's shop, else say it is an estimate) or "bendTable":{"id","sources":[{"id","label","url"?}],"rows":[{"thicknessMM","radiusMM","angleDegrees"?,"kFactor"|"allowanceMM"|"deductionMM","source":id | "estimate":true}]} — the shop's table, a bend outside it refused): {"kind":"sheet-base","sketch":i,…rules,"reverse"?:bool} (a plate T thick from a closed sketch) | {"kind":"sheet-contour","path":[[x,y],…],"side":"left"|"right","width":w,"plane"?:{origin,normal,xAxis},…rules} (an open path, one skin of the sheet, the material to its side looking along it, a bend at each corner, extruded w along the plane's normal; faces .leg<i>.a/.b, .bend<k>.inner/.outer, .start, .end, .front, .back) | {"kind":"sheet-flange","parent":Ref,"edges":[edge name],"length":L,"angleDegrees"?:deg,"bendRadius"?:r,"measure"?:"outer"|"inner"|"tangent","position"?:"material-inside"|"material-outside"|"bend-outside","offsets"?:[a,b],"relief"?:{"kind":"rectangular"|"obround","width":w,"depth":d} | {"kind":"none"}} (an edge flange on a sheet's straight skin edge, bent up from that skin; with offsets its relief is required, width and depth given — no defaults; the sheet's T is the usual estimate) | {"kind":"sheet-corner-relief","parent":Ref,"edges":[corner edge name],"shape":"square"|"round","size":s} (a plate's square corner cut off before flanging its two edges; size at least R + T, round √2 that)
- Skeleton (FRf): {"kind":"skeleton","points":[[x,y,z],…],"segments":[[from,to],…],"constraints"?:[{"kind":"fixed"|"coincident"|"length"|"distance"|"angle"|"parallel"|"perpendicular"|"on-axis"|"on-plane"|"along",…}]} (FRg: solved on add and edit; the result's skeletons: status, dof, redundant, free) — no body; frames on it follow its edits ("follows":{"skeleton":k} in place of points and segments; {"sketch":k}: a sketch's straight edges; {"part":id,"sketch":feature id}: a placed part's sketch, base frames only, its revision pinned — get_part_summary's followed_changed says when to relink).
- Frame (FR2): {"kind":"frame","points":[[x,y,z],…],"segments":[[from,to],…],"section":S,"anchor"?,"offset"?,"roll"?,"mirror"?:bool,"up"?,"overrides"?:[{"member":k,"section"?:S,"anchor"?,"offset"?,"roll"?,"mirror"?}]} — a member along each segment (point indices), each its own body (sides part0, part1, …); a member as frame-member's below; mirror turns the section over across its own y axis; faces .m<k>.<role>, .m<k>.start/.end. No two segments on the same points or overlapping on one line. "corners"?:{"default"?:"mitre"|"butt"|"none","at"?:[{"point":i,"kind","through"?:member}]} finishes points where exactly two members end (mitre: both on the halfway plane, the same section turned alike; butt: through runs on, the other ends on its face; none: square, overlapping); left out, no corner is finished; "multi":"order"|"none" (three or more ends: an ordered trim — the first, by "order" or the larger section, runs through, each next trimmed to the envelopes before it); "tee":"butt"|"cope"|"none" (a member ending on another's length); "at" kinds also "cope" (to the through member's envelope), "order" with "order":[members], and "trim":"face"|"envelope" on a butt (a butt on an open side — an angle's leg end, a round tube, a round corner — is refused BUTT_ON_OPEN_SIDE: trim to the envelope); faces .m<k>.start.mitre, .m<k>.end.butt, .m<k>.end.cope, .m<k>.end.trim. "trims"?:[{"member":k,"end":"start"|"end","plane":{"origin","normal"}} | {…,"body":Ref}] trims an end no joint finishes to a plane (run on to meet it) or to an earlier body (not consumed); crossing members are refused MEMBERS_CLASH
- Structural member (FR1): {"kind":"frame-member","section":S,"start":[x,y,z],"end":[x,y,z],"anchor"?:"centroid"|"origin"|"bottom-left"|…|"top-right","offset"?:[dx,dy],"roll"?:deg,"up"?:[x,y,z]} — the section square to the line start→end, extruded its length; the anchor point on the line (default the centroid), the section moved by offset, its y along up (default +Z) made square to the line (a vertical line takes +X), turned roll°. S, every dimension given (no default sizes or radii; ask for the stock's or say they are estimates): {"kind":"rect-tube","width","height","wall","outerRadius","innerRadius"?} | {"kind":"round-tube","diameter","wall"} | {"kind":"angle","legX","legY","thickness","rootRadius","toeRadius"} | {"kind":"channel","height","width","web","flange","rootRadius","toeRadius"?,"flangeSlope"?} | {"kind":"i-beam","height","width","web","flange","rootRadius","toeRadius","flangeSlope"} (I/H: all fields required, including explicit zero; channel new fields omitted = 0; slope rise/run; flange thickness at overhang midpoint) | {"kind":"tslot","size","cells":1|2,"openSlots"?:0–4 (one cell),"opening","lip","undercut","depth","bore"} | {"kind":"sketch","sketch":i} (a closed sketch, holes allowed). Faces by role: .top/.bottom/.left/.right/.round.*, .bore.*, .back.x/.face.y/.root/.toe.x, .web/.tip.top, .<slot>.floor …, and the ends .start/.end
- {"kind":"hole","parent":Ref,"center":[a,b],"radius":r,"axis"?:"x"|"y"|"z","side"?:"min"|"max","depth"?:d} (omit depth for through)
- {"kind":"fillet","parent":Ref,"edges":[names],"radius":r,"section"?:{"kind":"conic","rho":0..1} | {"kind":"g2","tension"?:0..1}} (or "radii":[{"at":[x,y,z],"radius":r,"atEnd"?:true}, …] — 2 to 16 points on the edges, the radius varying between them; atEnd: a chain end, followed when earlier features move it; then radius is the first point's; any section) | {"kind":"chamfer","parent":Ref,"edges":[names],"distance":d} | {"kind":"shell","parent":Ref,"thickness":t,"open":[face names]}
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
    description: 'Deletes a feature (and the sketches only it used). Refused while a later feature uses it. Later features move down one index per deleted node; face and edge names keep their feature ids (`n<k>`), so names in results stay as they were.',
    input_schema: { type: 'object', properties: { index: { type: 'integer' } }, required: ['index'], additionalProperties: false },
  },
  {
    name: 'get_image_layers',
    description: 'The traced outlines of an attached image (a character, logo, icon or silhouette): its silhouette and its flat colour regions, each with colour, share of the figure, region and hole counts and its box within the silhouette, plus the silhouette\'s aspect ratio. Use it before extrude_image_layer.',
    input_schema: { type: 'object', properties: { image: { type: 'integer', description: 'Image number in this conversation (1 = first; default the latest).' } }, additionalProperties: false },
  },
  {
    name: 'extrude_image_layer',
    description: 'Builds a solid from a traced image layer: its outline (with holes and separate islands) scaled so the whole silhouette is width mm wide, extruded `height` mm, starting `base` mm off the sketch plane. Every layer of an image uses the same scale and placement, so stacking them makes a relief (a keychain, badge, cookie cutter or figure plaque): the silhouette as the base, then colour layers on top of it (base = the base\'s thickness) to raise details like eyes, mouth and outlines. orientation "flat" lies on XY (thickness up +Z); "standing" stands it on XZ (figure upright, thickness towards −Y, `y` sets the plane). Later run_command union can join the layers into one body.',
    input_schema: {
      type: 'object',
      properties: {
        image: { type: 'integer' }, layer: { type: 'string', description: 'Layer id from get_image_layers (default "silhouette").' },
        width: { type: 'number' }, height: { type: 'number' }, base: { type: 'number' },
        orientation: { type: 'string', enum: ['flat', 'standing'] }, at: { type: 'array', items: { type: 'number' }, description: '[x, y] of the silhouette\'s lower-left corner on the sketch plane (default [0, 0]).' },
        y: { type: 'number', description: 'Standing only: the Y of the sketch plane.' },
      },
      required: ['width', 'height'], additionalProperties: false,
    },
  },
  {
    name: 'inflate_image_layer',
    description: 'A rounded three-dimensional version of a traced image layer (a plush, toy or figure look rather than a flat slab). mode "body": each region of the layer (normally the silhouette) becomes a smooth pebble-like solid, depth mm front to back, symmetric about its mid plane, round all along its rim. mode "bump": each region (eyes, nose, cheeks, buttons, a muzzle) becomes a smooth dome standing depth mm out of the front surface of the inflated silhouette, placed where it is in the picture — pass body_depth (the silhouette\'s depth) and the same width in mm, at and orientation. Filled areas are inflated by their outer outline (small holes, like a nose inside a muzzle, are covered); outline strokes are skipped. Bumps stay separate bodies sunk into the surface.',
    input_schema: {
      type: 'object',
      properties: {
        image: { type: 'integer' }, layer: { type: 'string' }, mode: { type: 'string', enum: ['body', 'bump'] },
        width: { type: 'number' }, depth: { type: 'number' }, body_depth: { type: 'number' },
        orientation: { type: 'string', enum: ['flat', 'standing'] }, at: { type: 'array', items: { type: 'number' } }, y: { type: 'number' },
      },
      required: ['width', 'depth'], additionalProperties: false,
    },
  },
  {
    name: 'measure',
    description: 'Measures one face or edge (area, length, radius), or the distance between two (and the angle between planes or straight edges, the normal distance between parallel planes).',
    input_schema: { type: 'object', properties: { a: oneSelector('A face or edge'), b: oneSelector('An optional second face or edge') }, required: ['a'], additionalProperties: false },
  },
  {
    name: 'set_material',
    description: 'Sets what bodies are made of: a material id from the material library (their mass, the BOM and a library part\'s checks read it before the brief\'s material). bodies: body keys (default: all of the part).',
    input_schema: { type: 'object', properties: { material: { type: 'string' }, bodies: { ...nameList, description: 'Body keys (default: all).' } }, required: ['material'], additionalProperties: false },
  },
  {
    name: 'set_stock',
    description: 'Loads machining stock from a person-supplied conversation JSON file, and/or sets allowance per face in mm. file is the attachment reference. Raw rows are refused as ROWS_NOT_FROM_PERSON. File rows merge by id, keeping id, block size [a,b,c] or bar diameter/maxLength, and their original source; remove lists row ids to drop.',
    input_schema: { type: 'object', properties: { file: { type: 'string' }, rows: { type: 'array', description: 'Refused: use a person-supplied file.', items: { type: 'object' } }, remove: { type: 'array', items: { type: 'string' } }, allowance: { type: 'number' } }, additionalProperties: false },
  },
  {
    name: 'set_casting',
    description: 'Sets a casting pattern\'s inputs (IM8b): machined, the faces machined after casting (flat ones get the machining allowance on the pattern); allowance, your machining allowance (mm a face; unset: the process\'s table by the part\'s size); shrink, your shrinkage (a ratio, mm/mm; unset: the table\'s by the alloy and size); gate, where the metal comes in ([x, y, z] mm on the part: the report\'s hot spots are fed from it, IM8c). The manufacturability report shows them and their sources; cad-cli pattern writes the pattern.',
    input_schema: { type: 'object', properties: { machined: { type: 'array', items: { type: 'string' } }, allowance: { type: 'number' }, shrink: { type: 'number' }, gate: { type: 'array', items: { type: 'number' } } }, additionalProperties: false },
  },
  {
    name: 'set_parameters',
    description: 'The part\'s named parameters (O21), all or nothing, in this order: add {name: value} new ones; set {name: value} existing ones; rename {from: to} (every use follows); bind [{feature: index or id, value: its key as edit_feature names it, parameter}] a feature\'s value to one (it then follows the parameter); remove [name] (each use keeps its value). Values in mm, or degrees where bound to an angle. Then evaluated: one that does not build is refused, the part unchanged.',
    input_schema: { type: 'object', properties: { add: { type: 'object', additionalProperties: { type: 'number' } }, set: { type: 'object', additionalProperties: { type: 'number' } }, rename: { type: 'object', additionalProperties: { type: 'string' } }, bind: { type: 'array', items: { type: 'object', properties: { feature: { type: ['integer', 'string'] }, value: { type: 'string' }, parameter: { type: 'string' } }, required: ['feature', 'value', 'parameter'], additionalProperties: false } }, remove: { type: 'array', items: { type: 'string' } } }, additionalProperties: false },
  },
  {
    name: 'set_frame_stock',
    description: 'Loads frame stock from a person-supplied conversation JSON file, and/or sets the saw kerf in mm. file is the attachment reference. Raw rows are refused as ROWS_NOT_FROM_PERSON. File rows merge by id, keeping id, length or lengthMM, count, section and source; remove lists row ids to drop.',
    input_schema: { type: 'object', properties: { file: { type: 'string' }, rows: { type: 'array', description: 'Refused: use a person-supplied file.', items: { type: 'object' } }, remove: { type: 'array', items: { type: 'string' } }, kerf: { type: 'number' } }, additionalProperties: false },
  },
  {
    name: 'set_frame_sections',
    description: 'Loads section rows or a section table from a person-supplied conversation JSON file. file is the attachment reference; raw rows are refused as ROWS_NOT_FROM_PERSON. remove lists unused row ids. Original source or estimate is retained, with file/turn/hash receipts. Existing members using a replaced row are evaluated before the change is kept.',
    input_schema: { type: 'object', properties: { file: { type: 'string' }, rows: { type: 'array', description: 'Refused: use a person-supplied file.', items: { type: 'object' } }, remove: { type: 'array', items: { type: 'string' } } }, additionalProperties: false },
  },
  {
    name: 'set_welds',
    description: 'Sets the person\'s welds on the part\'s frame joints (FRd1): welds [{joint (an id from weld_list), kind? fillet | butt, size? mm, allRound?, inner? (whether the end\'s inner loop, a tube\'s bore, is welded: yours to say, none assumed), notes?}] replace a joint\'s record; remove: joint ids. Unset, the rule\'s weld: a butt weld at a mitre, a fillet elsewhere, the thinner wall as its size (an estimate). beadOwnership: {version:1, policy:"equal-length"} opts into shared material ownership; null removes it; absent retains it. A policy-only edit is allowed. No policy is added automatically.',
    input_schema: { type: 'object', properties: { welds: { type: 'array', items: { type: 'object' } }, remove: { type: 'array', items: { type: 'string' } }, beadOwnership: { anyOf: [{ type: 'object', properties: { version: { const: 1 }, policy: { const: 'equal-length' } }, required: ['version', 'policy'], additionalProperties: false }, { type: 'null' }] } }, additionalProperties: false },
  },
  {
    name: 'weld_list',
    description: 'The frame\'s weld joints read off the geometry (FRd1): {joints [{label W1…, id, kind mitre | butt | on-face, body, end, meets, face, seamLength (the end face\'s outer loop), seamBasis exact | mesh, innerLoop {length, welded: yours, null when not said} | null, weldDistance, at, centre, weld {kind, size, sizeBasis set | estimate | none, allRound, notes?}}], totals {count, seamLength}, orphaned (records whose joint is gone), notes}. Say estimated sizes are estimates.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'fit_clearance',
    description: 'A hole–shaft fit from the user\'s fit tables (none built in): hole and shaft faces (their classes as set, or hole_class / shaft_class) — the limits, the least and greatest clearance (µm, negative interference) and kind, and the pair at MMC and LMC by the kernel (overlap, the axes\' offset, the margin; contradicted when a clearance fit meets at MMC); or hole_class, shaft_class and size (mm) alone — the limits. A class with no row for the size says what to load (FIT_TABLE_MISS). Say an estimate row is an estimate.',
    input_schema: { type: 'object', properties: { hole: { type: 'string' }, shaft: { type: 'string' }, hole_class: { type: 'string' }, shaft_class: { type: 'string' }, size: { type: 'number' } }, additionalProperties: false },
  },
  {
    name: 'rebuild_report',
    description: 'The part built from nothing with its features timed (read only): each feature\'s wall time and kernel calls (Booleans, tessellations, sweeps, shells, finishes), the slowest, and the mates that cannot be met with the loops among them, at the document\'s revision. Display meshes, placed copies and other parts are not timed.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'mass_properties',
    description: 'Each body\'s volume, surface area, mass by its material (none set: aluminium, said as assumed), centroid, inertia about it (kg·m²) and box.',
    input_schema: { type: 'object', properties: { bodies: { ...nameList, description: 'Body keys (default: all).' } }, additionalProperties: false },
  },
  {
    name: 'interference',
    description: 'Every pair of bodies (or of those given): overlapping pairs with the overlap\'s volume, the others\' smallest clearance and where.',
    input_schema: { type: 'object', properties: { bodies: { ...nameList, description: 'Body keys (default: all).' } }, additionalProperties: false },
  },
  {
    name: 'section',
    description: 'A section across x, y or z at a position: each body it cuts, with the cut\'s area, its regions and its box. The part is not changed.',
    input_schema: { type: 'object', properties: { axis: { type: 'string', enum: ['x', 'y', 'z'] }, at: { type: 'number' } }, required: ['axis', 'at'], additionalProperties: false },
  },
  {
    name: 'wall_thickness',
    description: 'A body\'s thinnest wall (inward from each face to the next wall) with where and on which face; with "below", every face thinner than that.',
    input_schema: { type: 'object', properties: { body: { type: 'string' }, below: { type: 'number' } }, additionalProperties: false },
  },
  {
    name: 'draft',
    description: 'Draft of a body\'s walls against a pull direction (default +Z), from exact normals — flat and curved faces: each wall\'s least angle in degrees (negative: facing against the pull), its range and class (drafted, steep, straddle: n·d takes both signs, a parting line crosses it), and those under draftMin (default 1).',
    input_schema: { type: 'object', properties: { body: { type: 'string' }, pull: { type: 'array', items: { type: 'number' }, minItems: 3, maxItems: 3 }, draftMin: { type: 'number' } }, additionalProperties: false },
  },
  {
    name: 'set_requirements',
    description: 'Keeps the brief as requirements, each with a check that can be run: {id, source (the user\'s words, quoted exactly as they wrote them: checked against the conversation, SOURCE_NOT_SAID; a requirement you derived is assumed), hard (true: must hold), basis (stated | assumed | ambiguous), subject?, assume?, check: {op: "==" | "<=" | ">=" | "between", query: {fn, …}, value | min and max, tol?, unit?}}. query.fn: bbox {axis, body?}, volume {body?}, mass {body?}, count_solids, count_faces_of_kind {kind: plane | curved, body?}, distance_between {a, b}, radius {face}, hole_diameter {face}, min_wall {body?}, draft_min {body?, pull?}, clearance {a, b: body keys}, gear_center_distance | gear_backlash | gear_contact_ratio | gear_clearance {a, b: the feature ids n<k> of two spur gears, or of a gear and a rack (then the centre distance is the gear axis from the rack pitch line); gear_clearance is minus the depth when the teeth cross}, library_check {feature: the id n<k> of a library part, check: the id of one of its rules — the margin it reports, unknown without its context}, hole_alignment {board: base or a part id holding the board (an imported PCB), features?: standoff ids — the largest offset in mm of their screw axes from its holes}, overhang_area {body?, direction?: build direction, default [0, 0, 1] — the area past the printing process limit}, print_rule {rule: wall | wall-rec | hole | horizontal-hole | gap | cavity | bed-fit | overhang | warp | tip, direction?}, subd_deviation {body?, at?: all | crease — the largest distance of a SubD body’s caps from the limit surface, in mm; crease: only those at crease, corner or boundary vertices}. Faces and edges by name or selector. Write them before modelling. Adds to (or with replace: true, replaces) those there; an id given again replaces its requirement.',
    input_schema: { type: 'object', properties: { requirements: { type: 'array', items: { type: 'object' } }, replace: { type: 'boolean' } }, required: ['requirements'], additionalProperties: false },
  },
  {
    name: 'cut_list',
    description: 'The frame members\' cut list (FR4a): identical members on one row — {rows [{item, quantity, section, material, axisLengthMM (the centroidal axis between the end planes; by volume where an end is coped or trimmed to an envelope or a body: fromVolume), longPointMM, ends [{end, kind (square | mitre | butt | through | cope | trim), mitreDegrees (about the section\'s y), bevelDegrees (about its x)}], massKG each, totalMassKG, pieces: body keys}], totals {quantity, axisLengthMM, massKG}}. Masses use the materials library\'s densities, every one an estimate: say so. nesting (FRb): with stock lengths loaded (set_frame_stock), {bars [{stock, section, lengthMM, pieces, used, kerf, offcut}], sections [{method exact | first-fit-decreasing, stock, lowerBound, optimal, note?}], totals {bars, stock, pieces, kerf, waste}, kerf {mm, basis}, unplaced}; else {error}. csv: true adds the CSV.',
    input_schema: { type: 'object', properties: { csv: { type: 'boolean' } }, additionalProperties: false },
  },
  {
    name: 'check_spec',
    description: 'validate: true also runs the checks on cheap mutants (bodies scaled, parameters ±15%, a subject\'s feature suppressed, a stub box) and lists those that cannot fail (vacuous), cannot be tried (unverified) or are declared invariant. Every report carries the policy: the best snapshot, rounds without progress, a restart hint after two. Runs every requirement\'s check against the part as it stands: {model_hash, summary {pass, fail, unknown, hard_failing}, failures [{req_id, check, measured, expected, delta, entities, feature, hint}], unknowns [{req_id, why}]}; passes as counts only. A mass check on a body without a material is unknown.',
    input_schema: { type: 'object', properties: { validate: { type: 'boolean' } }, additionalProperties: false },
  },
  {
    name: 'apply_ops',
    description: 'Several tool calls as one change, all or nothing: ops [{tool, args, opId?}] run in order, each on what the one before left; one refused and none is applied. dryRun: true tries them and returns what would change (the feature-tree diff, the facts\' change, references that would break) without applying. An opId applied before is skipped, so a retried batch does not apply twice.',
    input_schema: { type: 'object', properties: { ops: { type: 'array', items: { type: 'object', properties: { tool: { type: 'string' }, args: { type: 'object' }, opId: { type: 'string' } }, required: ['tool'] } }, dryRun: { type: 'boolean' } }, required: ['ops'], additionalProperties: false },
  },
  {
    name: 'run_script',
    description: 'Builds or changes the part with a short script, all or nothing (as apply_ops): each command or feature call in it runs as that tool call, in order; the first refusal or error stops it with its line and nothing is applied. dryRun: true tries it and returns what would change. The result lists each call with its line and the feature ids it made, and the names the script set. The language (JS-like): `const x = expr` (or `const a = 1, b = 2`), `for (const i of range(n)) { … }`, `if (c) { … } else { … }`, `//` comments; numbers, "strings", [lists], {objects}, + - * / %, comparisons, && || !, a ? b : c. A command is called by its name with "-" as "_" — box, cylinder, hole, fillet, chamfer, shell, linear_pattern, union, … — as cmd(selection?, {values}), values by run_command\'s keys; it returns a handle to the feature it made: h.top, h.bottom, h.cut, h.side0 (or h.side(2), h.side("e3")) are its faces, h.body its body, h.id its id. edge(faceA, faceB) is the edge between two faces; face({normal: [0, 0, 1], pick: "max"}) a face by direction; a selection may be a list. feature({kind: …}) adds a feature node (as add_features takes it; a handle in it is that feature\'s index, ref(h, side) a body reference); edit(h, {values}) and remove(h) edit or delete one; node("f3") or node(index) is a feature there before. requirements([{id, source, hard?, check}]) sets the requirements (as set_requirements); brief({field: {value, basis, source?, why?}}) the brief (as set_brief). Built in: range, min, max, abs, sqrt, round, floor, ceil, sin, cos, tan (degrees), PI. Example: const p = box({w: 80, d: 40, h: 8}); for (const i of range(3)) { hole(p.top, {d: 5, x: 20 + 20 * i, y: 20}) } fillet([edge(p.top, p.side0)], {radius: 1}). At most 200 calls, 2000 loop iterations, 20 000 characters.',
    input_schema: { type: 'object', properties: { source: { type: 'string', description: 'The script.' }, dryRun: { type: 'boolean' } }, required: ['source'], additionalProperties: false },
  },
  {
    name: 'checkpoint',
    description: 'Keeps the part as it is under a name, to restore or compare later (this session; the last 20).',
    input_schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'], additionalProperties: false },
  },
  {
    name: 'restore',
    description: 'Puts the part back as a checkpoint kept it.',
    input_schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'], additionalProperties: false },
  },
  {
    name: 'diff',
    description: 'What changed between two states of the part, feature by feature (by stable id: added, changed before → after, deleted, moved), and in parameters and requirements. from and to: a checkpoint name, "best" or "current" (default).',
    input_schema: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' } }, additionalProperties: false },
  },
  {
    name: 'propose',
    description: 'Proposes a change without making it: title, ops (as apply_ops takes them), plan (a few lines: what and why), requirements (the ids it serves). The ops are tried on a copy; the result is the feature-tree diff, the facts\' change, references it would break, the checks before and after, and a risk badge. The part stays as it is: the user accepts or rejects the proposal in the studio, and rejected ones are kept. Propose instead of changing when the user asks for options or a review, or when the change is risky (deletes features, breaks references or hard requirements). Changes to an assembly (add_part, place_part, delete_part, a part tool with "part"), its mates, the drawing or a locked part can only be proposed: ops may hold those tools too (add_part ids run p1, p2, … in order, so later ops can name them).',
    input_schema: { type: 'object', properties: { title: { type: 'string' }, ops: { type: 'array', items: { type: 'object', properties: { tool: { type: 'string' }, args: { type: 'object' }, opId: { type: 'string' } }, required: ['tool'] } }, plan: { type: 'string' }, requirements: { type: 'array', items: { type: 'string' } } }, required: ['title', 'ops'], additionalProperties: false },
  },
  {
    name: 'accept_proposal',
    description: 'Accepts an open proposal as the agent, when the autonomy the user set allows it: L3 low or medium risk changing no hard requirement, L4 any breaking no hard requirement; never one needing the user\'s approval (an assembly, mates, a drawing, a locked part). leave_out: feature ids of the proposal to leave out (what depends on them goes too). A proposal made on a part that has changed since is first made again on the part as it is and returned (rebased, not accepted): read it, then call again.',
    input_schema: { type: 'object', properties: { id: { type: 'string' }, leave_out: { type: 'array', items: { type: 'string' } } }, required: ['id'], additionalProperties: false },
  },
  {
    name: 'list_proposals',
    description: 'The open proposals (all: true for accepted and rejected ones too, with who decided, when and why): id, title, summary, risk, and stale when the part changed since.',
    input_schema: { type: 'object', properties: { all: { type: 'boolean' } }, additionalProperties: false },
  },
  {
    name: 'restore_best',
    description: 'Puts the part back to the best snapshot check_spec has seen this session (most requirements passing, then the smallest misses): the restart point when repairs stop making progress.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'render_views',
    description: 'The part as engineering views on one image: front, top, right and isometric, edges by exact hidden-line projection (visible solid, hidden dashed), each face that shows numbered (the legend gives its name). Look at it at milestones or when something seems wrong, not after every step. highlight: faces to fill red (e.g. a failed check\'s); section: cut first across an axis at a position.',
    input_schema: { type: 'object', properties: { highlight: { ...nameList, description: 'Face names to fill red.' }, section: { type: 'object', properties: { axis: { type: 'string', enum: ['x', 'y', 'z'] }, at: { type: 'number' } }, required: ['axis', 'at'], additionalProperties: false } }, additionalProperties: false },
  },
  {
    name: 'inspect',
    description: 'Detail of faces and edges: a face\'s kind, area, normal or axis, radius, centre, the faces next to it and the feature that made it; an edge\'s ends, chord, line or curve, its two faces and the feature that made it.',
    input_schema: { type: 'object', properties: { faces: selectorList('Faces'), edges: selectorList('Edges') }, additionalProperties: false },
  },
  {
    name: 'select',
    description: 'Highlights faces, edges or bodies in the user’s viewport when the turn ends (for example to show what was filleted). Does not change the part.',
    input_schema: { type: 'object', properties: { faces: selectorList('Faces'), edges: selectorList('Edges'), bodies: nameList }, additionalProperties: false },
  },
  ...CAGE_TOOLS,
  ...DRAWING_TOOLS,
];

/** CG6 (DA-8): the document's versions and branches (versions/tools.ts) — the whole document, not a part's. */
const VERSION_TOOLS: ToolDefinition[] = [
  { name: 'make_version', description: 'Keeps the part as it is as a named version on the current branch (the first makes the version log). Versions live with the studio\'s open project; without one, for this session. Refused when nothing changed since the branch\'s last version, or the name is taken.', input_schema: { type: 'object', properties: { name: { type: 'string' }, note: { type: 'string' } }, additionalProperties: false } },
  { name: 'list_versions', description: 'The branches (name, head, the version each started from), the current one, and a branch\'s versions newest first (id, name, note, time, who, merge). branch: default the current.', input_schema: { type: 'object', properties: { branch: { type: 'string' } }, additionalProperties: false } },
  { name: 'restore_version', description: 'Puts the part back as a version kept it (id or name). Nothing is lost: the history stays, and making a version of it adds one on top.', input_schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false } },
  { name: 'compare_versions', description: 'What changed from one state to another: features added, removed, edited (each field, from → to) or moved, by stable id; parameters, configurations, mates and placed parts; other fields by name. from and to: a version id or name, "latest" (the branch\'s last version) or "current" (the part as it is); default from "latest" to "current".', input_schema: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' } }, additionalProperties: false } },
  { name: 'make_branch', description: 'A branch made at a version (from: id or name; default the current branch\'s last). It is not switched to.', input_schema: { type: 'object', properties: { name: { type: 'string' }, from: { type: 'string' } }, required: ['name'], additionalProperties: false } },
  { name: 'switch_branch', description: 'Works on another branch: its last version becomes the part. Refused while the part has changes not made into a version (make_version first, or discard: true drops them).', input_schema: { type: 'object', properties: { branch: { type: 'string' }, discard: { type: 'boolean' } }, required: ['branch'], additionalProperties: false } },
  { name: 'merge_branch', description: 'Brings another branch\'s work into the current one, from the version both started from: features, parameters, mates and placed parts changed on one side merge; the same thing changed differently on both is a conflict. Conflicts come back as data ({code, where, message, ours, theirs}) and nothing is merged: call again with resolve: {where: "ours" | "theirs"} for each ("ours": the current branch). A feature one side deleted while the other built on it: "ours"/"theirs" keeps it from the side that has it, or drops what uses it. The part must be its branch\'s last version (make_version first).', input_schema: { type: 'object', properties: { from: { type: 'string' }, resolve: { type: 'object', additionalProperties: { type: 'string', enum: ['ours', 'theirs'] } } }, required: ['from'], additionalProperties: false } },
];

/** `response_format` on the tools that list the part (A2.4). */
const RESPONSE_FORMAT = { type: 'string', enum: ['concise', 'detailed'], description: 'concise: facts and what changed only; detailed: every body\'s faces and edges (paged); default: those when the part is small.' };
for (const t of PART_TOOLS) if (MUTATORS.has(t.name) || t.name === 'get_part_summary') (t.input_schema as { properties: Record<string, unknown> }).properties.response_format = RESPONSE_FORMAT;
/** `because` on the tools that change the part (A3.2): why a change may break a hard requirement that passed. */
for (const t of PART_TOOLS) if (MUTATORS.has(t.name) && t.name !== 'set_requirements') (t.input_schema as { properties: Record<string, unknown> }).properties.because = { type: 'string', description: 'Why this change may break a hard requirement that passed at the last check (else such a change is refused).' };

/** A9-2: tools that are a part's own but not part tools (they read or write the document's settings): they take `part` too. */
export const PART_SCOPED: ReadonlySet<string> = new Set(['check_printability', 'orient_for_print', 'set_brief', 'get_brief']);
const PART_ARGUMENT = { type: 'string', description: 'The part to work on: an instance id from add_part (default "base", the document\'s own part).' };
const withPartArgument = (t: ToolDefinition): ToolDefinition => PART_SCOPED.has(t.name) ? { ...t, input_schema: { ...t.input_schema, properties: { ...(t.input_schema.properties as object), part: PART_ARGUMENT } } } : t;
/** Each tool's arguments, from its schema (`part` on the part tools); null for a schema that takes any. */
let argumentsOf: Map<string, ReadonlySet<string> | null> | null = null;
/** Whether a tool takes an argument (a schema that takes any: yes). */
export function takesArgument(name: string, key: string): boolean { return !unknownArguments(name, { [key]: true }); }
/** Why a call's arguments are refused (UNKNOWN_ARGUMENT, naming each and what the tool takes), or null. */

export function unknownArguments(name: string, args: Record<string, unknown>): string | null {
  argumentsOf ??= new Map(TOOLS.map(t => { const sc = t.input_schema as { properties?: Record<string, unknown>; additionalProperties?: unknown }; return [t.name, sc.additionalProperties === false ? new Set(Object.keys(sc.properties ?? {})) : null]; }));
  const takes = argumentsOf.get(name);
  if (!takes) return null;
  const extra = Object.keys(args).filter(k => !takes.has(k));
  if (!extra.length) return null;
  const v2 = V2_OF.get(name), shown = v2 ?? name, list = [...takes].join(', ') || 'none';
  return `[UNKNOWN_ARGUMENT] ${shown} takes no ${extra.map(k => `"${k}"`).join(', ')}: its arguments are ${list}.${extra.includes('part') ? ' It works on the whole document, not one part.' : ''}`;
}

/** Part tools take `part` (an instance id; default the base part); then the assembly tools. */
export const TOOLS: ToolDefinition[] = [
  { name: 'load_rows', description: 'Loads strict shop rows only from a JSON file supplied by the person in this conversation. file is an opaque reference listed with the user attachments, never a path, URL, inline rows or suppliedBy claim. Keeps the original source/estimate and adds a file/turn/hash receipt per row. Kinds use the existing domain validators. fits accepts tables, sections accepts section rows or a section table, stock is machining stock, frame-stock is bar lengths, fasteners are bought screws, bolts, nuts and washers (kind, size as M6, lengthMM, designation; a fastener placed as its own part is the BOM line of the row of its kind, size and length). bend requires feature: the index of an existing sheet-base or sheet-contour, whose bend table is replaced. All edits keep the current proposal and approval gates.', input_schema: { type: 'object', properties: { kind: { type: 'string', enum: [...ROW_KINDS] }, file: { type: 'string' }, feature: { type: 'integer', minimum: 0 }, part: PART_ARGUMENT }, required: ['kind', 'file'], additionalProperties: false } },
  ...PART_TOOLS.map(t => t.name === 'select' ? t : { ...t, input_schema: { ...t.input_schema, properties: { ...(t.input_schema.properties as object), part: PART_ARGUMENT } } }),
  ...ASSEMBLY_TOOLS.map(withPartArgument),
  ...VERSION_TOOLS,
  ...ROBOT_TOOLS,
  ...OUTPUT_TOOLS,
  ...BRIEF_TOOLS.map(withPartArgument),
  ...QUESTION_TOOLS,
  ...REFERENCE_TOOLS,
  ...DRAFT_TOOLS,
  ...STANDARDS_TOOLS,
];

export const SYSTEM_PROMPT = `You are the modeling assistant inside barocss CAD Studio, a parametric part modeler. The user describes a part or a change; you build it with the tools, which edit the part's feature tree exactly like the studio's own commands. Every change you make is evaluated by the geometry kernel and the result (bodies, volumes, bounds, face and edge names, or the exact refusal) comes back to you.

Conventions: millimetres; Z is up; sketches and boxes start on the XY plane at Z 0 unless placed otherwise; a box's x, y are its minimum corner. Holes go through the whole body by default. Faces and edges are referred to by their persistent names from results (e.g. the top face of the first extrude is "n1.top", a vertical corner edge "n1.side0|n1.side1"); vertical edges are the straight edges "along z". Instead of a name, a face or edge may be a selector — {"feature": 1, "role": "top"}, {"normal": [0, 0, 1], "pick": "max"}, {"between": [face, face]}: the result reports the name it resolved to (use that name afterwards), and one that fits several faces is refused with the candidates. Names keep their feature id when features are added, moved or deleted.

Start from the brief: set_brief with its purpose, process and material (required) and what else the user said — stated with their words quoted, everything you chose yourself assumed with why, never stated; get_brief lists the gaps. The brief's material is the base part's; a body or a placed part of another material gets it with set_material. Then write the requirements. A part built to fit something (get_references: locked reference bodies) is built on their datums (add_datum; a sketch on {"datum": id}) and kept out of their keep-outs (add_keepout, check_keepouts) — never on their faces, which no feature may use.

Work like an engineer: prefer the commands (box, cylinder, hole, fillet, chamfer, shell, patterns, Booleans) and use add_features for profiles and solids no command makes. Make each change, read the result — its facts (solids, volume, mass, centroid, box, face/edge/vertex counts) and change (what moved since the last step) — and correct yourself when a tool refuses or a volume or bound is not what the request implies; inspect gives a face's or edge's detail (neighbours, the feature that made it). A mass is only a fact once the body's material is set: facts say mass_assumed when a body has none (aluminium taken); set the material, or state the assumption, before checking a mass against a requirement. mass_properties, interference (overlap and clearance), section, wall_thickness and draft analyse the part without changing it. When the user asks for options or a review, or a change is risky, propose it (propose) instead of making it: the user accepts or rejects it. Each message says your autonomy level: at L1 propose every change; at L2 (the default) change values of one feature or of parameters directly — anything more in a turn (several features; adding, deleting or moving features; what a feature is built on) you propose, except on an empty part, whose first build you make directly; at L3 and L4 you may accept proposals yourself (accept_proposal) within its limits. Before modelling a brief, write its requirements with set_requirements (quote the words; say what you assumed), and run check_spec after changes and before saying you are done. Ask only what blocks the design — ask_user, at most 5 questions a batch and 2 batches, each naming the gap it settles (a required brief field, or a hard requirement whose value you assumed); assume everything else, with why, and say what you chose: nothing waits on the answers. When the user attaches images (a sketch, a photo, a dimensioned drawing), model the part they show: take dimensions written on a drawing as given; read views (top, front, side) together; for a photo or an undimensioned sketch, estimate proportions from the picture and scale them by any one known size, and if no size is given or implied, ask for one key dimension (ask_user, within the batches) and build at an assumed size meanwhile, said so. Always say which dimensions you read and which you assumed.

For a part of many steps or repeated features, write it as one run_script instead of many calls: loops and arithmetic in it, each command's handle naming its faces for the next; a refused line comes back with its number, nothing applied, so fix that line and run the script again.

For the part's 2D drawing: drawing_issues and tolerance_suggestions read it; auto_dimension (layout and dimensions), fix_drawing, accept_tolerances and set_drawing change it, and a drawing change is always the user's to accept, so make those as ops of propose. When you report tolerances, say which suggestions are estimates and which come from the fastener data.

A picture that is not an engineering drawing — a character, mascot, logo or icon bitmap — has been traced for you: get_image_layers lists its silhouette and colour regions, and extrude_image_layer turns them into solids at one shared scale. Unless the user asks otherwise, make a relief of it: the silhouette as a base about 3–5 mm thick at a size that suits the request (around 60 mm wide if none is given), then the colour layers that carry the character's features raised 0.6–2 mm on top of the base (base = the base's thickness), the small dark details (eyes, outlines) highest. Skip layers that are just the main body colour or the background. When the user wants it three-dimensional or "realistic" (a figure, toy, plush, 실사화), use inflate_image_layer: the silhouette as a rounded body (depth about 35–50 % of its width; orientation "standing" for a figure that stands up), then the features as bumps on it (eyes, nose, muzzle, cheeks; 1–4 mm), each from its colour layer — leave out the body colour itself and thin outline strokes. Add what the picture implies but a silhouette cannot show — a flat base to stand on, a separate inflated part — with the other tools, sized from the picture's proportions; spheres are a revolved half-circle loop (add_features: a loop sketch of a line and an arc, revolved 360° about its axis). Say which approach you took.

For a machine, mechanism or anything made of several parts (a gearbox, a hinge, a vice, a robot arm, furniture), make an assembly. Assembly changes always need the user's approval, so you propose them: build the main or fixed part as the base part directly, then propose the rest — ops that add each other part with add_part (ids p1, p2, … in order) and build it with the part tools and "part": its id, in its own coordinates (so a shaft is modelled along its own Z, centred), then place it with mates — concentric for shafts in bores and pins in holes, coincident or distance for faces that sit on each other, angle for set orientations — and read the proposal's result: what each part can still do, or why a mate was refused. Copy repeated parts with add_part copy_of. Check the whole with get_assembly once the user has accepted it. For a robot or a mechanism that moves, get_joints reads the assembly as links and joints from its base link (what each pair's mates leave free); set its base link and joint limits with set_joints, as ops of propose.

For a smooth, organic shape (a handle, a mouse shell, a bottle), start from run_command subd-box, subd-torus or subd-tube and shape its cage: subd_select finds faces (by the way they face, or a box), vertices, loops and rings, and the open edges; subd_extrude, subd_insert_loop (its "t" places a holding loop near an edge, for a tighter rounding) and subd_move shape it; subd_crease makes edges sharp; subd_fill, subd_bridge, subd_weld and subd_delete mend or open it; subd_cage reports its validation. Moving vertices is a value edit; changing the cage's topology is proposed for the user.

Finish with one or two sentences: what was built and its key numbers (volume, overall size). The user can undo your whole turn with one undo.`;

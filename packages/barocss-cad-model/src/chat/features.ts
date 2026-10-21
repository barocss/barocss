// Feature nodes written by the model (add_features / edit_feature), checked before the kernel sees
// them: every field of the node's kind with the right type, references to earlier sketches and to
// bodies that are still visible, and no unknown fields. Also deleting a feature (with the sketches only
// it used) and renumbering the later ones; persistent face and edge names carry stable feature ids
// (engine/ids.ts), so they stay as they are.
import { type BoundConstraint3D, type V3 } from '../frames/sketch3d';
import { boundConstraints, boundRefusal, followersOf } from '../frames/skeleton';
import { frameGeometry, leafBodies, parentsOf, prefixDoc, usesOf, type BodyRef, type GearMesh, type ModelNode, type PartInstance, type StudioDoc } from '../engine/doc';
import { BASE, mateLabel } from '../assembly/mates';
import type { CentreRef, DimPoint, DrawingDimension } from '../drawing/types';
import { bodyKeyFor, bodyNodeOf, featureId, nextSerial, nodesOfName, renameFeatureIds, serialOf } from '../engine/ids';

type Spec = Record<string, string>;
/** `?` marks an optional field. */
const SPECS: Record<string, Spec> = {
  extrude: { sketch: 'sketch', height: 'dim', 'from?': 'dim', 'draft?': 'num' },
  revolve: { sketch: 'sketch', axis: 'enum:x|y', 'origin?': 'dim2', angleDegrees: 'num' },
  sweep: { sketch: 'sketch', path: 'path' },
  loft: { sections: 'sections', 'smooth?': 'bool' },
  translate: { parent: 'ref', offset: 'dim3' },
  rotate: { parent: 'ref', axis: 'enum:x|y|z', angleDegrees: 'num', 'pivot?': 'dim3' },
  mirror: { parent: 'ref', plane: 'enum:xy|xz|yz' },
  scale: { parent: 'ref', factor: 'pos', 'pivot?': 'dim3' },
  'linear-pattern': { parent: 'ref', axis: 'enum:x|y|z', spacing: 'dim', count: 'count' },
  'circular-pattern': { parent: 'ref', axis: 'enum:x|y|z', angleDegrees: 'num', count: 'count' },
  union: { left: 'ref', right: 'ref' },
  intersect: { left: 'ref', right: 'ref' },
  difference: { parent: 'ref', tool: 'ref' },
  split: { parent: 'ref', at: 'dim', axis: 'enum:x|y|z' },
  shell: { parent: 'ref', thickness: 'dim', open: 'names' },
  // (R9, D85: a mesh body simplified; its keep and bounds are values.)
  decimate: { parent: 'ref', 'ratio?': 'num', 'triangles?': 'count', 'maxError?': 'num', 'featureAngle?': 'num' },
  chamfer: { parent: 'ref', edges: 'names1', distance: 'dim' },
  // (`radii`: a varying radius, R10.5a, D100; `section`: a conic or G2 section, R10.5b, D103.)
  fillet: { parent: 'ref', edges: 'names1', radius: 'dim', 'radii?': 'radii', 'section?': 'section' },
  hole: { parent: 'ref', center: 'dim2', radius: 'dim', 'axis?': 'enum:x|y|z', 'side?': 'enum:min|max', 'depth?': 'dim' },
  // (R12.1, D116: sheet metal, its rules on each feature.)
  'sheet-base': { sketch: 'sketch', thickness: 'dim', bendRadius: 'dim', 'kFactor?': 'num', 'bendTable?': 'any', 'reverse?': 'bool' },
  'sheet-corner-relief': { parent: 'ref', edges: 'names1', shape: 'enum:square|round', size: 'dim' },
  'sheet-flange': { parent: 'ref', edges: 'names1', length: 'dim', 'angleDegrees?': 'num', 'bendRadius?': 'dim', 'measure?': 'enum:outer|inner|tangent', 'position?': 'enum:material-inside|material-outside|bend-outside', 'offsets?': 'dim2', 'relief?': 'any' },
  // (FR1, D123: a structural member, its section by kind and dimensions — none defaulted — or a closed sketch.)
  // (FR2, D124: a frame on a skeleton; overrides set members apart.)
  // (FRf, O121: a skeleton several frames follow; a frame on one — or on a sketch's straight edges — names it in `follows`.)
  skeleton: { points: 'points3', segments: 'segments', 'name?': 'text', 'constraints?': 'any' },
  frame: { 'follows?': 'frame-follows', 'points?': 'points3', 'segments?': 'segments', section: 'member-section', 'anchor?': 'enum:centroid|origin|bottom-left|bottom|bottom-right|left|center|right|top-left|top|top-right', 'offset?': 'dim2', 'roll?': 'num', 'mirror?': 'bool', 'up?': 'vec3', 'overrides?': 'frame-overrides', 'corners?': 'frame-corners', 'trims?': 'frame-trims' },
  'frame-member': { section: 'member-section', start: 'dim3', end: 'dim3', 'anchor?': 'enum:centroid|origin|bottom-left|bottom|bottom-right|left|center|right|top-left|top|top-right', 'offset?': 'dim2', 'roll?': 'num', 'up?': 'vec3' },
  'sheet-contour': { path: 'points2', 'plane?': 'plane', side: 'enum:left|right', width: 'dim', thickness: 'dim', bendRadius: 'dim', 'kFactor?': 'num', 'bendTable?': 'any' },
};
/** A member's section kinds and their fields (FR1, D123). */
const MEMBER_SECTIONS: Record<string, Spec> = {
  'rect-tube': { width: 'dim', height: 'dim', wall: 'dim', outerRadius: 'dim', 'innerRadius?': 'dim' },
  'round-tube': { diameter: 'dim', wall: 'dim' },
  angle: { legX: 'dim', legY: 'dim', thickness: 'dim', rootRadius: 'dim', toeRadius: 'dim' },
  channel: { height: 'dim', width: 'dim', web: 'dim', flange: 'dim', rootRadius: 'dim' },
  tslot: { size: 'dim', cells: 'enum:1|2', 'openSlots?': 'num', opening: 'dim', lip: 'dim', undercut: 'dim', depth: 'dim', bore: 'dim' },
  sketch: { sketch: 'sketch' },
  // (FRc, O117: a row of the document's section library by its id.)
  library: { id: 'library-row' },
};
const MEMBER_SECTION_HELP = 'a section {"kind": "rect-tube" | "round-tube" | "angle" | "channel" | "tslot" | "sketch", …its dimensions} or {"kind": "library", "id"} (a row of the section library)';
// (The section library's row ids that the node being checked may name: checkNode's.)
let libraryIds: ReadonlySet<string> = new Set();
// (FRf2: the placed parts a base frame may follow; null inside a placed part, which follows only its own features.)
let partsCtx: readonly PartInstance[] | null = [];
const PROFILE: Record<string, Spec> = {
  rectangle: { min: 'dim2', max: 'dim2' },
  circle: { center: 'dim2', radius: 'dim' },
  polygon: { points: 'points' },
  loop: { segments: 'loop' },
};
const ON_PLANE: Spec = { 'plane?': 'plane', 'regions?': 'loops', 'holes?': 'loops', 'sideTags?': 'any' };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
/** A body reference as the agent writes it (`node` an index), with the body's key (by its stable id). */
const refText = (r: BodyRef, nodes: readonly ModelNode[]) => `{node ${r.node}, side ${r.side}} (body ${bodyKeyFor(nodes, r.node, r.side)})`;

/**
 * Why a section library row is refused (FRc, O117), or null: an id, its section by dimensions (every one given; a sketch
 * or another row is no library row), and where its sizes come from — a source, or flagged as an estimate.
 */
export function checkSectionRow(row: unknown, parameters: Record<string, number> = {}): string | null {
  if (!isObj(row)) return 'a row is {id, name?, section, source | estimate: true}';
  const id = typeof row.id === 'string' ? row.id.trim() : '';
  if (!id) return 'a row needs an id';
  const extra = Object.keys(row).find(k => !['id', 'name', 'section', 'source', 'estimate'].includes(k));
  if (extra) return `${id}: no field "${extra}" (id, name, section, source, estimate)`;
  if (row.name !== undefined && typeof row.name !== 'string') return `${id}: name is text`;
  if (!isObj(row.section) || row.section.kind === 'sketch' || row.section.kind === 'library') return `${id}: section is one by its dimensions (rect-tube, round-tube, angle, channel, tslot)`;
  const why = checkValue(row.section, 'member-section', [], parameters, []);
  if (why) return `${id}: ${why}`;
  const source = typeof row.source === 'string' ? row.source.trim() : '';
  if (!source && row.estimate !== true) return `${id}: say where the sizes come from (source: your shop, a page) or flag them (estimate: true); none is built in`;
  return null;
}

/** Why the node cannot be appended to `nodes`, or null. */
export function checkNode(node: unknown, nodes: readonly ModelNode[], parameters: Record<string, number>, sections: readonly { id: string }[] = [], parts: readonly PartInstance[] | null = []): string | null {
  if (!isObj(node)) return 'A feature is an object with a "kind".';
  libraryIds = new Set(sections.map(r => r.id)); partsCtx = parts;
  const kind = String(node.kind);
  if (kind === 'import' || kind === 'mesh') return 'STEP, STL and OBJ files are opened from a file, not written in chat.';
  let spec: Spec;
  if (kind === 'sketch') {
    const p = PROFILE[String(node.profile)];
    if (!p) return `A sketch's "profile" is one of ${Object.keys(PROFILE).join(', ')}.`;
    spec = { profile: 'any', ...p, ...ON_PLANE };
  } else {
    if (!SPECS[kind]) return `Unknown feature kind "${kind}". Kinds: sketch, ${Object.keys(SPECS).join(', ')}.`;
    spec = SPECS[kind];
  }
  const fields = new Map(Object.entries(spec).map(([k, t]) => [k.replace(/\?$/, ''), { type: t, optional: k.endsWith('?') }]));
  // (`id`, a feature's stable id, and `rematched` may come along from a document read back; the studio keeps them.)
  for (const key of Object.keys(node)) if (key !== 'kind' && !['id', 'rematched', 'sigs', 'held', 'suppressed'].includes(key) && !fields.has(key)) return `${kind}: unknown field "${key}" (fields: ${[...fields.keys()].join(', ')}).`;
  const leaves = leafBodies(nodes);
  for (const [key, { type, optional }] of fields) {
    const v = node[key];
    if (v === undefined) { if (optional) continue; return `${kind}: "${key}" is required.`; }
    const why = checkValue(v, type, nodes, parameters, leaves);
    if (why) return `${kind}.${key}: ${why}`;
  }
  // (FRf, O121: a frame follows a skeleton or a sketch, or has its own points and segments; a skeleton's segments name its points.)
  if (kind === 'frame' && node.follows === undefined && (node.points === undefined || node.segments === undefined)) return 'frame: give "points" and "segments", or "follows" {"skeleton": k} | {"sketch": k}.';
  if (kind === 'skeleton') { const P = (node.points as unknown[]).length, bad = (node.segments as number[][]).findIndex(g => g.some(i => i >= P)); if (bad >= 0) return `skeleton: segment ${bad} names a point it does not have (${P} points).`; }
  // (FRg, O122: its constraints by kind, indices in range; a point bound to a parameter is not solved for.)
  if (kind === 'skeleton' && node.constraints !== undefined) {
    if (!Array.isArray(node.constraints)) return 'skeleton.constraints: a list of 3D constraints ({"kind": "length", "segment": k, "value": mm} …)';
    if ((node.points as unknown[][]).some(p => p.some(v => typeof v !== 'number'))) return 'skeleton: a skeleton with constraints has numbers for its points (the solver moves them)';
    // (O140: a length's, distance's or angle's value may be a parameter's: checked as it is now.)
    const b = boundConstraints(node.constraints as BoundConstraint3D[], parameters);
    if ('error' in b) return b.error;
    const why = boundRefusal(node.points as V3[], node.segments as [number, number][], b);
    if (why) return `[SKETCH3D_INPUT] skeleton.${why}`;
  }
  return null;
}

function checkValue(v: unknown, type: string, nodes: readonly ModelNode[], parameters: Record<string, number>, leaves: readonly BodyRef[]): string | null {
  const dim = (x: unknown) => typeof x === 'number' ? Number.isFinite(x) : isObj(x) && typeof x.parameter === 'string' && x.parameter in parameters;
  const pair = (x: unknown) => Array.isArray(x) && x.length === 2 && x.every(dim);
  const loop = (x: unknown): string | null => {
    if (!Array.isArray(x) || x.length < 2) return 'a loop is a list of at least two segments';
    for (const g of x) {
      if (!isObj(g) || !pair(g.start)) return 'each segment has a "start" [x, y]';
      if (g.kind === 'line') { if (Object.keys(g).some(k => k !== 'kind' && k !== 'start')) return 'a line segment has only kind and start'; }
      else if (g.kind === 'arc') { if (!pair(g.center) || (g.direction !== 'ccw' && g.direction !== 'cw')) return 'an arc segment has start, center [x, y] and direction "ccw" or "cw"'; }
      else return 'a segment kind is "line" or "arc"';
    }
    return null;
  };
  if (type.startsWith('enum:')) return type.slice(5).split('|').includes(String(v)) ? null : `one of ${type.slice(5).split('|').join(', ')}`;
  switch (type) {
    case 'any': return null;
    case 'text': return typeof v === 'string' ? null : 'text';
    case 'num': return typeof v === 'number' && Number.isFinite(v) ? null : 'a number';
    case 'pos': return typeof v === 'number' && v > 0 ? null : 'a positive number';
    case 'bool': return typeof v === 'boolean' ? null : 'true or false';
    case 'count': return Number.isInteger(v) && (v as number) >= 2 ? null : 'a whole number of at least 2';
    case 'dim': return dim(v) ? null : 'a number (mm) or {"parameter": name} of a defined parameter';
    case 'dim2': return pair(v) ? null : 'two numbers [a, b]';
    case 'dim3': return Array.isArray(v) && v.length === 3 && v.every(dim) ? null : 'three numbers [x, y, z]';
    case 'points': return Array.isArray(v) && v.length >= 3 && v.every(pair) ? null : 'at least three [x, y] points';
    case 'points2': return Array.isArray(v) && v.length >= 2 && v.length <= 64 && v.every(pair) ? null : '2 to 64 [x, y] points';
    case 'loop': return loop(v);
    case 'loops': { if (!Array.isArray(v)) return 'a list of loops'; for (const l of v) { const w = loop(l); if (w) return w; } return null; }
    case 'plane': {
      const v3 = (x: unknown) => Array.isArray(x) && x.length === 3 && x.every(n => typeof n === 'number' && Number.isFinite(n));
      return isObj(v) && v3(v.origin) && v3(v.normal) && v3(v.xAxis) ? null : 'a plane {origin, normal, xAxis}, each [x, y, z]';
    }
    case 'radii': return Array.isArray(v) && v.length >= 2 && v.length <= 16 && v.every(p => isObj(p) && Array.isArray(p.at) && p.at.length === 3 && p.at.every(x => typeof x === 'number' && Number.isFinite(x)) && dim(p.radius)) ? null : '2 to 16 points {"at": [x, y, z] on the edges, "radius": r}';
    case 'section': {
      const frac = (x: unknown) => typeof x === 'number' && x > 0 && x < 1;
      if (isObj(v) && v.kind === 'conic' && frac(v.rho) && Object.keys(v).every(k => k === 'kind' || k === 'rho')) return null;
      if (isObj(v) && v.kind === 'g2' && (v.tension === undefined || frac(v.tension)) && Object.keys(v).every(k => k === 'kind' || k === 'tension')) return null;
      return '{"kind": "conic", "rho": 0–1 exclusive} or {"kind": "g2", "tension"?: 0–1 exclusive}';
    }
    case 'vec3': return Array.isArray(v) && v.length === 3 && v.every(n => typeof n === 'number' && Number.isFinite(n)) && v.some(n => n !== 0) ? null : 'three numbers [x, y, z], not all 0';
    case 'points3': return Array.isArray(v) && v.length >= 2 && v.length <= 1024 && v.every(p => Array.isArray(p) && p.length === 3 && p.every(dim)) ? null : '2 to 1024 [x, y, z] points';
    case 'segments': return Array.isArray(v) && v.length >= 1 && v.length <= 256 && v.every(g => Array.isArray(g) && g.length === 2 && g.every(i => Number.isInteger(i) && i >= 0)) ? null : '1 to 256 [from, to] point indices';
    case 'frame-follows': {
      // (FRf2, O125: a placed part's sketch by its stable id — the base part's frames only; the revision pinned when linked.)
      if (isObj(v) && typeof v.part === 'string') {
        if (typeof v.sketch !== 'string' || Object.keys(v).some(k => !['part', 'sketch', 'revision'].includes(k)) || (v.revision !== undefined && typeof v.revision !== 'string')) return 'a frame follows a placed part\'s sketch as {"part": id, "sketch": its feature id, "revision"?: the part\'s revision}';
        const g = frameGeometry(nodes, { kind: 'frame', follows: v, points: [], segments: [] } as never, parameters, partsCtx);
        return 'code' in g ? `[${g.code}] ${g.error}` : null;
      }
      if (!isObj(v) || Object.keys(v).length !== 1 || !(Number.isInteger(v.skeleton) || Number.isInteger(v.sketch))) return 'a frame follows {"skeleton": k} or {"sketch": k} (an earlier feature), or {"part": id, "sketch": feature id}';
      const k = (v.skeleton ?? v.sketch) as number, src = nodes[k], want = v.skeleton !== undefined ? 'skeleton' : 'sketch';
      if (src?.kind !== want) return `[FRAME_${want.toUpperCase()}_UNKNOWN] feature ${k} is ${src ? `a ${src.kind}` : 'not there (an earlier feature)'}, not a ${want}`;
      const g = frameGeometry(nodes, { kind: 'frame', follows: v, points: [], segments: [] } as never, parameters);
      return 'code' in g ? `[${g.code}] ${g.error}` : null;
    }
    case 'frame-overrides': {
      if (!Array.isArray(v)) return 'a list of {"member": k, …}';
      for (const o of v) {
        if (!isObj(o) || !Number.isInteger(o.member) || (o.member as number) < 0) return 'each override names its "member" (the segment\'s index)';
        const extra = Object.keys(o).find(k => !['member', 'section', 'anchor', 'offset', 'roll', 'mirror'].includes(k));
        if (extra) return `an override has no "${extra}"`;
        const why = (o.section !== undefined && checkValue(o.section, 'member-section', nodes, parameters, leaves)) || (o.anchor !== undefined && checkValue(o.anchor, SPECS.frame['anchor?'], nodes, parameters, leaves)) || (o.offset !== undefined && checkValue(o.offset, 'dim2', nodes, parameters, leaves)) || (o.roll !== undefined && checkValue(o.roll, 'num', nodes, parameters, leaves)) || (o.mirror !== undefined && checkValue(o.mirror, 'bool', nodes, parameters, leaves));
        if (why) return `override of member ${o.member}: ${why}`;
      }
      return null;
    }
    case 'frame-corners': {
      const kinds = ['mitre', 'butt', 'cope', 'order', 'none'];
      if (!isObj(v) || Object.keys(v).some(k => !['default', 'multi', 'tee', 'at'].includes(k))) return '{"default"?: "mitre" | "butt" | "none", "multi"?: "order" | "none", "tee"?: "butt" | "cope" | "none", "at"?: [{"point": i, "kind", "through"?, "trim"?, "order"?}]}';
      if (v.default !== undefined && !['mitre', 'butt', 'none'].includes(String(v.default))) return 'corners.default: mitre, butt or none';
      if (v.multi !== undefined && !['order', 'none'].includes(String(v.multi))) return 'corners.multi: order or none';
      if (v.tee !== undefined && !['butt', 'cope', 'none'].includes(String(v.tee))) return 'corners.tee: butt, cope or none';
      const entry = (e: unknown) => isObj(e) && Number.isInteger(e.point) && kinds.includes(String(e.kind)) && (e.through === undefined || Number.isInteger(e.through)) && (e.trim === undefined || e.trim === 'face' || e.trim === 'envelope') && (e.order === undefined || (Array.isArray(e.order) && e.order.every(m => Number.isInteger(m)))) && Object.keys(e).every(k => ['point', 'kind', 'through', 'trim', 'order'].includes(k));
      if (v.at !== undefined && (!Array.isArray(v.at) || !v.at.every(entry))) return 'corners.at: a list of {"point": i, "kind": "mitre" | "butt" | "cope" | "order" | "none", "through"?: member, "trim"?: "face" | "envelope", "order"?: [members]}';
      return null;
    }
    case 'frame-trims': {
      if (!Array.isArray(v)) return 'a list of {"member": k, "end": "start" | "end", "plane": {origin, normal}} or {…, "body": Ref}';
      for (const t of v) {
        if (!isObj(t) || !Number.isInteger(t.member) || (t.end !== 'start' && t.end !== 'end')) return 'each trim names its "member" and its "end" (start or end)';
        if ((t.plane === undefined) === (t.body === undefined)) return 'a trim takes a "plane" or a "body" (one of them)';
        if (t.plane !== undefined) { const why = checkValue(t.plane, 'trim-plane', nodes, parameters, leaves); if (why) return why; }
        if (t.body !== undefined) { const why = checkValue(t.body, 'ref', nodes, parameters, leaves); if (why) return `trim body: ${why}`; }
        if (Object.keys(t).some(k => !['member', 'end', 'plane', 'body'].includes(k))) return 'a trim has member, end and a plane or a body';
      }
      return null;
    }
    case 'trim-plane': {
      const v3 = (x: unknown) => Array.isArray(x) && x.length === 3 && x.every(n => typeof n === 'number' && Number.isFinite(n));
      return isObj(v) && v3(v.origin) && v3(v.normal) && Object.keys(v).every(k => k === 'origin' || k === 'normal') ? null : 'a trim plane {"origin": [x, y, z], "normal": [x, y, z]}';
    }
    case 'member-section': {
      // (Each kind's dimensions, every one given: the kernel takes no default size or radius, D122.)
      if (!isObj(v)) return MEMBER_SECTION_HELP;
      const fields = MEMBER_SECTIONS[String(v.kind)];
      if (!fields) return MEMBER_SECTION_HELP;
      for (const [key, t] of Object.entries(fields)) {
        const optional = key.endsWith('?'), k = optional ? key.slice(0, -1) : key;
        if (v[k] === undefined) { if (optional) continue; return `a ${String(v.kind)} section needs "${k}"`; }
        const why = checkValue(v[k], t, nodes, parameters, leaves); if (why) return `section ${k}: ${why}`;
      }
      const extra = Object.keys(v).find(k => k !== 'kind' && !(k in fields) && !(`${k}?` in fields));
      return extra ? `a ${String(v.kind)} section has no "${extra}"` : null;
    }
    case 'library-row': return typeof v === 'string' && libraryIds.has(v) ? null : `[FRAME_SECTION_UNKNOWN] no row "${String(v)}" in the section library (rows: ${[...libraryIds].join(', ') || 'none — load them with features.frame_sections'})`;
    case 'names': return Array.isArray(v) && v.every(n => typeof n === 'string') ? null : 'a list of face or edge names';
    case 'names1': return Array.isArray(v) && v.length > 0 && v.every(n => typeof n === 'string') ? null : 'a non-empty list of edge names';
    case 'sketch': {
      if (!Number.isInteger(v) || (v as number) < 0 || (v as number) >= nodes.length) return `the index of an earlier sketch (0–${nodes.length - 1})`;
      return nodes[v as number].kind === 'sketch' ? null : `feature ${v} is a ${nodes[v as number].kind}, not a sketch`;
    }
    case 'sections': {
      if (!Array.isArray(v) || v.length < 2) return 'at least two {sketch, z} sections';
      for (const s of v) { if (!isObj(s) || !dim(s.z)) return 'each section is {sketch, z}'; const w = checkValue(s.sketch, 'sketch', nodes, parameters, leaves); if (w) return w; }
      return null;
    }
    case 'path': {
      if (!Array.isArray(v) || !v.length) return 'a list of steps';
      for (const s of v) {
        if (isObj(s) && s.kind === 'straight' && dim(s.length)) continue;
        if (isObj(s) && s.kind === 'bend' && dim(s.radius) && typeof s.angleDegrees === 'number' && ['x', '-x', 'y', '-y'].includes(String(s.toward))) continue;
        return 'each step is {kind:"straight", length} or {kind:"bend", radius, angleDegrees, toward: "x"|"-x"|"y"|"-y"}';
      }
      return null;
    }
    case 'ref': {
      const sides = ['solid', 'negative', 'positive', 'instance1', 'instance2', 'instance3'];
      if (!isObj(v) || !Number.isInteger(v.node) || !(sides.includes(String(v.side)) || /^part\d+$/.test(String(v.side)))) return 'a body reference {node, side: "solid"} (split halves: "negative" / "positive"; solids of a STEP file: "part0", "part1", …)';
      const r = v as unknown as BodyRef;
      return leaves.some(l => l.node === r.node && l.side === r.side) ? null : `${refText(r, nodes)} is not a visible body${leaves.length ? ` (bodies now: ${leaves.map(l => refText(l, nodes)).join(', ')})` : ' (there are no bodies yet)'}`;
    }
  }
  return `unchecked type ${type}`;
}

/**
 * A node's references to other nodes by index renumbered. (Names need nothing: they carry the features' stable
 * ids, engine/ids.ts.)
 */
export function renumber(node: ModelNode, map: (i: number) => number): ModelNode {
  const ref = (r: BodyRef): BodyRef => ({ ...r, node: map(r.node) });
  const n = { ...node } as Record<string, unknown> & ModelNode;
  if ('sketch' in n && typeof n.sketch === 'number') n.sketch = map(n.sketch);
  if (n.kind === 'loft') { (n as { sections: { sketch: number; z: unknown }[] }).sections = n.sections.map(s => ({ ...s, sketch: map(s.sketch) })); if (n.from) (n as { from: number[] }).from = n.from.map(map); }
  if (n.kind === 'sketch' && n.on) (n as { on: BodyRef }).on = ref(n.on);
  if ((n.kind === 'gear' || n.kind === 'rack' || n.kind === 'bevel-gear' || n.kind === 'worm') && n.mesh) (n as { mesh: GearMesh }).mesh = { ...n.mesh, gear: map(n.mesh.gear) };
  // (R12c.3b, D157: the shaft a key, ring or pin goes on, and a key's hub keyway.)
  if (n.kind === 'oring') (n as { gland: number }).gland = map(n.gland);
  // (R12c.6b, D161: the wheels a belt or chain runs on.)
  if (n.kind === 'belt') (n as { wheels: [number, number] }).wheels = [map(n.wheels[0]), map(n.wheels[1])];
  if (n.kind === 'bearing') { (n as { shaft: number }).shaft = map(n.shaft); if (n.housing !== undefined) (n as { housing: number }).housing = map(n.housing); }
  if (n.kind === 'key' || n.kind === 'retaining-ring' || n.kind === 'pin') { (n as { shaft: number }).shaft = map(n.shaft); if (n.kind === 'key' && n.hub !== undefined) (n as { hub: number }).hub = map(n.hub); }
  for (const key of ['parent', 'left', 'right', 'tool', 'addTo'] as const) if (isObj(n[key])) (n as Record<string, unknown>)[key] = ref(n[key] as unknown as BodyRef);
  // (FRf: the skeleton or sketch a frame follows.)
  if (n.kind === 'frame' && n.follows && !('part' in n.follows)) (n as { follows: unknown }).follows = 'skeleton' in n.follows ? { skeleton: map(n.follows.skeleton) } : { sketch: map(n.follows.sketch) };
  return n;
}
/** A node's names (fillet and chamfer edges, shell openings, draft faces) with feature ids replaced. */
function renameNode(node: ModelNode, rename: (id: string) => string): ModelNode {
  const r = (name: string) => renameFeatureIds(name, rename);
  if (node.kind === 'fillet' || node.kind === 'chamfer') return { ...node, edges: node.edges.map(r) };
  if (node.kind === 'sheet-flange' || node.kind === 'sheet-corner-relief') return { ...node, edges: [r(node.edges[0])] };
  if (node.kind === 'shell') return { ...node, open: node.open.map(r) };
  if (node.kind === 'draft') return { ...node, faces: node.faces.map(r) };
  if (node.kind === 'keyway' || node.kind === 'oring-gland') return { ...node, face: r(node.face) };
  return node;
}
/** The persistent names a node is built on. */
const named = (n: ModelNode): readonly string[] => n.kind === 'fillet' || n.kind === 'chamfer' || n.kind === 'sheet-flange' || n.kind === 'sheet-corner-relief' ? n.edges : n.kind === 'shell' ? n.open : n.kind === 'draft' ? n.faces : n.kind === 'keyway' || n.kind === 'oring-gland' ? [n.face] : [];

/** A drawing dimension's edge names, renamed (null when one of them is gone). */
function renameDimension(d: DrawingDimension, rename: (name: string) => string | null): DrawingDimension | null {
  if ('edge' in d) { const edge = rename(d.edge); return edge === null ? null : { ...d, edge }; }
  // (A pitch circle's members, and a point at its centre: R14.5.)
  const ring = (r: readonly CentreRef[]) => { const out = r.map(m => { const e = rename(m.edge); return e === null ? null : { ...m, edge: e }; }); return out.some(m => m === null) ? null : out as CentreRef[]; };
  if (d.kind === 'pcd') { const r = ring(d.ring); return r ? { ...d, ring: r } : null; }
  const point = (p: DimPoint): DimPoint | null => { if (p.at === 'pcd') { const r = ring(p.ring ?? []); return r ? { ...p, edge: r[0].edge, ring: r } : null; } const e = rename(p.edge); return e === null ? null : { ...p, edge: e }; };
  const a = d.kind === 'linear' ? point(d.a) : (() => { const e = rename(d.a.edge); return e === null ? null : { ...d.a, edge: e }; })();
  const b = d.kind === 'linear' ? point(d.b) : (() => { const e = rename(d.b.edge); return e === null ? null : { ...d.b, edge: e }; })();
  return a === null || b === null ? null : { ...d, a, b } as DrawingDimension;
}
/**
 * Records by body key (`b<k>`, `b<k>_<side>`, keyed by the stable id `n<k>` of the feature that made the body):
 * those of features gone dropped, those of `moved` ids put under the id given. Nothing else changes as features
 * are deleted or moved: the keys are not indices.
 */
function rekey<T>(rec: Record<string, T>, gone: ReadonlySet<string>, moved: ReadonlyMap<string, string> = new Map()): Record<string, T> {
  return Object.fromEntries(Object.entries(rec).flatMap(([k, v]) => {
    const m = /^b(\d+)(_.*)?$/.exec(k); if (!m) return [[k, v]];
    const id = `n${m[1]}`, to = moved.get(id);
    return to !== undefined ? [[`b${serialOf(to)}${m[2] ?? ''}`, v]] : gone.has(id) ? [] : [[k, v]];
  }));
}

/**
 * The document without feature `index` (and the sketches only it used), or why it cannot go. Everything
 * that names features by index follows: later nodes, mates on the part's own faces, drawing dimensions
 * (those that measured a removed feature are dropped: `droppedDimensions`) and render settings by body.
 */
export function deleteFeature(doc: StudioDoc, index: number): { doc: StudioDoc; removed: number[]; droppedDimensions: number } | { error: string } {
  const nodes = doc.nodes;
  if (!Number.isInteger(index) || index < 0 || index >= nodes.length) return { error: `There is no feature ${index} (features 0–${nodes.length - 1}).` };
  const users = (i: number) => nodes.flatMap((n, k) => usesOf(n).includes(i) ? [k] : []);
  const removed = new Set([index]);
  for (const s of parentsOf(nodes[index])) if (nodes[s]?.kind === 'sketch' && users(s).every(k => k === index)) removed.add(s);
  const blocking = [...removed].flatMap(users).filter(k => !removed.has(k));
  // (FRf, O121: a skeleton or sketch frames follow: refused, typed, naming them.)
  const followers = followersOf(nodes, index);
  if (followers.length) return { error: `[FRAME_SKELETON_IN_USE] feature ${index} (a ${nodes[index].kind}) is followed by ${followers.join(', ')}: give those frames their own points, or delete them, first.` };
  if (blocking.length) return { error: `Feature ${index} is used by feature${blocking.length > 1 ? 's' : ''} ${[...new Set(blocking)].join(', ')}; delete ${blocking.length > 1 ? 'those' : 'that'} first.` };
  const kept = nodes.map((_, i) => i).filter(i => !removed.has(i));
  const newIndex = new Map(kept.map((old, k) => [old, k]));
  // (A name made by a removed feature: the index of that feature, else undefined.)
  const gone = (name: string) => nodesOfName(nodes, name).find(k => removed.has(k));
  for (const i of kept) for (const name of named(nodes[i])) {
    const by = gone(name);
    if (by !== undefined) return { error: `Feature ${i} refers to the face or edge "${name}" made by feature ${by}; delete or edit feature ${i} first.` };
  }
  const map = (old: number) => newIndex.get(old) ?? old;
  for (const [k, mate] of (doc.mates ?? []).entries()) for (const r of [mate.a, mate.b]) {
    const by = r.part === BASE ? gone(r.face) : undefined;
    if (by !== undefined) return { error: `${mateLabel(mate, k)} uses the face "${r.face}" made by feature ${by}; delete that mate first.` };
  }
  const next = kept.map(i => renumber(nodes[i], map));
  const out: StudioDoc = { ...doc, nodes: next };
  let droppedDimensions = 0;
  if (doc.drawing) {
    const dimensions = doc.drawing.dimensions.flatMap(d => { const r = renameDimension(d, name => gone(name) !== undefined ? null : name); if (!r) droppedDimensions++; return r ? [r] : []; });
    out.drawing = { ...doc.drawing, dimensions };
  }
  const goneIds = new Set([...removed].map(i => featureId(nodes, i)));
  if (doc.render) out.render = { ...doc.render, appearances: rekey(doc.render.appearances, goneIds), animation: { ...doc.render.animation, tracks: rekey(doc.render.animation.tracks, goneIds) } };
  if (doc.bodies) out.bodies = rekey(doc.bodies, goneIds);
  return { doc: prefixDoc(out, next.length), removed: [...removed].sort((a, b) => a - b), droppedDimensions };
}

/**
 * The nodes that make a body (`top`, its node) and nothing else uses: deleting them all removes the body
 * and the features and sketches only it was built from.
 */
export function bodyNodes(nodes: readonly ModelNode[], top: number): number[] {
  const users = (i: number) => nodes.flatMap((n, k) => parentsOf(n).includes(i) ? [k] : []);
  if (!nodes[top] || users(top).length) return [];
  const set = new Set([top]);
  for (let grew = true; grew;) {
    grew = false;
    for (const i of [...set]) for (const p of parentsOf(nodes[i])) if (!set.has(p) && users(p).every(k => set.has(k))) { set.add(p); grew = true; }
  }
  return [...set].sort((a, b) => b - a);
}
/** The document without these features, deleted last first (so earlier indices hold), or why one cannot go. */
/**
 * The features that depend on feature `index`, directly or through others: built on it, or naming a
 * face or edge it made (a fillet's edges, a shell's open faces). Sketches are left out (a deleted
 * feature takes its own sketch with it).
 */
export function featureDependents(doc: StudioDoc, index: number): number[] {
  const nodes = doc.nodes, gone = new Set([index]);
  for (let k = index + 1; k < nodes.length; k++) {
    const n = nodes[k];
    if (usesOf(n).some(p => gone.has(p)) || named(n).some(name => nodesOfName(nodes, name).some(i => gone.has(i)))) gone.add(k);
  }
  return [...gone].filter(k => k !== index && nodes[k].kind !== 'sketch').sort((a, b) => a - b);
}

/**
 * The steps of the history as moved: a feature with the sketches only it uses, or a shape made in
 * several steps (a bolt: `made.nodes`) — [first, last] index ranges in order.
 */
function steps(nodes: readonly ModelNode[]): [number, number][] {
  const users = (i: number) => nodes.flatMap((n, k) => parentsOf(n).includes(i) ? [k] : []), out: [number, number][] = [];
  let i = nodes.length - 1;
  while (i >= 0) {
    const n = nodes[i];
    if (n.kind === 'sketch') { out.unshift([i, i]); i--; continue; }
    let first = i - (('made' in n && n.made?.nodes) ? n.made.nodes - 1 : 0);
    // Its own sketches just before it.
    while (first > 0 && nodes[first - 1].kind === 'sketch' && users(first - 1).length && users(first - 1).every(k => k >= first && k <= i)) first--;
    out.unshift([first, i]); i = first - 1;
  }
  return out;
}
/**
 * The document with the history step holding feature `index` moved one step earlier (`-1`) or later
 * (`+1`), references by index renumbered (names keep their stable ids); or why not: a feature cannot come before what it
 * is built on (or names the faces of), nor after what builds on it.
 */
export function moveFeature(doc: StudioDoc, index: number, dir: -1 | 1): { doc: StudioDoc } | { error: string } {
  const nodes = doc.nodes, all = steps(nodes), at = all.findIndex(([a, b]) => index >= a && index <= b);
  if (at < 0) return { error: `There is no feature ${index}.` };
  const other = all[at + dir];
  if (!other) return { error: dir < 0 ? 'It is the first step already.' : 'It is the last step already.' };
  const [early, late] = dir < 0 ? [other, all[at]] : [all[at], other];
  const inEarly = (k: number) => k >= early[0] && k <= early[1];
  for (let k = late[0]; k <= late[1]; k++) {
    const n = nodes[k], uses = [...usesOf(n), ...(n.kind === 'sketch' && n.on ? [n.on.node] : [])].filter(inEarly);
    const names = named(n).flatMap(name => nodesOfName(nodes, name)).filter(inEarly);
    if (uses.length || names.length) return { error: `${dir < 0 ? 'It' : 'The next step'} is built on ${dir < 0 ? 'the step before it' : 'it'}: it cannot come first.` };
  }
  // The new order: the late step's nodes, then the early step's.
  const order = [...nodes.keys()].filter(k => k < early[0]);
  for (let k = late[0]; k <= late[1]; k++) order.push(k);
  for (let k = early[0]; k <= early[1]; k++) order.push(k);
  for (let k = late[1] + 1; k < nodes.length; k++) order.push(k);
  const newIndex = new Map(order.map((old, k) => [old, k])), map = (old: number) => newIndex.get(old) ?? old;
  const next = order.map(old => renumber(nodes[old], map));
  // (Body looks, appearances and tracks are keyed by stable ids: nothing to move.)
  return { doc: prefixDoc({ ...doc, nodes: next }, next.length) };
}

export function deleteFeatures(doc: StudioDoc, indices: readonly number[]): { doc: StudioDoc; droppedDimensions: number } | { error: string } {
  let cur = doc, dropped = 0;
  const left = new Set(indices);
  for (const i of [...indices].sort((a, b) => b - a)) {
    if (!left.has(i)) continue;
    const r = deleteFeature(cur, i);
    if ('error' in r) return r;
    r.removed.forEach(k => left.delete(k));
    cur = r.doc; dropped += r.droppedDimensions;
  }
  return { doc: cur, droppedDimensions: dropped };
}

/**
 * A copy of a body as a body of its own: every feature it is built from, appended again (renumbered, its
 * face and edge names too), then moved by `offset`. Its look (colour) comes along. `top`: its new node.
 */
export function duplicateBody(doc: StudioDoc, body: BodyRef, offset: [number, number, number] | ((copy: BodyRef) => ModelNode)): { doc: StudioDoc; top: number } {
  const nodes = doc.nodes, chain = new Set<number>(), stack = [body.node];
  while (stack.length) { const i = stack.pop()!; if (chain.has(i) || !nodes[i]) continue; chain.add(i); stack.push(...parentsOf(nodes[i])); }
  const order = [...chain].sort((a, b) => a - b), at = new Map(order.map((old, k) => [old, nodes.length + k]));
  const map = (i: number) => at.get(i) ?? i;
  // The copies are new features: fresh ids, and the names inside them (a fillet's edges) renamed to the copies'.
  let serial = nextSerial(doc);
  const ids = new Map(order.map(i => [featureId(nodes, i), `n${serial++}`]));
  const copies = order.map(i => ({ ...renameNode(renumber(nodes[i], map), id => ids.get(id) ?? id), id: ids.get(featureId(nodes, i))! }));
  const top = nodes.length + order.length;
  const copy: BodyRef = { node: map(body.node), side: body.side };
  let out: StudioDoc = { ...doc, nodes: [...nodes, ...copies, typeof offset === 'function' ? offset(copy) : { kind: 'translate', parent: copy, offset }], nextId: serial };
  // The copy's look: the original's colour (not its name), keyed by the copy's first feature.
  const looks = doc.bodies ?? {}, rootKey = Object.keys(looks).find(k => { const at = bodyNodeOf(nodes, k); return at && chain.has(at.node) && at.side === 'solid'; });
  if (rootKey && looks[rootKey].color) out = { ...out, bodies: { ...looks, [bodyKeyFor(out.nodes, map(bodyNodeOf(nodes, rootKey)!.node))]: { color: looks[rootKey].color } } };
  return { doc: prefixDoc(out, out.nodes.length), top };
}

/**
 * The document with nodes `start … start + count − 1` replaced by `next` (a shape rebuilt with a different
 * number of steps): later nodes' references and body looks are renumbered (the rebuilt nodes keep the old
 * ones' ids in order); what pointed into the old range points at its last node's replacement (the shape's solid).
 */
export function replaceRange(doc: StudioDoc, start: number, count: number, next: ModelNode[]): StudioDoc {
  // (The rebuilt nodes keep the replaced ones' ids in order, so the names the shape's faces had stay theirs; the
  // last, the shape's solid, keeps the last one's, so its body keeps its key. Others are new.)
  const old = doc.nodes.slice(start, start + count).map((_, j) => featureId(doc.nodes, start + j)), last = next.length - 1;
  next = next.map((n, j) => ({ ...n, id: j === last ? old[count - 1] : j < count - 1 ? old[j] : undefined }));
  const shift = next.length - count, top = start + next.length - 1;
  const map = (i: number) => i < start ? i : i < start + count ? top : i + shift;
  const after = doc.nodes.slice(start + count).map(n => renumber(n, map));
  const out: StudioDoc = { ...doc, nodes: [...doc.nodes.slice(0, start), ...next, ...after] };
  // (Looks keyed by a replaced node no longer there go to the shape's solid, as references into the range do.)
  const dropped = new Map(old.slice(Math.max(0, last), count - 1).map(id => [id, old[count - 1]]));
  if (doc.bodies && dropped.size) out.bodies = rekey(doc.bodies, new Set(), dropped);
  return prefixDoc(out, out.nodes.length);
}

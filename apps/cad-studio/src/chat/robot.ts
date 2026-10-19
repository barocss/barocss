// The robot tools (RM1, O14): the assembly read as a joint tree, and its settings (the base link, joint limits and
// ratings). A change to the settings is the assembly's, so like a mate it is the user's to accept (D41: proposed).
import type { GearPlacement } from '@barocss/cad';
import type { StudioDoc } from '../engine/doc';
import type { BodyResult, EvalResult } from '../engine/evaluate';
import type { ToolDefinition } from './api';
import { BASE, eulerOf, rotationMatrix } from '../assembly/mates';
import { composeInto, forwardKinematics, gearPairAt } from '../robot/fk';
import { treeInertia, type LinkInertia } from '../robot/inertia';
import { exportUrdf, type UrdfResult } from '../robot/urdf';
import { readUrdf } from '../robot/urdfCheck';
import { exportMjcf, type MjcfResult } from '../robot/mjcf';
import { readMjcf } from '../robot/mjcfCheck';
import { sweepLinks, sweepPath } from '../robot/sweep';
import { gravityTorques, linkMasses, STANDARD_GRAVITY } from '../robot/dynamics';
import { convexHull } from '../robot/hull';
import { placeBody } from '../engine/evaluate';
import { tablesFor } from '../assembly/faces';
import { solveDoc } from './assembly';
import { jointTreeOf, readRobot, type JointSettings, type JointTree, type RobotSettings } from '../robot/joints';

type Evaluate = (doc: StudioDoc) => Promise<EvalResult | null>;
export const ROBOT_TOOL_NAMES = new Set(['get_joints', 'set_joints', 'forward_kinematics', 'link_inertia', 'export_urdf', 'export_mjcf', 'sweep_path', 'gravity_torques']);
const LIMIT_FIELDS = ['lower', 'upper', 'effort', 'velocity'] as const;

export const ROBOT_TOOLS: ToolDefinition[] = [
  {
    name: 'get_joints',
    description: 'The assembly as a robot: links (one a part; dummy links in a joint chain) and joints from the base link, each joint read from what the mates between two parts leave free — fixed, revolute (continuous without limits), prismatic, or a chain of them through dummy links (cylindrical, planar, ball). Joints have their key (the two parts in the document\'s order, base~p1, whichever is the parent; a chain\'s #0, #1), axis and a point on it (world, mm), limits and ratings, and the mates they come from. Also: loops (two parts joined again round the graph, kept as closures), gear couplings (meshing spur gears on one carrier: the second follows the first, −z1/z2), problems (typed: NOT_CONNECTED, MOTION_UNSUPPORTED, LIMITS_BAD, …) and notes (what an export still needs).',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'forward_kinematics',
    description: 'Where every part of the robot is for joint values (by joint key, from get_joints; radians for a turning joint, mm for a sliding one; absent: 0, the pose the mates solve to): each link\'s placement (position mm, rotation degrees about X, Y, Z, as place_part takes them), the values used (a gear follower from its leader), joints outside their limits, and each coupled gear pair\'s tooth phase there against its home phase (held: the pair turns together). Changes nothing.',
    input_schema: { type: 'object', properties: { values: { type: 'object', additionalProperties: { type: 'number' } } }, additionalProperties: false },
  },
  {
    name: 'link_inertia',
    description: 'Each robot link\'s mass properties as URDF and MJCF take them (SI): mass (kg, each body at its material\'s density; aluminium assumed where none is set, said so), the centre of mass (m) and the inertia about it (kg·m²) in the link frame — at the joint\'s point with Z along its axis for a moving link, the part\'s frame for the base and fixed ones — the principal moments and axes, and typed issues (NO_VOLUME, NOT_SPD, TRIANGLE, MATERIAL_ASSUMED; a dummy link is massless). Changes nothing.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'export_urdf',
    description: 'The robot as URDF (SI; each link\'s frame at its joint with Z on the axis; joint values 0 at the solved pose; inertia from link_inertia; meshes in the link frame in metres, the convex hull for collision; a gear follower as <mimic>): the document\'s text, the mesh files it names (written beside it by the studio\'s Export URDF or cad-cli urdf), notes (loops left out, materials assumed), and our structural check of it against the URDF spec. Refused, typed, when URDF cannot hold the robot: MOTION_UNSUPPORTED, LIMITS_BAD, LIMITS_MISSING (a revolute or prismatic joint needs lower, upper, effort and velocity: set_joints), INERTIA, NO_HULL. Changes nothing.',
    input_schema: { type: 'object', properties: { name: { type: 'string' } }, additionalProperties: false },
  },
  {
    name: 'export_mjcf',
    description: 'The robot as a MuJoCo MJCF model (the same frames, inertia and meshes as export_urdf; bodies nested at their link frames, hinge and slide joints at the body origin, the base fixed in the world, gravity −9.81 on Z; a passive model: no damping, friction or actuators invented; a gear follower as an equality). The model\'s text, its mesh files, notes, and our structural check of it. Refused as export_urdf is. Changes nothing.',
    input_schema: { type: 'object', properties: { name: { type: 'string' } }, additionalProperties: false },
  },
  {
    name: 'sweep_path',
    description: 'Checks a straight joint-space move for collisions between the robot\'s links: from "from" to "to" (joint values by key; absent: 0, the solved pose; radians or mm). Conservative advancement: each step is as long as the links\' clearance allows by a bound on how far the joints can carry their points, so the whole path is certified, not just samples; the clearance from the links\' convex hulls first, the meshes exactly where those meet. Parent and child links are not checked. Returns clear, or the first contact (where, the joint values there, the two links), the least clearance and where, the samples taken. Changes nothing.',
    input_schema: { type: 'object', properties: { from: { type: 'object', additionalProperties: { type: 'number' } }, to: { type: 'object', additionalProperties: { type: 'number' } } }, required: ['to'], additionalProperties: false },
  },
  {
    name: 'gravity_torques',
    description: 'What each joint must hold for the robot to stand still at joint values (by key; absent: 0; radians or mm): the static gravity torque (N·m, a turning joint) or force (N, a slide), G = ∂V/∂q, from each link\'s mass and centre of mass (link_inertia\'s) at that pose; gravity 9.80665 m/s² on −Z unless "g" is given. "generalized" folds a gear follower\'s share into its leader (×multiplier). Changes nothing.',
    input_schema: { type: 'object', properties: { values: { type: 'object', additionalProperties: { type: 'number' } }, g: { type: 'array', items: { type: 'number' } } }, additionalProperties: false },
  },
  {
    name: 'set_joints',
    description: 'Sets the robot\'s base link ("base" or a part id) and joints\' limits and ratings by joint key: {lower, upper} (radians for a turning joint, mm for a sliding one), effort (N·m or N) and velocity (rad/s or mm/s); a joint given null clears its settings. A turning joint with limits is revolute, without them continuous. The assembly\'s, so it is proposed (propose) for the user to accept.',
    input_schema: { type: 'object', properties: { base: { type: 'string' }, joints: { type: 'object', additionalProperties: { type: ['object', 'null'] } } }, additionalProperties: false },
  },
];

/** The joint tree of a document as it stands: its instances solved, its parts' faces and gears. */
export async function treeOfDoc(doc: StudioDoc, bodies: readonly BodyResult[], evaluate: Evaluate): Promise<JointTree> {
  const solved = solveDoc(doc), gears = new Map<string, GearPlacement[]>([[BASE, bodies.flatMap(b => (b.gear ? [b.gear] : []))]]);
  for (const inst of solved.doc.instances ?? []) { const r = await evaluate(inst.doc); gears.set(inst.id, r?.ok ? r.bodies.flatMap(b => (b.gear ? [b.gear] : [])) : []); }
  return jointTreeOf(solved.doc, { instances: solved.doc.instances ?? [], problems: solved.problems }, tablesFor(solved.doc), p => gears.get(p) ?? []);
}

export async function runRobotTool(doc: StudioDoc, bodies: readonly BodyResult[], name: string, args: Record<string, unknown>, evaluate: Evaluate): Promise<{ doc: StudioDoc; content: unknown; changed: boolean; summary: string } | { error: string }> {
  if (name === 'get_joints') {
    const t = await treeOfDoc(doc, bodies, evaluate);
    return { doc, content: t, changed: false, summary: `${t.joints.length} joints, ${t.loops.length} loops, ${t.problems.length} problems` };
  }
  if (name === 'gravity_torques') {
    const r = await robotOfDoc(doc, bodies, evaluate), keys = new Set(r.tree.joints.map(j => j.key)), given = (args.values ?? {}) as Record<string, unknown>;
    if (!given || typeof given !== 'object' || Array.isArray(given) || Object.values(given).some(v => typeof v !== 'number' || !Number.isFinite(v))) return { error: '"values" is {joint key: number}.' };
    const bad = Object.keys(given).filter(k => !keys.has(k)); if (bad.length) return { error: `No joint ${bad.join(', ')}; joints: ${[...keys].join(', ') || 'none'}.` };
    const g = args.g === undefined ? [0, 0, -STANDARD_GRAVITY] : args.g;
    if (!Array.isArray(g) || g.length !== 3 || g.some(x => typeof x !== 'number' || !Number.isFinite(x))) return { error: '"g" is [x, y, z] in m/s².' };
    const masses = linkMasses(r.tree, r.partOf), t = gravityTorques(r.tree, masses, given as Record<string, number>, g as [number, number, number]), sig = (v: number) => Number(v.toPrecision(12)) + 0;
    const units = Object.fromEntries(r.tree.joints.map(j => [j.key, j.type === 'prismatic' ? 'N' : 'N·m']));
    return { doc, content: { torques: Object.fromEntries(Object.entries(t.torques).map(([k, v]) => [k, sig(v)])), generalized: Object.fromEntries(Object.entries(t.generalized).map(([k, v]) => [k, sig(v)])), units, gravity_m_s2: Math.hypot(...(g as number[])) }, changed: false, summary: `${Object.keys(t.torques).length} joints` };
  }
  if (name === 'sweep_path') {
    const t = await treeOfDoc(doc, bodies, evaluate), keys = new Set(t.joints.map(j => j.key));
    const from = (args.from ?? {}) as Record<string, unknown>, to = (args.to ?? {}) as Record<string, unknown>;
    for (const v of [from, to]) {
      if (!v || typeof v !== 'object' || Array.isArray(v) || Object.values(v).some(x => typeof x !== 'number' || !Number.isFinite(x))) return { error: '"from" and "to" are {joint key: number}.' };
      const bad = Object.keys(v).filter(k => !keys.has(k)); if (bad.length) return { error: `No joint ${bad.join(', ')}; joints: ${[...keys].join(', ') || 'none'}.` };
    }
    const solved = solveDoc(doc).doc, world = new Map<string, readonly BodyResult[]>([[BASE, bodies]]);
    for (const i of solved.instances ?? []) { const r = await evaluate(i.doc); world.set(i.id, r?.ok ? r.bodies.map(b => placeBody({ ...b, mesh: { ...b.mesh, positions: b.mesh.positions.slice(), normals: b.mesh.normals.slice(), edgeLines: b.mesh.edgeLines.slice() } }, rotationMatrix(i.rotation), i.position)) : []); }
    const r = sweepPath(t, sweepLinks(t, p => world.get(p), pts => convexHull(pts).positions), from as Record<string, number>, to as Record<string, number>);
    const r6 = (v: number) => Math.round(v * 1e6) / 1e6 + 0;
    return { doc, content: { clear: r.clear, ...(r.contact ? { contact: { s: r6(r.contact.s), values: Object.fromEntries(Object.entries(r.contact.values).map(([k, v]) => [k, r6(v)])), links: r.contact.links } } : {}), min_clearance: r.minClearance ? { mm: r6(r.minClearance.mm), s: r6(r.minClearance.s), links: r.minClearance.links } : null, samples: r.samples, pairs: r.pairs.length, skipped: r.skipped }, changed: false, summary: r.clear ? `clear (${r.samples} steps)` : `contact ${r.contact!.links.join('–')} at s ${r6(r.contact!.s)}` };
  }
  if (name === 'export_mjcf') {
    const r = await mjcfOfDoc(doc, bodies, evaluate, typeof args.name === 'string' ? args.name : 'robot');
    if (!r.ok) return { error: `MJCF refused: ${r.refusals.map(x => `[${x.code}] ${x.message}`).join(' ')}` };
    const check = readMjcf(r.xml, new Set(r.files.map(f => f.path)));
    return { doc, content: { mjcf: r.xml, files: r.files.map(f => ({ path: f.path, bytes: f.data.length })), notes: r.notes, check: check.issues }, changed: false, summary: `MJCF: ${check.model.bodies.length} bodies${check.issues.length ? `, ${check.issues.length} issues` : ''}` };
  }
  if (name === 'export_urdf') {
    const r = await urdfOfDoc(doc, bodies, evaluate, typeof args.name === 'string' ? args.name : 'robot');
    if (!r.ok) return { error: `URDF refused: ${r.refusals.map(x => `[${x.code}] ${x.message}`).join(' ')}` };
    const check = readUrdf(r.urdf, new Set(r.files.map(f => f.path)));
    return { doc, content: { urdf: r.urdf, files: r.files.map(f => ({ path: f.path, bytes: f.data.length })), notes: r.notes, check: check.issues }, changed: false, summary: `URDF: ${check.model.links.length} links, ${check.model.joints.length} joints${check.issues.length ? `, ${check.issues.length} issues` : ''}` };
  }
  if (name === 'link_inertia') {
    const t = await treeOfDoc(doc, bodies, evaluate), solved = solveDoc(doc).doc, own = new Map<string, readonly BodyResult[]>([[BASE, bodies]]);
    for (const inst of solved.instances ?? []) { const r = await evaluate(inst.doc); own.set(inst.id, r?.ok ? r.bodies : []); }
    const links = treeInertia(t, p => { if (p === BASE) return { doc, bodies, position: [0, 0, 0], rotation: [0, 0, 0] }; const i = solved.instances?.find(x => x.id === p); return i ? { doc: i.doc, bodies: own.get(p) ?? [], position: i.position, rotation: i.rotation } : null; });
    return { doc, content: { links: links.map(inertiaJson) }, changed: false, summary: `${links.length} links, ${links.reduce((s, l) => s + l.massKg, 0).toPrecision(4)} kg` };
  }
  if (name === 'forward_kinematics') {
    const t = await treeOfDoc(doc, bodies, evaluate), given = args.values ?? {};
    if (!given || typeof given !== 'object' || Array.isArray(given) || Object.values(given).some(v => typeof v !== 'number' || !Number.isFinite(v))) return { error: '"values" is {joint key: number}.' };
    const fk = forwardKinematics(t, given as Record<string, number>);
    if (fk.unknown.length) return { error: `No joint ${fk.unknown.join(', ')}; joints: ${t.joints.map(j => j.key).join(', ') || 'none'}.` };
    const solved = solveDoc(doc).doc, r6 = (v: number) => Math.round(v * 1e6) / 1e6 + 0;
    const links = t.links.filter(l => l.part !== null).flatMap(l => {
      const m = fk.motions.get(l.id); if (!m) return [];
      const inst = solved.instances?.find(i => i.id === l.id), M = { R: Float64Array.from(inst ? rotationMatrix(inst.rotation) : [1, 0, 0, 0, 1, 0, 0, 0, 1]), t: Float64Array.from(inst ? inst.position : [0, 0, 0]) };
      const pose = composeInto({ R: new Float64Array(9), t: new Float64Array(3) }, m, M);
      return [{ link: l.id, name: l.name, position: [...pose.t].map(r6), rotation: eulerOf([...pose.R] as never).map(r6) }];
    });
    const gears = t.couplings.map(c => { const at = gearPairAt(c, fk.values), home = gearPairAt(c, {}); return { leader: c.leader, follower: c.follower, phase_deg: r6(at.phaseDeg), home_phase_deg: r6(home.phaseDeg), held: Math.abs(at.phaseDeg - home.phaseDeg) < 1e-6, backlash_mm: r6(at.backlashMM) }; });
    return { doc, content: { values: fk.values, links, gears, out_of_limits: fk.outOfLimits }, changed: false, summary: `${links.length} links placed${fk.outOfLimits.length ? `, ${fk.outOfLimits.length} outside their limits` : ''}` };
  }
  const was = readRobot(doc.robot), next: RobotSettings = { version: 1, ...(was.base ? { base: was.base } : {}), joints: { ...(was.joints ?? {}) } };
  const parts = [BASE, ...(doc.instances ?? []).map(i => i.id)];
  if (args.base !== undefined) {
    if (typeof args.base !== 'string' || !parts.includes(args.base)) return { error: `The base link is one of ${parts.join(', ')}.` };
    if (args.base === BASE) delete next.base; else next.base = args.base;
  }
  if (args.joints !== undefined) {
    if (!args.joints || typeof args.joints !== 'object' || Array.isArray(args.joints)) return { error: '"joints" is {key: {lower?, upper?, effort?, velocity?} | null}.' };
    for (const [key, s] of Object.entries(args.joints as Record<string, unknown>)) {
      if (s === null) { delete next.joints![key]; continue; }
      if (!s || typeof s !== 'object') return { error: `${key}: settings are {lower?, upper?, effort?, velocity?} or null.` };
      const bad = Object.keys(s).filter(k => !(LIMIT_FIELDS as readonly string[]).includes(k));
      if (bad.length) return { error: `${key}: no setting ${bad.join(', ')}; settings are ${LIMIT_FIELDS.join(', ')}.` };
      const j: JointSettings = { ...(next.joints![key] ?? {}) };
      for (const f of LIMIT_FIELDS) { const v = (s as Record<string, unknown>)[f]; if (v === undefined) continue; if (typeof v !== 'number' || !Number.isFinite(v)) return { error: `${key}.${f} is a number.` }; j[f] = v; }
      if (j.lower !== undefined && j.upper !== undefined && j.lower > j.upper) return { error: `${key}: lower (${j.lower}) is above upper (${j.upper}).` };
      if ((j.effort !== undefined && j.effort <= 0) || (j.velocity !== undefined && j.velocity <= 0)) return { error: `${key}: effort and velocity are above 0.` };
      next.joints![key] = j;
    }
  }
  // (A key the tree does not have is refused: it would be kept for nothing.)
  const tree = await treeOfDoc({ ...doc, robot: next }, bodies, evaluate), keys = new Set(tree.joints.map(j => j.key));
  const unknown = Object.keys(args.joints && typeof args.joints === 'object' ? args.joints : {}).filter(k => (args.joints as Record<string, unknown>)[k] !== null && !keys.has(k));
  if (unknown.length) return { error: `No joint ${unknown.join(', ')}; joints: ${[...keys].join(', ') || 'none'}.` };
  if (!Object.keys(next.joints!).length) delete next.joints;
  const robot = next.base || next.joints ? next : undefined, out = { ...doc };
  if (robot) out.robot = robot; else delete out.robot;
  const changed = JSON.stringify(doc.robot ?? null) !== JSON.stringify(robot ?? null);
  return { doc: out, content: { ok: true, did: changed ? 'set the robot settings' : 'no change', base: tree.base, joints: tree.joints.map(j => ({ key: j.key, type: j.type, ...(j.limit ? { limit: j.limit } : {}) })), problems: tree.problems }, changed, summary: changed ? `robot settings set (${tree.joints.length} joints)` : 'no change' };
}

const sig = (v: number) => Number(v.toPrecision(10)) + 0;
/** A link's inertia as the tool returns it (10 significant figures). */
export function inertiaJson(l: LinkInertia) {
  return { link: l.link, part: l.part, mass_kg: sig(l.massKg), com_m: l.comM.map(sig), inertia_kg_m2: [l.inertia.slice(0, 3), l.inertia.slice(3, 6), l.inertia.slice(6, 9)].map(r => r.map(sig)),
    principal: { moments_kg_m2: l.principal.moments.map(sig), axes: [l.principal.axes.slice(0, 3), l.principal.axes.slice(3, 6), l.principal.axes.slice(6, 9)].map(r => r.map(sig)) },
    frame: { origin_mm: l.frame.origin.map(sig), axes: [l.frame.R.slice(0, 3), l.frame.R.slice(3, 6), l.frame.R.slice(6, 9)].map(r => r.map(sig)) }, bodies: l.bodies.map(b => ({ ...b, massKg: sig(b.massKg) })), issues: l.issues };
}

/** The document's robot and its parts: its instances evaluated in their own coordinates, each with its placement. */
async function robotOfDoc(doc: StudioDoc, bodies: readonly BodyResult[], evaluate: Evaluate) {
  const t = await treeOfDoc(doc, bodies, evaluate), solved = solveDoc(doc).doc, own = new Map<string, readonly BodyResult[]>([[BASE, bodies]]);
  for (const inst of solved.instances ?? []) { const r = await evaluate(inst.doc); own.set(inst.id, r?.ok ? r.bodies : []); }
  const partOf = (p: string) => { if (p === BASE) return { doc, bodies, position: [0, 0, 0], rotation: [0, 0, 0] }; const i = solved.instances?.find(x => x.id === p); return i ? { doc: i.doc, bodies: own.get(p) ?? [], position: i.position, rotation: i.rotation } : null; };
  return { tree: t, partOf };
}
/** The document's robot as URDF (RM4). */
export async function urdfOfDoc(doc: StudioDoc, bodies: readonly BodyResult[], evaluate: Evaluate, name: string): Promise<UrdfResult> { const r = await robotOfDoc(doc, bodies, evaluate); return exportUrdf(r.tree, r.partOf, name); }
/** The document's robot as MJCF (RM5). */
export async function mjcfOfDoc(doc: StudioDoc, bodies: readonly BodyResult[], evaluate: Evaluate, name: string): Promise<MjcfResult> { const r = await robotOfDoc(doc, bodies, evaluate); return exportMjcf(r.tree, r.partOf, name); }

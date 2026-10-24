// The robot tools (RM1, O14): the assembly read as a joint tree, and its settings (the base link, joint limits and
// ratings). A change to the settings is the assembly's, so like a mate it is the user's to accept (D41: proposed).
import type { StudioDoc } from '../engine/doc';
import type { BodyResult, EvalResult } from '../engine/evaluate';
import type { ToolDefinition } from './api';
import { BASE } from '../assembly/mates';
import { eulerOf } from '../engine/placement';
import { type FrameSettings } from '../robot/frames';
import { type LinkInertia } from '../robot/inertia';
import { type UrdfResult } from '../robot/urdf';
import { readUrdf } from '../robot/urdfCheck';
import { type MjcfResult } from '../robot/mjcf';
import { readMjcf } from '../robot/mjcfCheck';
import { type SweepLink } from '../robot/sweep';
import { checkDesign, type Duty, type HarnessReport } from '../robot/harness';
import { sizeDesign, type Sized } from '../robot/sizer';
import type { V3 } from '../robot/inertia';
import { linkBodies, STANDARD_GRAVITY, type MoveLimits } from '../robot/dynamics';
import { MOTOR_FIELDS, MOTORS, readCatalogue, REDUCER_FIELDS, REDUCERS, SIZING_MODEL, type Motor, type Reducer, type Sizing, type Source } from '../robot/actuators';
import type { ProfileKind } from '../robot/profile';
import { checkFramesOn, withFrames } from '../assembly/edit';
import { readRobot, type JointSettings, type JointTree } from '../robot/joints';
import { r6 } from '../util/round';
import { isRefusal } from '../engine/refusal';
import { gravityOf, inertiaOf, mjcfOf, movesOf, partsOf, poseOf, robotViewOf, sizeOf, sweepLinksOf, sweepOf, treeOf, urdfOf, viewWith, withJoints, type RobotView } from '../robot/verbs';

type Evaluate = (doc: StudioDoc) => Promise<EvalResult | null>;
export const ROBOT_TOOL_NAMES = new Set(['get_joints', 'set_joints', 'set_frames', 'forward_kinematics', 'link_inertia', 'export_urdf', 'export_mjcf', 'sweep_path', 'gravity_torques', 'motion_torques', 'size_actuators']);
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
    name: 'motion_torques',
    description: 'The torques of a straight joint move from "from" to "to" (by key; absent: 0; radians or mm) under a motion profile: "trapezoid" (velocity and acceleration limits) or "s-curve" (and jerk), from rest to rest, all joints together on one profile so that each stays within its limits (per joint in "joint_limits", else "limits"; rad/s, rad/s², rad/s³ or mm/s…). Inverse dynamics (RNEA) with gravity along it: the move\'s duration, and per joint the peak and RMS torque (N·m, or N for a slide), when the peak comes, the distance and the peaks of velocity, acceleration and jerk reached, and how it was sampled. No limit is assumed: give them. Changes nothing.',
    input_schema: { type: 'object', properties: { from: { type: 'object', additionalProperties: { type: 'number' } }, to: { type: 'object', additionalProperties: { type: 'number' } }, profile: { type: 'string', enum: ['trapezoid', 's-curve'] }, limits: { type: 'object', properties: { velocity: { type: 'number' }, acceleration: { type: 'number' }, jerk: { type: 'number' } } }, joint_limits: { type: 'object', additionalProperties: { type: 'object' } } }, required: ['to', 'profile'], additionalProperties: false },
  },
  {
    name: 'size_actuators',
    description: 'Chooses a motor and a reducer for each turning joint from what a move asks of it: the move from "from" to "to" and back (as motion_torques takes it: profile and limits, none assumed), with "dwell_s" held at each end, repeated. Every motor × reducer pair is checked over that cycle — the motor\'s RMS torque against its nominal (continuous) torque, its torque at every instant against its torque–speed line at the nominal voltage, its speed, the load\'s inertia over the drive\'s (at most "inertia_ratio_max", 10); the reducer\'s peak against its repeated peak torque, its input speed, the speed-weighted cube-mean torque and the average input speed against their limits, its L10 life (against "life_h" when given) — and the lightest that passes is taken. The motor torque is τ/(N η) + (J_m + J_in) N q̈ + friction. Each check says whether its limit is from a product page, an estimate or a rule; every value has its source (the page\'s URL, the date read and its label there, or why it is estimated). Built in: maxon and Harmonic Drive values read from their product pages; "motors" and "reducers" add entries ({id, name, maker, and each field as {v, unit, src}}; "only_given" uses those alone). Rigid; an actuator\'s own mass is added to the links only with "coupled" (each chosen pair a point mass at its joint on the parent link, sized again until the choices settle). "estop_rad_s2": a stop event (every moving joint decelerating at it from the fastest instant), checked against the reducer\'s momentary peak torque. Changes nothing.',
    input_schema: { type: 'object', properties: { from: { type: 'object', additionalProperties: { type: 'number' } }, to: { type: 'object', additionalProperties: { type: 'number' } }, profile: { type: 'string', enum: ['trapezoid', 's-curve'] }, limits: { type: 'object', properties: { velocity: { type: 'number' }, acceleration: { type: 'number' }, jerk: { type: 'number' } } }, joint_limits: { type: 'object', additionalProperties: { type: 'object' } }, dwell_s: { type: 'number' }, life_h: { type: 'number' }, inertia_ratio_max: { type: 'number' }, estop_rad_s2: { type: 'number' }, coupled: { type: 'boolean' }, motors: { type: 'array', items: { type: 'object' } }, reducers: { type: 'array', items: { type: 'object' } }, only_given: { type: 'boolean' } }, required: ['to', 'profile'], additionalProperties: false },
  },
  {
    name: 'set_frames',
    description: 'Adds, replaces (by name) or removes (null) the robot\'s tool and sensor frames — a TCP, a camera: each on a link (the part it is on, "base" or a part id), its pose in that part\'s own coordinates (position mm, rotation degrees about X, then Y, then Z; default 0) and kind tool or sensor. The name is its name in URDF, SDF, MJCF (a site) and USD, where it is a fixed child of its link; forward_kinematics reports where each is. A frame on a part not in the assembly, or not joined to the base link, is refused. The assembly\'s, so it is proposed (propose) for the user to accept.',
    input_schema: { type: 'object', properties: { frames: { type: 'object', additionalProperties: { type: ['object', 'null'] } } }, required: ['frames'], additionalProperties: false },
  },
  {
    name: 'set_joints',
    description: 'Sets the robot\'s base link ("base" or a part id) and joints\' limits and ratings by joint key: {lower, upper} (radians for a turning joint, mm for a sliding one), effort (N·m or N) and velocity (rad/s or mm/s); a joint given null clears its settings. A turning joint with limits is revolute, without them continuous. The assembly\'s, so it is proposed (propose) for the user to accept.',
    input_schema: { type: 'object', properties: { base: { type: 'string' }, joints: { type: 'object', additionalProperties: { type: ['object', 'null'] } } }, additionalProperties: false },
  },
];

/** The joint tree of a document as it stands: its instances solved, its parts' faces and gears. */
export async function treeOfDoc(doc: StudioDoc, bodies: readonly BodyResult[], evaluate: Evaluate): Promise<JointTree> {
  return treeOf(await robotViewOf(doc, bodies, evaluate));
}

// (RS3: each tool's work is robot/verbs.ts's, on the view of the robot built once here; the call's shape is checked here.)
export async function runRobotTool(doc: StudioDoc, bodies: readonly BodyResult[], name: string, args: Record<string, unknown>, evaluate: Evaluate): Promise<{ doc: StudioDoc; content: unknown; changed: boolean; summary: string } | { error: string }> {
  const view = await robotViewOf(doc, bodies, evaluate);
  if (name === 'get_joints') {
    const t = treeOf(view);
    return { doc, content: t, changed: false, summary: `${t.joints.length} joints, ${t.loops.length} loops, ${t.problems.length} problems` };
  }
  if (name === 'motion_torques') {
    const t = treeOf(view), mv = moveArgs(t, args); if ('error' in mv) return mv;
    const content = movesOf(view, mv, t);
    return { doc, content, changed: false, summary: `${content.profile}, ${content.duration_s} s` };
  }
  if (name === 'size_actuators') {
    const t = treeOf(view), mv = moveArgs(t, args); if ('error' in mv) return mv;
    for (const f of ['dwell_s', 'life_h', 'inertia_ratio_max', 'estop_rad_s2'] as const) { const v = args[f]; if (v !== undefined && (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || (f !== 'dwell_s' && v === 0))) return { error: `"${f}" is a number ${f === 'dwell_s' ? 'of 0 or more' : 'above 0'}.` }; }
    let motors: readonly Motor[] = args.only_given ? [] : MOTORS, reducers: readonly Reducer[] = args.only_given ? [] : REDUCERS;
    if (args.motors !== undefined) { const c = readCatalogue(args.motors, MOTOR_FIELDS, 'motors'); if ('error' in c) return c; motors = [...motors, ...(c.entries as unknown as Motor[])]; }
    if (args.reducers !== undefined) { const c = readCatalogue(args.reducers, REDUCER_FIELDS, 'reducers'); if ('error' in c) return c; reducers = [...reducers, ...(c.entries as unknown as Reducer[])]; }
    if (!motors.length || !reducers.length) return { error: 'No motor or no reducer to choose from: give "motors" and "reducers", or leave "only_given" off for the built-in ones.' };
    const so = { motors, reducers, dwell: args.dwell_s as number | undefined, life: args.life_h as number | undefined, inertiaRatio: args.inertia_ratio_max as number | undefined, ...(args.estop_rad_s2 !== undefined ? { estop: args.estop_rad_s2 as number } : {}) };
    // (O75: coupled — each chosen pair's own mass on its joint's parent link, sized again until the choices settle.)
    const { sizing: s, coupled: cs } = sizeOf(view, mv, so, args.coupled === true, t);
    return { doc, content: { ...sizingJson(s), ...(cs ? { coupled: { rounds: cs.rounds, settled: cs.settled, added: cs.added.map(a => ({ joint: a.joint, link: a.link, mass_kg: sig(a.massKg) })) } } : {}) }, changed: false, summary: s.joints.map(j => `${j.key}: ${j.choice ? `${j.choice.motor} + ${j.choice.reducer}` : 'none feasible'}`).join('; ') || 'nothing to size' };
  }
  if (name === 'gravity_torques') {
    const t = treeOf(view), keys = new Set(t.joints.map(j => j.key)), given = (args.values ?? {}) as Record<string, unknown>;
    if (!given || typeof given !== 'object' || Array.isArray(given) || Object.values(given).some(v => typeof v !== 'number' || !Number.isFinite(v))) return { error: '"values" is {joint key: number}.' };
    const bad = Object.keys(given).filter(k => !keys.has(k)); if (bad.length) return { error: `No joint ${bad.join(', ')}; joints: ${[...keys].join(', ') || 'none'}.` };
    const g = args.g === undefined ? [0, 0, -STANDARD_GRAVITY] : args.g;
    if (!Array.isArray(g) || g.length !== 3 || g.some(x => typeof x !== 'number' || !Number.isFinite(x))) return { error: '"g" is [x, y, z] in m/s².' };
    const content = gravityOf(view, given as Record<string, number>, g as [number, number, number], t);
    return { doc, content, changed: false, summary: `${Object.keys(content.torques).length} joints` };
  }
  if (name === 'sweep_path') {
    const t = treeOf(view), keys = new Set(t.joints.map(j => j.key));
    const from = (args.from ?? {}) as Record<string, unknown>, to = (args.to ?? {}) as Record<string, unknown>;
    for (const v of [from, to]) {
      if (!v || typeof v !== 'object' || Array.isArray(v) || Object.values(v).some(x => typeof x !== 'number' || !Number.isFinite(x))) return { error: '"from" and "to" are {joint key: number}.' };
      const bad = Object.keys(v).filter(k => !keys.has(k)); if (bad.length) return { error: `No joint ${bad.join(', ')}; joints: ${[...keys].join(', ') || 'none'}.` };
    }
    const r = sweepOf(view, from as Record<string, number>, to as Record<string, number>, t);
    return { doc, content: r.reply, changed: false, summary: r.summary };
  }
  if (name === 'export_mjcf') {
    const r = mjcfOf(view, typeof args.name === 'string' ? args.name : 'robot');
    if (!r.ok) return { error: `MJCF refused: ${r.refusals.map(x => `[${x.code}] ${x.message}`).join(' ')}` };
    const check = readMjcf(r.xml, new Set(r.files.map(f => f.path)));
    return { doc, content: { mjcf: r.xml, files: r.files.map(f => ({ path: f.path, bytes: f.data.length })), notes: r.notes, check: check.issues }, changed: false, summary: `MJCF: ${check.model.bodies.length} bodies${check.issues.length ? `, ${check.issues.length} issues` : ''}` };
  }
  if (name === 'export_urdf') {
    const r = urdfOf(view, typeof args.name === 'string' ? args.name : 'robot');
    if (!r.ok) return { error: `URDF refused: ${r.refusals.map(x => `[${x.code}] ${x.message}`).join(' ')}` };
    const check = readUrdf(r.urdf, new Set(r.files.map(f => f.path)));
    return { doc, content: { urdf: r.urdf, files: r.files.map(f => ({ path: f.path, bytes: f.data.length })), notes: r.notes, check: check.issues }, changed: false, summary: `URDF: ${check.model.links.length} links, ${check.model.joints.length} joints${check.issues.length ? `, ${check.issues.length} issues` : ''}` };
  }
  if (name === 'link_inertia') {
    const links = inertiaOf(view);
    return { doc, content: { links: links.map(inertiaJson) }, changed: false, summary: `${links.length} links, ${links.reduce((s, l) => s + l.massKg, 0).toPrecision(4)} kg` };
  }
  if (name === 'forward_kinematics') {
    const t = treeOf(view), given = args.values ?? {};
    if (!given || typeof given !== 'object' || Array.isArray(given) || Object.values(given).some(v => typeof v !== 'number' || !Number.isFinite(v))) return { error: '"values" is {joint key: number}.' };
    const p = poseOf(view, given as Record<string, number>, t);
    if (p.unknown.length) return { error: `No joint ${p.unknown.join(', ')}; joints: ${t.joints.map(j => j.key).join(', ') || 'none'}.` };
    return { doc, content: p.reply, changed: false, summary: `${p.reply.links.length} links placed${p.reply.out_of_limits.length ? `, ${p.reply.out_of_limits.length} outside their limits` : ''}` };
  }
  if (name === 'set_frames') return setFrames(view, args);
  const was = readRobot(doc.robot), joints: Record<string, JointSettings | null> = {};
  const parts = [BASE, ...(doc.instances ?? []).map(i => i.id)];
  if (args.base !== undefined && (typeof args.base !== 'string' || !parts.includes(args.base))) return { error: `The base link is one of ${parts.join(', ')}.` };
  if (args.joints !== undefined) {
    if (!args.joints || typeof args.joints !== 'object' || Array.isArray(args.joints)) return { error: '"joints" is {key: {lower?, upper?, effort?, velocity?} | null}.' };
    const merged: Record<string, JointSettings> = { ...(was.joints ?? {}) };
    for (const [key, s] of Object.entries(args.joints as Record<string, unknown>)) {
      if (s === null) { joints[key] = null; delete merged[key]; continue; }
      if (!s || typeof s !== 'object') return { error: `${key}: settings are {lower?, upper?, effort?, velocity?} or null.` };
      const bad = Object.keys(s).filter(k => !(LIMIT_FIELDS as readonly string[]).includes(k));
      if (bad.length) return { error: `${key}: no setting ${bad.join(', ')}; settings are ${LIMIT_FIELDS.join(', ')}.` };
      const j: JointSettings = { ...(merged[key] ?? {}) };
      for (const f of LIMIT_FIELDS) { const v = (s as Record<string, unknown>)[f]; if (v === undefined) continue; if (typeof v !== 'number' || !Number.isFinite(v)) return { error: `${key}.${f} is a number.` }; j[f] = v; }
      if (j.lower !== undefined && j.upper !== undefined && j.lower > j.upper) return { error: `${key}: lower (${j.lower}) is above upper (${j.upper}).` };
      if ((j.effort !== undefined && j.effort <= 0) || (j.velocity !== undefined && j.velocity <= 0)) return { error: `${key}: effort and velocity are above 0.` };
      merged[key] = j; joints[key] = j;
    }
  }
  const out = withJoints(doc, { ...(args.base !== undefined ? { base: args.base as string } : {}), joints });
  // (A key the tree does not have is refused: it would be kept for nothing.)
  const tree = treeOf(viewWith(view, out)), keys = new Set(tree.joints.map(j => j.key));
  const unknown = Object.keys(args.joints && typeof args.joints === 'object' ? args.joints : {}).filter(k => (args.joints as Record<string, unknown>)[k] !== null && !keys.has(k));
  if (unknown.length) return { error: `No joint ${unknown.join(', ')}; joints: ${[...keys].join(', ') || 'none'}.` };
  const changed = JSON.stringify(doc.robot ?? null) !== JSON.stringify(out.robot ?? null);
  return { doc: out, content: { ok: true, did: changed ? 'set the robot settings' : 'no change', base: tree.base, joints: tree.joints.map(j => ({ key: j.key, type: j.type, ...(j.limit ? { limit: j.limit } : {}) })), problems: tree.problems }, changed, summary: changed ? `robot settings set (${tree.joints.length} joints)` : 'no change' };
}

/** O12: tool and sensor frames added, replaced (by name) or removed (null); each one named is checked on the tree, typed. */
function setFrames(view: RobotView, args: Record<string, unknown>): { doc: StudioDoc; content: unknown; changed: boolean; summary: string } | { error: string } {
  const doc = view.doc;
  if (!args.frames || typeof args.frames !== 'object' || Array.isArray(args.frames) || !Object.keys(args.frames).length) return { error: '"frames" is {name: {link, position?, rotation?, kind?} | null}: a frame added or replaced by its name, null removes it.' };
  const was = readRobot(doc.robot), frames: Record<string, FrameSettings> = { ...(was.frames ?? {}) }, did: string[] = [];
  for (const [name, f] of Object.entries(args.frames as Record<string, unknown>)) {
    if (f === null) { if (!frames[name]) return { error: `[FRAME_NAME] no frame ${name} to remove (frames: ${Object.keys(frames).join(', ') || 'none'})` }; delete frames[name]; did.push(`removed ${name}`); continue; }
    if (!f || typeof f !== 'object' || Array.isArray(f)) return { error: `[FRAME_POSE] frame ${name}: {link, position?, rotation?, kind?}` };
    const extra = Object.keys(f).filter(k => !FRAME_FIELDS.includes(k));
    if (extra.length) return { error: `[FRAME_POSE] frame ${name}: no field ${extra.join(', ')}; a frame is ${FRAME_FIELDS.join(', ')}` };
    const g = f as Record<string, unknown>;
    if (typeof g.link !== 'string') return { error: `[FRAME_LINK_MISSING] frame ${name}: "link" is the part it is on ("base" or a part id)` };
    if (g.kind !== undefined && g.kind !== 'tool' && g.kind !== 'sensor') return { error: `[FRAME_POSE] frame ${name}: "kind" is tool or sensor` };
    did.push(`${frames[name] ? 'replaced' : 'added'} ${name} on ${g.link}`);
    frames[name] = { link: g.link, ...(g.position !== undefined ? { position: g.position as number[] } : {}), ...(g.rotation !== undefined ? { rotation: g.rotation as number[] } : {}), ...(g.kind ? { kind: g.kind as 'tool' | 'sensor' } : {}) };
  }
  // (The write and the tree's check are the core's, assembly/edit.ts; the call's shape is checked above, in its order.)
  const out = withFrames(doc, args.frames as Record<string, FrameSettings | null>), tree = treeOf(viewWith(view, out));
  try { checkFramesOn(tree, Object.keys(args.frames)); } catch (e) { if (isRefusal(e)) return { error: e.message }; throw e; }
  return { doc: out, content: { ok: true, did: did.join(', '), frames: (tree.frames ?? []).map(f => ({ frame: f.name, link: f.link, ...(f.kind ? { kind: f.kind } : {}), position: f.o.map(r6), rotation: eulerOf(f.R).map(r6) })) }, changed: true, summary: `frames: ${did.join(', ')}` };
}
const FRAME_FIELDS = ['link', 'position', 'rotation', 'kind'];

const sig = (v: number) => Number(v.toPrecision(10)) + 0;
/** A link's inertia as the tool returns it (10 significant figures). */
export function inertiaJson(l: LinkInertia) {
  return { link: l.link, part: l.part, mass_kg: sig(l.massKg), com_m: l.comM.map(sig), inertia_kg_m2: [l.inertia.slice(0, 3), l.inertia.slice(3, 6), l.inertia.slice(6, 9)].map(r => r.map(sig)),
    principal: { moments_kg_m2: l.principal.moments.map(sig), axes: [l.principal.axes.slice(0, 3), l.principal.axes.slice(3, 6), l.principal.axes.slice(6, 9)].map(r => r.map(sig)) },
    frame: { origin_mm: l.frame.origin.map(sig), axes: [l.frame.R.slice(0, 3), l.frame.R.slice(3, 6), l.frame.R.slice(6, 9)].map(r => r.map(sig)) }, bodies: l.bodies.map(b => ({ ...b, massKg: sig(b.massKg) })), issues: l.issues };
}

/** A move's arguments (motion_torques, size_actuators): from and to by joint key, the profile, and each moving joint's
 * limits (per joint, else for all; none assumed). */
function moveArgs(tree: JointTree, args: Record<string, unknown>): { from: Record<string, number>; to: Record<string, number>; profile: ProfileKind; limits: (k: string) => MoveLimits } | { error: string } {
  const keys = new Set(tree.joints.map(j => j.key)), from = (args.from ?? {}) as Record<string, unknown>, to = (args.to ?? {}) as Record<string, unknown>;
  for (const v of [from, to]) {
    if (!v || typeof v !== 'object' || Array.isArray(v) || Object.values(v).some(x => typeof x !== 'number' || !Number.isFinite(x))) return { error: '"from" and "to" are {joint key: number}.' };
    const bad = Object.keys(v).filter(k => !keys.has(k)); if (bad.length) return { error: `No joint ${bad.join(', ')}; joints: ${[...keys].join(', ') || 'none'}.` };
  }
  if (args.profile !== 'trapezoid' && args.profile !== 's-curve') return { error: '"profile" is "trapezoid" or "s-curve".' };
  const ok = (l: unknown): l is MoveLimits => !!l && typeof l === 'object' && typeof (l as MoveLimits).velocity === 'number' && (l as MoveLimits).velocity > 0 && typeof (l as MoveLimits).acceleration === 'number' && (l as MoveLimits).acceleration > 0 && ((l as MoveLimits).jerk === undefined || (typeof (l as MoveLimits).jerk === 'number' && (l as MoveLimits).jerk! > 0));
  const per = (args.joint_limits ?? {}) as Record<string, unknown>, all = args.limits;
  const moving = Object.keys({ ...from, ...to }).filter(k => ((to[k] as number) ?? 0) !== ((from[k] as number) ?? 0));
  for (const k of moving) { const l = per[k] ?? all; if (!ok(l)) return { error: `${k}: give its limits (velocity and acceleration above 0${args.profile === 's-curve' ? ', and jerk for an S-curve' : ''}) in "limits" or "joint_limits" — none is assumed.` }; if (args.profile === 's-curve' && (l as MoveLimits).jerk === undefined) return { error: `${k}: an S-curve needs a jerk limit.` }; }
  return { from: from as Record<string, number>, to: to as Record<string, number>, profile: args.profile, limits: k => (per[k] ?? all) as MoveLimits };
}

/** The sizing as the tool returns it (10 significant figures; a margin with nothing to check is null). */
export function sizingJson(s: Sizing) {
  const n = (v: number) => (Number.isFinite(v) ? sig(v) : null);
  return {
    profile: s.kind, move_s: sig(s.moveS), cycle_s: sig(s.cycleS), model: SIZING_MODEL,
    joints: s.joints.map(j => ({
      key: j.key, choice: j.choice ? { motor: j.choice.motor, reducer: j.choice.reducer, ratio: j.choice.ratio, mass_kg: sig(j.choice.massKg) } : null,
      checks: j.checks.map(c => ({ name: c.name, value: n(c.value), limit: n(c.limit), unit: c.unit, ok: c.ok, margin: n(c.margin), limit_source: c.limitSource })),
      candidates: j.candidates, feasible: j.feasible, rejected: j.rejected, ...sourcesJson(j.sources),
    })),
    skipped: s.skipped, sampling: s.sampling, pending_worked_examples: s.pending,
  };
}

/** The chosen pair's sources: by page (its URL, the date read, each field's label there), then the derived and the
 * estimated fields with why. */
function sourcesJson(list: readonly { field: string; src: Source }[]) {
  const pages = new Map<string, { page: string; read: string; labels: Record<string, string> }>(), derived: Record<string, string> = {}, estimates: Record<string, string> = {};
  for (const { field, src } of list) {
    if ('page' in src) { const p = pages.get(src.page) ?? { page: src.page, read: src.read, labels: {} }; p.labels[field] = src.label; pages.set(src.page, p); }
    else if ('derived' in src) derived[field] = src.derived; else estimates[field] = src.estimate;
  }
  return { sources: [...pages.values()], derived, estimates };
}

/** The document's robot and its parts: its instances evaluated in their own coordinates, each with its placement. */
export async function robotOfDoc(doc: StudioDoc, bodies: readonly BodyResult[], evaluate: Evaluate) {
  const view = await robotViewOf(doc, bodies, evaluate);
  return { tree: treeOf(view), partOf: partsOf(view) };
}
/** The robot's links for RM6's sweep: each part's bodies where the mates put them, with their convex hulls. */
export async function sweepLinksOfDoc(doc: StudioDoc, bodies: readonly BodyResult[], evaluate: Evaluate, t: JointTree): Promise<SweepLink[]> {
  return sweepLinksOf(await robotViewOf(doc, bodies, evaluate), t);
}
/** A duty as given (JSON), each move checked as motion_torques takes one; or why not. */
export function readDuty(tree: JointTree, raw: unknown): Duty | { error: string } {
  const d = raw as Record<string, unknown> | null;
  if (!d || typeof d !== 'object' || !Array.isArray(d.moves) || !d.moves.length) return { error: 'a duty has "moves": [{from, to, profile, limits | joint_limits, dwell_s?}, …]' };
  const moves: Duty['moves'] = [];
  for (const [i, m] of (d.moves as Record<string, unknown>[]).entries()) {
    const a = moveArgs(tree, m); if ('error' in a) return { error: `move ${i}: ${a.error}` };
    const dwell = m.dwell_s ?? 0; if (typeof dwell !== 'number' || !(dwell >= 0)) return { error: `move ${i}: "dwell_s" is a time of 0 s or more` };
    moves.push({ from: a.from, to: a.to, profile: a.profile, ...(m.limits ? { limits: m.limits as MoveLimits } : {}), ...(m.joint_limits ? { joint_limits: m.joint_limits as Record<string, MoveLimits> } : {}), dwell_s: dwell });
  }
  const num = (k: string) => { const v = d[k]; return v === undefined ? undefined : typeof v === 'number' && v > 0 ? v : NaN; };
  for (const k of ['life_h', 'inertia_ratio_max']) if (Number.isNaN(num(k))) return { error: `"${k}" is a number above 0` };
  if (d.clearance_mm !== undefined && !(typeof d.clearance_mm === 'number' && d.clearance_mm >= 0)) return { error: '"clearance_mm" is 0 or more' };
  return { moves, ...(num('life_h') ? { life_h: num('life_h') } : {}), ...(num('inertia_ratio_max') ? { inertia_ratio_max: num('inertia_ratio_max') } : {}), ...(d.clearance_mm !== undefined ? { clearance_mm: d.clearance_mm as number } : {}), ...(d.actuators ? { actuators: d.actuators as Duty['actuators'] } : {}), ...(Array.isArray(d.g) ? { g: d.g as V3 } : {}) };
}
/** RD9's harness on the document's robot: every margin against the duty (src/robot/harness.ts). */
export async function robotCheckOfDoc(doc: StudioDoc, bodies: readonly BodyResult[], evaluate: Evaluate, duty: Duty): Promise<HarnessReport> {
  const r = await robotOfDoc(doc, bodies, evaluate);
  return checkDesign(r.tree, linkBodies(r.tree, r.partOf), await sweepLinksOfDoc(doc, bodies, evaluate, r.tree), duty);
}
/** RD10's scripted sizer on the document's robot: the sized ratings written back to its joints, the duty with its actuators. */
export async function robotSizeOfDoc(doc: StudioDoc, bodies: readonly BodyResult[], evaluate: Evaluate, duty: Duty, o: { maxRounds?: number } = {}): Promise<{ sized: Sized; doc: StudioDoc }> {
  const r = await robotOfDoc(doc, bodies, evaluate), sized = sizeDesign(r.tree, linkBodies(r.tree, r.partOf), await sweepLinksOfDoc(doc, bodies, evaluate, r.tree), duty, o);
  const robot = readRobot(doc.robot), joints: Record<string, JointSettings> = { ...robot.joints };
  for (const j of sized.tree.joints) if (j.limit && (j.limit.velocity !== undefined || j.limit.effort !== undefined)) joints[j.key] = { ...joints[j.key], ...(j.limit.velocity !== undefined ? { velocity: j.limit.velocity } : {}), ...(j.limit.effort !== undefined ? { effort: j.limit.effort } : {}) };
  return { sized, doc: { ...doc, robot: { ...robot, joints } } };
}
/** The document's robot as URDF (RM4). */
export async function urdfOfDoc(doc: StudioDoc, bodies: readonly BodyResult[], evaluate: Evaluate, name: string): Promise<UrdfResult> { return urdfOf(await robotViewOf(doc, bodies, evaluate), name); }
/** The document's robot as MJCF (RM5). */
export async function mjcfOfDoc(doc: StudioDoc, bodies: readonly BodyResult[], evaluate: Evaluate, name: string): Promise<MjcfResult> { return mjcfOf(await robotViewOf(doc, bodies, evaluate), name); }

// The robot tools (RM1, O14): the assembly read as a joint tree, and its settings (the base link, joint limits and
// ratings). A change to the settings is the assembly's, so like a mate it is the user's to accept (D41: proposed).
import type { GearPlacement } from '@barocss/cad';
import type { StudioDoc } from '../engine/doc';
import type { BodyResult, EvalResult } from '../engine/evaluate';
import type { ToolDefinition } from './api';
import { BASE } from '../assembly/mates';
import { tablesFor } from '../assembly/faces';
import { solveDoc } from './assembly';
import { jointTreeOf, readRobot, type JointSettings, type JointTree, type RobotSettings } from '../robot/joints';

type Evaluate = (doc: StudioDoc) => Promise<EvalResult | null>;
export const ROBOT_TOOL_NAMES = new Set(['get_joints', 'set_joints']);
const LIMIT_FIELDS = ['lower', 'upper', 'effort', 'velocity'] as const;

export const ROBOT_TOOLS: ToolDefinition[] = [
  {
    name: 'get_joints',
    description: 'The assembly as a robot: links (one a part; dummy links in a joint chain) and joints from the base link, each joint read from what the mates between two parts leave free — fixed, revolute (continuous without limits), prismatic, or a chain of them through dummy links (cylindrical, planar, ball). Joints have their key (the two parts in the document\'s order, base~p1, whichever is the parent; a chain\'s #0, #1), axis and a point on it (world, mm), limits and ratings, and the mates they come from. Also: loops (two parts joined again round the graph, kept as closures), gear couplings (meshing spur gears on one carrier: the second follows the first, −z1/z2), problems (typed: NOT_CONNECTED, MOTION_UNSUPPORTED, LIMITS_BAD, …) and notes (what an export still needs).',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
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

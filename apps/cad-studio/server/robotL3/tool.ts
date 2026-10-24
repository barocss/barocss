import { isRefusal } from '@barocss/cad-model/engine/refusal';
// O15 (RD10's L3 run, O46's protocol): `robot_check`, RD9's harness as a chat tool for that run only. It is listed and
// allowed only when the run sets CAD_ROBOT_L3=1, so every other turn, the toolset guard and the per-turn budget are as
// they were. It checks the robot as the turn has it with the joints' ratings and the duty passed (each absent: the last
// passed), and gives every margin; what it ran is kept at CAD_ROBOT_L3_DUTY (the duty) and beside it (`.joints.json`, the
// ratings), where the run reads the design to judge afresh. It changes nothing in the part itself: a robot change is
// always the user's to approve (a proposal), and the run has no user, so the ratings are the tool's arguments.
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import { robotCheckOfDoc } from '@barocss/cad-model/chat/robot';
import type { PublicDuty } from '@barocss/cad-model/robot/reports';

type Evaluate = (doc: StudioDoc) => Promise<{ ok: true; bodies: BodyResult[] } | { ok: false } | null | undefined>;
export const robotL3 = () => process.env.CAD_ROBOT_L3 === '1';
export const ROBOT_CHECK = 'robot_check';
/** What the MCP server needs to run it (the chat server passes them on in its config). */
export const robotL3Env = (): Record<string, string> => Object.fromEntries(['CAD_ROBOT_L3', 'CAD_ROBOT_L3_DUTY', 'CAD_ROBOT_L3_LOG'].flatMap(k => process.env[k] ? [[k, process.env[k]!]] : []));

/** The tool as MCP lists it (only for the run). */
export const robotCheckListed = () => ({
  name: ROBOT_CHECK, title: 'Robot design check',
  description: 'RD9\'s harness on the robot: every margin of its joints, actuators and duty (above 0 passes), the least named, and what is unknown. "joints": ratings by joint key {velocity (degree/s or mm/s), effort (N·mm or N)}, over the part\'s. "duty": public JSON with moves {from, to, profile, joint_limits, dwell}, serviceLife (s), optional clearance (mm), g (mm/s²), and actuators per joint; turning values and limits use degrees, slides use mm, times use seconds. Each absent: the last passed. The last design checked is the one judged.',
  inputSchema: { type: 'object', properties: { joints: { type: 'object', additionalProperties: { type: 'object' } }, duty: { type: 'object' } }, additionalProperties: false },
  annotations: { readOnlyHint: true, openWorldHint: false },
});

type Ratings = Record<string, { velocity?: number; effort?: number }>;
/** What is wrong with the ratings passed, or null. */
function ratingsProblem(r: unknown): string | null {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return 'an object by joint key: {velocity?, effort?}';
  for (const [k, v] of Object.entries(r)) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return `${k}: {velocity?, effort?}`;
    for (const [f, x] of Object.entries(v)) if ((f !== 'velocity' && f !== 'effort') || !(typeof x === 'number' && Number.isFinite(x) && x > 0)) return `${k}.${f}: velocity or effort, a number above 0`;
  }
  return null;
}
/** The part with the ratings over its robot's joints (velocity, effort). */
export function withRatings(doc: StudioDoc, ratings: Ratings): StudioDoc {
  const joints = { ...(doc.robot?.joints ?? {}) };
  for (const [k, v] of Object.entries(ratings)) joints[k] = { ...joints[k], ...v };
  return { ...doc, robot: { version: 1, ...doc.robot, joints } };
}
/** One call: the report as text, or why it could not run. */
export async function robotCheckCall(doc: StudioDoc, bodies: readonly BodyResult[], evaluate: Evaluate, args: Record<string, unknown>): Promise<{ text: string; isError: boolean }> {
  const path = process.env.CAD_ROBOT_L3_DUTY;
  let raw: unknown = args.duty;
  if (raw === undefined) { try { raw = path ? JSON.parse(readFileSync(path, 'utf8')) : undefined; } catch { raw = undefined; } }
  if (raw === undefined) return { text: JSON.stringify({ ok: false, error: 'No duty yet: pass "duty" (public moves, serviceLife in seconds, actuators per joint).' }), isError: true };
  // (The ratings passed, else the last passed, over the part's own: a copy, the part unchanged.)
  const jointsPath = path ? path.replace(/\.json$/, '.joints.json') : undefined;
  let ratings: unknown = args.joints;
  if (ratings === undefined) { try { ratings = jointsPath ? JSON.parse(readFileSync(jointsPath, 'utf8')) : {}; } catch { ratings = {}; } }
  const bad = ratingsProblem(ratings); if (bad) return { text: JSON.stringify({ ok: false, error: `joints: ${bad}` }), isError: true };
  doc = withRatings(doc, ratings as Ratings);
  let report: Awaited<ReturnType<typeof robotCheckOfDoc>>;
  try { report = await robotCheckOfDoc(doc, bodies, evaluate as never, raw as PublicDuty); }
  catch (e) { if (isRefusal(e, 'BAD_VALUES')) return { text: JSON.stringify({ ok: false, error: `duty: ${e.message}` }), isError: true }; throw e; }
  // Preserve validated public numbers: a second duty projection can round a pose by one ULP.
  if (path) writeFileSync(path, JSON.stringify(raw, null, 1) + '\n');
  if (jointsPath) writeFileSync(jointsPath, JSON.stringify(ratings, null, 1) + '\n');
  // (Each call as the run records it: whether it passed, the least margin, how many failed, the actuators it ran.)
  if (process.env.CAD_ROBOT_L3_LOG) appendFileSync(process.env.CAD_ROBOT_L3_LOG, JSON.stringify({ ok: report.ok, least: report.least, failing: report.margins.filter(m => !m.ok).length, unknowns: report.unknowns.length, actuators: (raw as { actuators?: unknown }).actuators ?? null, joints: ratings }) + '\n');
  return { text: JSON.stringify(report), isError: false };
}

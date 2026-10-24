// Public projections of internal SI calculations. Convert before applying the established reply precision.
import type { LinkInertia, V3 } from './inertia';
import type { JointTree } from './joints';
import { STANDARD_GRAVITY, type GravityResult, type MoveTorques } from './dynamics';
import { SIZING_MODEL, type Sizing, type Source, type SizeOptions } from './actuators';

export const PUBLIC_GRAVITY = STANDARD_GRAVITY * 1000;
const sig = (v: number) => Number(v.toPrecision(10)) + 0;
const sig12 = (v: number) => Number(v.toPrecision(12)) + 0;
const turn = (tree: JointTree, key: string) => { const j = tree.joints.find(x => x.key === key); return j?.type === 'revolute' || j?.type === 'continuous'; };
const torqueScale = (tree: JointTree, key: string) => turn(tree, key) ? 1000 : 1;
/** Public gravity in mm/s² as the internal SI vector; preserve the existing physical default. */
export const gravityIn = (g: readonly [number, number, number] = [0, 0, -PUBLIC_GRAVITY]): V3 => g.map(x => x / 1000) as V3;

export interface PublicSizeOptions { dwell?: number; serviceLife?: number; stopDeceleration?: number; inertiaRatio?: number; g?: V3 }
/** Public seconds/degrees as the sizing core's hours/radians; catalogue records keep their source units. */
export function sizeOptionsIn(o: PublicSizeOptions): Pick<SizeOptions, 'dwell' | 'life' | 'estop' | 'inertiaRatio' | 'g'> {
  return { ...(o.dwell !== undefined ? { dwell: o.dwell } : {}), ...(o.serviceLife !== undefined ? { life: o.serviceLife / 3600 } : {}),
    ...(o.stopDeceleration !== undefined ? { estop: o.stopDeceleration * (Math.PI / 180) } : {}),
    ...(o.inertiaRatio !== undefined ? { inertiaRatio: o.inertiaRatio } : {}), g: gravityIn(o.g) };
}

export function inertiaJson(l: LinkInertia) {
  const tensor = (a: readonly number[], scale: number) => [a.slice(0, 3), a.slice(3, 6), a.slice(6, 9)].map(r => r.map(x => sig(x * scale)));
  return { link: l.link, part: l.part, mass: sig(l.massKg * 1000), centroid: l.comM.map(x => sig(x * 1000)), inertia: tensor(l.inertia, 1e9),
    principal: { moments: l.principal.moments.map(x => sig(x * 1e9)), axes: tensor(l.principal.axes, 1) },
    frame: { origin: l.frame.origin.map(sig), axes: tensor(l.frame.R, 1) },
    bodies: l.bodies.map(({ massKg, ...body }) => ({ ...body, mass: sig(massKg * 1000) })), issues: l.issues };
}

export function gravityJson(tree: JointTree, result: GravityResult, g: readonly [number, number, number]) {
  const torques = (values: Record<string, number>) => Object.fromEntries(Object.entries(values).map(([key, value]) => [key, sig12(value * torqueScale(tree, key))]));
  return { torques: torques(result.torques), generalized: torques(result.generalized),
    units: Object.fromEntries(tree.joints.map(j => [j.key, j.type === 'prismatic' ? 'N' : 'N·mm'])), gravity: sig12(Math.hypot(...g) * 1000),
    ...(result.notReady ? { notReady: result.notReady } : {}) };
}

export function moveJson(tree: JointTree, result: MoveTorques, g: readonly [number, number, number]) {
  return { profile: result.kind, duration: sig(result.duration), joints: Object.fromEntries(Object.entries(result.joints).map(([key, j]) => {
    const angle = turn(tree, key) ? 180 / Math.PI : 1, force = torqueScale(tree, key);
    return [key, { peak: sig(j.peak * force), rms: sig(j.rms * force), unit: turn(tree, key) ? 'N·mm' : 'N', at: sig(j.atPeak),
      distance: sig(j.distance * angle), peakVelocity: sig(j.vPeak * angle), peakAcceleration: sig(j.aPeak * angle), peakJerk: sig(j.jPeak * angle) }];
  })), sampling: result.sampling, gravity: sig(Math.hypot(...g) * 1000) };
}

/** SI result quantities as public quantities. Source catalogue {v, unit, src} entries are not passed here. */
export function reportQuantity(unit: string): { scale: number; unit: string } {
  if (unit === 'N·m' || unit === 'N·m over the line') return { scale: 1000, unit: unit.replace('N·m', 'N·mm') };
  if (unit === 'rpm') return { scale: 6, unit: 'degree/s' };
  if (unit === 'h') return { scale: 3600, unit: 's' };
  if (unit === 'rad' || unit === 'rad/s') return { scale: 180 / Math.PI, unit: unit.replace('rad', 'degree') };
  return { scale: 1, unit };
}

export function sizingJson(s: Sizing) {
  const n = (v: number) => Number.isFinite(v) ? sig(v) : null;
  return { profile: s.kind, moveDuration: sig(s.moveS), cycleDuration: sig(s.cycleS), model: SIZING_MODEL,
    joints: s.joints.map(j => ({ key: j.key, choice: j.choice ? { motor: j.choice.motor, reducer: j.choice.reducer, ratio: j.choice.ratio, mass: sig(j.choice.massKg * 1000) } : null,
      checks: j.checks.map(c => { const q = reportQuantity(c.unit); return { name: c.name, value: n(c.value * q.scale), limit: n(c.limit * q.scale), unit: q.unit, ok: c.ok, margin: n(c.margin), limit_source: c.limitSource }; }),
      candidates: j.candidates, feasible: j.feasible, rejected: j.rejected, ...sourcesJson(j.sources) })),
    skipped: s.skipped, sampling: s.sampling, pending_worked_examples: s.pending };
}

function sourcesJson(list: readonly { field: string; src: Source }[]) {
  const pages = new Map<string, { page: string; read: string; labels: Record<string, string> }>(), derived: Record<string, string> = {}, estimates: Record<string, string> = {};
  for (const { field, src } of list) {
    if ('page' in src) { const p = pages.get(src.page) ?? { page: src.page, read: src.read, labels: {} }; p.labels[field] = src.label; pages.set(src.page, p); }
    else if ('derived' in src) derived[field] = src.derived; else estimates[field] = src.estimate;
  }
  return { sources: [...pages.values()], derived, estimates };
}

// The mould's view (G6): the parting line's loops and the two halves, as the moulding report's tooling builds them —
// IM5's parting line, IM7b's straddling faces split along their isoclines, IM3's undercuts, IM7's plan and IM7a's halves.
// Run in the engine worker (the halves are Booleans of the block less the part); what it cannot build is said.
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { Vec3 } from '@barocss/cad-model/engine/mesh';
import { partingLine } from '@barocss/cad-model/mould/parting';
import { mouldHalves, splitStraddles, toolingPlan } from '@barocss/cad-model/mould/tooling';
import { undercuts } from '@barocss/cad-model/mould/undercut';

export interface MouldLoop { points: Vec3[]; closed: boolean; flat: boolean }
export interface MouldView {
  pull: Vec3;
  loops: MouldLoop[];
  /** The halves: + (along the pull) and − (against it), or null with why. */
  halves: { plus: BodyResult[]; minus: BodyResult[] } | null;
  why: string | null;
}

const unit = (v: readonly number[]): Vec3 => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };

/** The mould's view of the part's bodies (its document's pull and sides); null without a pull. `halves`: build them too. */
export function mouldView(doc: StudioDoc, bodies: readonly BodyResult[], halves: boolean): MouldView | null {
  const p = doc.mould?.pull;
  if (!p || !bodies.length) return null;
  const pull = unit(p), sides = doc.mould?.sides ?? {};
  const parting = partingLine(doc, bodies, pull, sides), loops = parting.loops.map(l => ({ points: l.points, closed: l.closed, flat: l.flat }));
  if (!halves) return { pull, loops, halves: null, why: null };
  const sp = splitStraddles(doc, bodies, pull, sides);
  if (!sp.ok) return { pull, loops, halves: null, why: `[${sp.code}] ${sp.message}` };
  const plan = toolingPlan(sp.bodies, pull, sp.parting, undercuts(sp.bodies, pull).regions, undefined, sp.resolved);
  if (!plan.ok) return { pull, loops: sp.parting.loops.map(l => ({ points: l.points, closed: l.closed, flat: l.flat })), halves: null, why: `[${plan.code}] ${plan.message}` };
  const h = mouldHalves(sp.doc, sp.bodies, plan.plan);
  const after = sp.parting.loops.map(l => ({ points: l.points, closed: l.closed, flat: l.flat }));
  return h.ok ? { pull, loops: after, halves: { plus: h.plus, minus: h.minus }, why: null } : { pull, loops: after, halves: null, why: `[${h.code}] ${h.message}` };
}

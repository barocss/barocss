// RB9 rung 11 (O70, O73): a print-in-place toy — a ring captive on a flanged axle, printed assembled on FDM. The checker:
// two solids not meeting; every facing gap (the bore round the axle, the flange below, the flange above, from the B-rep's
// exact cylinders and planes) within [fitGap, 2·fitGap] of the process profile; the printing rules with no failure; and
// the ring captive — no straight slide along ±X, ±Y or ±Z gets it out (captive.ts, on RM6's certified sweep).
import { dispatchTool, type ChatState } from '../chat/tools';
import { processProfile } from '../library/materials';
import type { BodyResult } from '../engine/evaluate';
import { captivity } from './captive';
import type { Call, Outcome, Params, Rung } from './core';
import { cylindersOf, holds } from './measure';

const num = (p: Params, k: string) => p[k] as number;
const cmd = (command: string, values: Record<string, unknown>, sel: Record<string, unknown> = {}): Call => ({ tool: 'run_command', args: { command, values, ...sel } });
const FIT = processProfile('fdm')!.thresholds.fitGap.value;
const toy = (p: Params, o: { g?: number; top?: boolean; extra?: boolean; w?: number } = {}): Call[] => {
  const ra = num(p, 'ra'), g = o.g ?? num(p, 'g'), hr = num(p, 'hr'), tf = num(p, 'tf'), rf = ra + num(p, 'g') + num(p, 'e'), ri = ra + g, ro = ri + (o.w ?? num(p, 'w'));
  const c: Call[] = [{ tool: 'set_brief', args: { fields: { purpose: { value: 'a print-in-place toy: a ring captive on an axle', basis: 'stated', source: 'print-in-place toy' }, process: { value: 'fdm', basis: 'stated', source: 'printed in PLA' }, material: { value: 'pla', basis: 'stated', source: 'printed in PLA' } } } },
    cmd('cylinder', { r: rf, h: tf, x: 0, y: 0, z: 0 }), cmd('cylinder', { r: ra, h: hr + 2 * g, x: 0, y: 0, z: tf }), cmd('union', {}, { bodies: ['b1', 'b3'] })];
  if (o.top !== false) c.push(cmd('cylinder', { r: rf, h: tf, x: 0, y: 0, z: tf + hr + 2 * g }), cmd('union', {}, { bodies: ['b4', 'b6'] }));
  c.push(cmd('tube', { r: ro, ri, h: hr, x: 0, y: 0, z: tf + g }));
  if (o.extra) c.push(cmd('box', { w: 5, d: 5, h: 5, x: ro + 10, y: 0, z: 0 }));
  return c;
};
/** The gaps the ring faces: its bore round the axle, the flange below, the flange above (exact faces; null: none). */
function gapsOf(axle: BodyResult, ring: BodyResult): { bore: number | null; below: number | null; above: number | null } {
  const bore = Math.min(...cylindersOf([ring]).map(c => c.r)), shaft = cylindersOf([axle]).filter(c => c.r < bore + 1e-9).map(c => c.r);
  const planes = (b: BodyResult, nz: number) => b.mesh.faces.flatMap(f => f.exact?.kind === 'plane' && Math.abs(f.exact.n[2] - nz) <= 1e-9 ? [f.exact.o[2]] : []);
  const zb = Math.min(...planes(ring, -1)), zt = Math.max(...planes(ring, 1)), under = planes(axle, 1).filter(z => z <= zb + 1e-9), over = planes(axle, -1).filter(z => z >= zt - 1e-9);
  return { bore: shaft.length && Number.isFinite(bore) ? bore - Math.max(...shaft) : null, below: under.length ? zb - Math.max(...under) : null, above: over.length ? Math.min(...over) - zt : null };
}
export const RUNG11: Rung = {
  n: 11, id: 'print-in-place', title: 'print-in-place toy',
  space: [{ key: 'ra', lo: 3, hi: 8, step: 0.5 }, { key: 'g', lo: FIT, hi: 2 * FIT, step: 0.05 }, { key: 'hr', lo: 4, hi: 12, step: 1 }, { key: 'w', lo: 2, hi: 6, step: 0.5 },
    { key: 'tf', lo: 1.5, hi: 3, step: 0.5 }, { key: 'e', lo: 1.5, hi: 4, step: 0.5 }],
  prompt: p => `A print-in-place toy, printed in PLA on an FDM printer in one piece: a ring captive on an axle. The axle Ø${2 * num(p, 'ra')} mm stands on a flange ${p.tf} mm thick and ${p.e} mm wider than the ring's bore all round, with the same flange on top; the ring, ${p.hr} mm tall with ${p.w} mm walls, turns on the axle with ${p.g} mm clear in its bore and to each flange. It must not come off.`,
  scripted: p => toy(p),
  async check({ doc, bodies }, p, evaluate) {
    // (The ring: the solid that does not reach the bed.)
    const ordered = [...bodies].sort((a, b) => a.mesh.bounds.min[2] - b.mesh.bounds.min[2]), axle = ordered[0], ring = ordered[1];
    const two = bodies.length === 2;
    const s: ChatState = { doc, bodies: [...bodies] };
    const fit = JSON.parse((await dispatchTool(s, 'interference', {}, evaluate as never)).content) as { pairs?: { overlap_mm3?: number }[] };
    const print = JSON.parse((await dispatchTool(s, 'check_printability', {}, evaluate as never)).content) as { rules?: { rule?: string; id?: string; status: string }[] };
    const gaps = two ? gapsOf(axle, ring) : null, inRange = (v: number | null) => v !== null && v >= FIT - 1e-9 && v <= 2 * FIT + 1e-9;
    const escapes = two ? captivity([axle], [ring]) : [];
    return [
      holds('solids', two && !!fit.pairs && fit.pairs.every(x => x.overlap_mm3 === undefined), [bodies.length, fit.pairs], 'two solids, not meeting'),
      holds('gaps', !!gaps && inRange(gaps.bore) && inRange(gaps.below) && inRange(gaps.above), gaps, `every facing gap in [${FIT}, ${2 * FIT}] mm (the FDM fit gap)`),
      holds('print', !!print.rules?.length && print.rules.every(r => r.status !== 'fail'), print.rules?.filter(r => r.status === 'fail').map(r => r.id ?? r.rule), 'the FDM rules, none failing'),
      holds('captive', escapes.length === 6 && escapes.every(e => e.captive), escapes.map(e => [e.direction, e.captive, +e.travel.toFixed(4)]), 'the ring cannot slide out along ±X, ±Y or ±Z'),
    ] as Outcome[];
  },
  mutants: [
    { id: 'fused', target: 'gaps', why: 'gap 0: the ring on the axle', calls: p => toy(p, { g: 0 }) },
    { id: 'loose', target: 'gaps', why: 'gap 1.5 mm, past 2·fitGap', calls: p => toy(p, { g: 1.5 }) },
    { id: 'no-top', target: 'captive', why: 'the top flange left off: it slides off along +Z', calls: p => toy(p, { top: false }) },
    { id: 'extra', target: 'solids', why: 'a loose block beside it', calls: p => toy(p, { extra: true }) },
    { id: 'thin', target: 'print', why: 'the ring\'s wall 0.3 mm', calls: p => toy(p, { w: 0.3 }) },
  ],
};

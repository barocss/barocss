// CNC1 (O84): machining's process rule in the manufacturability report — the material's family (metal or plastic, the
// library's own field) choosing the wall limits and the general tolerance class, the thinnest wall against them
// (recommended: warned; feasible: failed), the part against the machine's envelope, every limit with its page. The
// later stages are said to come, not guessed: holes and threads (CNC2), tool radius and depth (CNC3), access and setups
// (CNC4), the drawing and PMI (CNC5), turning's own rules (CNC6).
import type { StudioDoc } from '../engine/doc';
import type { BodyResult } from '../engine/evaluate';
import { materialIdOf } from '../app/bodies';
import { materialData, type ProcessProfile } from '../library/materials';
import { wallsOf } from '../mould/walls';
import type { PrintabilityReport, PrintRule } from '../print/rules';

export type Family = 'metal' | 'plastic';
const r3 = (v: number) => Math.round(v * 1e3) / 1e3 + 0;
const LATER: readonly [string, string, string][] = [
  ['holes', 'holes and threads: depth over diameter, drill and tap sizes', 'CNC2'],
  ['corners', 'inside corners against the tool, pocket depth, small features', 'CNC3'],
  ['access', 'access from the machine\'s directions, setups', 'CNC4'],
  ['drawing', 'the drawing\'s minimum: views, callouts, datums, tolerance note, material, Ra', 'CNC5'],
];

/** The machining report for a milling or turning profile. */
export function machinability(doc: StudioDoc, bodies: readonly BodyResult[], profile: ProcessProfile): PrintabilityReport {
  const t = (k: string) => profile.thresholds[k], rules: PrintRule[] = [];
  // The material: one for the part, its family the library's (metal or polymer).
  const ids = [...new Set(bodies.map(b => materialIdOf(doc, b) ?? null))], id = ids.length === 1 ? ids[0] : null, m = id ? materialData(id) : undefined;
  const family: Family | null = m ? (m.family === 'metal' ? 'metal' : 'plastic') : null;
  rules.push(family ? { id: 'material', level: 'feasible', status: 'pass', message: `${m!.label}: a ${family}, machined to ${family === 'metal' ? 'metal' : 'plastic'} limits` }
    : { id: 'material', level: 'feasible', status: 'unknown', message: 'the material (its family sets the limits)', why: ids.length > 1 ? 'the bodies are of different materials' : 'the material is not set (set_material, or the brief\'s stated material): none is assumed' });
  // Walls: the thinnest (the inward ray, IM4's walls) against the family's feasible and recommended least.
  const walls = wallsOf(doc, bodies, 0.6), thin = walls.filter(w => w.thinnestMM !== null).sort((a, b) => a.thinnestMM! - b.thinnestMM!)[0];
  if (!thin) rules.push({ id: 'wall', level: 'feasible', status: 'unknown', message: 'the thinnest wall', why: 'no wall measured' });
  else if (!family) rules.push({ id: 'wall', level: 'feasible', status: 'unknown', message: `the thinnest wall, ${r3(thin.thinnestMM!)} mm`, why: 'its limits are a metal\'s or a plastic\'s: the material is not set' });
  else {
    const min = t(family === 'metal' ? 'wallMetalMin' : 'wallPlasticMin'), rec = t(family === 'metal' ? 'wallMetalRec' : 'wallPlasticRec'), w = thin.thinnestMM!;
    rules.push({ id: 'wall', level: w < min.value - 1e-9 ? 'feasible' : 'recommended', status: w < min.value - 1e-9 ? 'fail' : w < rec.value - 1e-9 ? 'warn' : 'pass',
      message: `the thinnest wall, ${r3(w)} mm, against a ${family}'s ${min.value} mm feasible and ${rec.value} mm recommended`, value: r3(w), limit: w < min.value - 1e-9 ? min.value : rec.value, unit: 'mm', source: min.source, entities: [thin.body] });
  }
  // Size: the part's sides, sorted, against the envelope (milling), or held for turning's axis (CNC6).
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const b of bodies) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], b.mesh.bounds.min[k]); hi[k] = Math.max(hi[k], b.mesh.bounds.max[k]); }
  const e = [0, 1, 2].map(k => hi[k] - lo[k]).sort((a, b) => b - a);
  if (profile.id === 'cnc-milling') {
    const lim = [t('maxPartLongMM').value, t('maxPartWideMM').value, t('maxPartDepthMM').value], fits = e.every((v, k) => v <= lim[k] + 1e-9);
    rules.push({ id: 'size', level: 'feasible', status: fits ? 'pass' : 'fail', message: `the part (${e.map(r3).join(' × ')} mm) within a typical mill's ${lim.join(' × ')} mm`, value: r3(Math.max(...e.map((v, k) => v / lim[k]))), limit: 1, unit: 'ratio', source: t('maxPartLongMM').source });
  } else rules.push({ id: 'size', level: 'feasible', status: 'unknown', message: 'the part within the lathe\'s diameter and length', why: 'its turning axis comes with turning\'s rules (CNC6)' });
  for (const [id, message, stage] of LATER) rules.push({ id, level: 'recommended', status: 'unknown', message, why: `${stage} is not built yet` });
  if (profile.id === 'cnc-turning') rules.push({ id: 'turning', level: 'feasible', status: 'unknown', message: 'axisymmetry, grooves, thread relief, length over diameter', why: 'CNC6 is not built yet' });
  const classes = profile.toleranceClasses;
  return { process: profile.id, direction: null, rules, machining: { family, material: id, tolerance: { mm: t('tolMM').value, feasibleMM: t('tolFeasibleMM').value, source: t('tolMM').page?.url ?? t('tolMM').source },
    toleranceClass: classes && family ? { name: classes[family], note: 'the class named; its values are the standard\'s, not copied here', source: classes.page.url } : null } };
}

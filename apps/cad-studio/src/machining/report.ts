// CNC1 (O84): machining's process rule in the manufacturability report — the material's family (metal or plastic, the
// library's own field) choosing the wall limits and the general tolerance class, the thinnest wall against them
// (recommended: warned; feasible: failed), the part against the machine's envelope, every limit with its page. The
// later stages are said to come, not guessed: tool radius and depth (CNC3), access and setups (CNC4), the drawing and
// PMI (CNC5), turning's own rules (CNC6). CNC2 (O85): holes and threads — each step's depth over its diameter from its
// reach, the drill table, a tapped hole's tap drill, size and length.
import type { StudioDoc } from '../engine/doc';
import type { BodyResult } from '../engine/evaluate';
import { materialIdOf } from '../app/bodies';
import { materialData, type ProcessProfile } from '../library/materials';
import { wallsOf } from '../mould/walls';
import { holesOf, nearestDrills, onDrillTable, tappedHoles, type Hole, type TappedHole } from './holes';
import type { PrintabilityReport, PrintRule } from '../print/rules';

export type Family = 'metal' | 'plastic';
const r3 = (v: number) => Math.round(v * 1e3) / 1e3 + 0;
const LATER: readonly [string, string, string][] = [
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
  let holes: Hole[] = [], tapped: TappedHole[] = [];
  if (profile.id === 'cnc-milling') ({ holes, tapped } = holeRules(doc, bodies, profile, rules));
  else rules.push({ id: 'holes', level: 'recommended', status: 'unknown', message: 'holes on and off the turning axis', why: 'turning\'s holes come with its rules (CNC6)' });
  for (const [id, message, stage] of LATER) rules.push({ id, level: 'recommended', status: 'unknown', message, why: `${stage} is not built yet` });
  if (profile.id === 'cnc-turning') rules.push({ id: 'turning', level: 'feasible', status: 'unknown', message: 'axisymmetry, grooves, thread relief, length over diameter', why: 'CNC6 is not built yet' });
  const classes = profile.toleranceClasses;
  return { process: profile.id, direction: null, rules, machining: { family, material: id, tolerance: { mm: t('tolMM').value, feasibleMM: t('tolFeasibleMM').value, source: t('tolMM').page?.url ?? t('tolMM').source },
    toleranceClass: classes && family ? { name: classes[family], note: 'the class named; its values are the standard\'s, not copied here', source: classes.page.url } : null, holes, tapped } };
}

const worst = (xs: readonly PrintRule['status'][]): PrintRule['status'] => xs.includes('fail') ? 'fail' : xs.includes('warn') ? 'warn' : xs.includes('unknown') ? 'unknown' : 'pass';
/** CNC2's three rules: hole depth (each step's reach over its diameter), hole size (the drilled step against the drill table and small features), threads. */
function holeRules(doc: StudioDoc, bodies: readonly BodyResult[], profile: ProcessProfile, rules: PrintRule[]): { holes: Hole[]; tapped: TappedHole[] } {
  const T = profile.thresholds, t = (k: string) => T[k].value, holes = holesOf(bodies), tapped = tappedHoles(doc, holes);
  // Depth: every step, its reach from the nearer open end over its diameter; a hole open at neither end is CNC4's.
  const depths = holes.flatMap(h => h.steps.map(s => ({ h, s, ratio: s.reachMM === null ? null : s.reachMM / s.diameterMM })));
  const deepest = depths.filter(x => x.ratio !== null).sort((x, y) => y.ratio! - x.ratio!)[0], closed = depths.filter(x => x.ratio === null);
  if (!depths.length) rules.push({ id: 'hole-depth', level: 'feasible', status: 'pass', message: 'no holes' });
  else {
    const st = (r: number): PrintRule['status'] => r > t('holeDepthMax') + 1e-9 ? 'fail' : r > t('holeDepthRec') + 1e-9 ? 'warn' : 'pass';
    const status = worst([...(deepest ? [st(deepest.ratio!)] : []), ...(closed.length ? ['unknown' as const] : [])]), r = deepest?.ratio ?? null;
    rules.push({ id: 'hole-depth', level: r !== null && r > t('holeDepthMax') + 1e-9 ? 'feasible' : 'recommended', status,
      message: `${holes.length} hole${holes.length === 1 ? '' : 's'}${deepest ? `; the deepest Ø${r3(deepest.s.diameterMM)} reaching ${r3(deepest.s.reachMM!)} mm from its open end, ${r3(r!)} × its diameter, against ${t('holeDepthRec')} × recommended and ${t('holeDepthMax')} × at most` : ''}${closed.length ? `; ${closed.length} open at neither end` : ''}`,
      ...(r !== null ? { value: r3(r), limit: r > t('holeDepthMax') + 1e-9 ? t('holeDepthMax') : t('holeDepthRec'), unit: 'ratio', source: (r > t('holeDepthMax') + 1e-9 ? T.holeDepthMax : T.holeDepthRec).page?.url ?? 'W-WEB' } : {}),
      entities: (deepest ? deepest.s.faces : closed[0].s.faces), ...(closed.length ? { why: 'a hole open at neither end is reached from no side: access comes with CNC4' } : {}) });
  }
  // Size: each hole's narrowest step — drilled — against the small-feature limits and the drill table; wider steps (counterbores) are milled.
  const sized = holes.map(h => {
    const d = h.steps[0].diameterMM, table = onDrillTable(d, t), status: PrintRule['status'] = d < t('featureMinMM') - 1e-9 ? 'fail' : d < t('featureRecMM') - 1e-9 || table === false ? 'warn' : 'pass';
    return { h, d, table, status };
  });
  if (!sized.length) rules.push({ id: 'hole-size', level: 'recommended', status: 'pass', message: 'no holes' });
  else {
    const status = worst(sized.map(x => x.status)), bad = sized.filter(x => x.status === status && status !== 'pass'), x = bad[0];
    const why = (y: (typeof sized)[number]) => y.d < t('featureMinMM') - 1e-9 ? `Ø${r3(y.d)} under the ${t('featureMinMM')} mm least feature` : y.d < t('featureRecMM') - 1e-9 ? `Ø${r3(y.d)} under the ${t('featureRecMM')} mm a standard tool cuts` : `Ø${r3(y.d)} not a standard drill size (${nearestDrills(y.d, t).join(' or ')})`;
    const milled = sized.filter(y => y.table === null && y.d > t('drillMaxMM')).length, cb = holes.filter(h => h.counterbore).length;
    rules.push({ id: 'hole-size', level: status === 'fail' ? 'feasible' : 'recommended', status,
      message: `${sized.length} drilled diameter${sized.length === 1 ? '' : 's'}${x ? `; ${why(x)}${bad.length > 1 ? `, and ${bad.length - 1} more` : ''}` : ', each a standard drill size'}${milled ? `; ${milled} above the ${t('drillMaxMM')} mm drill table, milled` : ''}${cb ? `; ${cb} counterbored` : ''}`,
      ...(x ? { value: r3(x.d), unit: 'mm', source: (x.d < t('featureRecMM') - 1e-9 ? T[x.d < t('featureMinMM') - 1e-9 ? 'featureMinMM' : 'featureRecMM'] : T.drillStepMM).page?.url ?? 'W-WEB', entities: x.h.steps[0].faces } : {}) });
  }
  // Threads: each tapped hole's bore against its tap drill (d − P), its size against M2 feasible and M6 recommended, its length against 3 × d.
  if (!tapped.length) rules.push({ id: 'thread', level: 'recommended', status: 'pass', message: 'no tapped holes' });
  else {
    const judged = tapped.map(x => {
      const off = x.boreMM === null ? 'none' : x.tapMM === null ? 'unknown' : Math.abs(x.boreMM - x.tapMM) > 1e-6 ? 'off' : 'ok';
      const status: PrintRule['status'] = off === 'off' || x.sizeMM < t('threadMinMM') - 1e-9 ? 'fail' : off === 'none' || off === 'unknown' ? 'unknown'
        : x.sizeMM < t('threadRecMM') - 1e-9 || (x.lengthMM !== null && x.lengthMM > t('threadLengthRatio') * x.sizeMM + 1e-9) ? 'warn' : 'pass';
      const why = off === 'off' ? `drilled Ø${r3(x.boreMM!)}, not its tap drill Ø${x.tapMM} (d − P)` : x.sizeMM < t('threadMinMM') - 1e-9 ? `under M${t('threadMinMM')}, the least feasible`
        : off === 'none' ? 'its bore is not in the part' : off === 'unknown' ? `M${x.sizeMM} is not in the fastener table (M3–M12): its tap drill unknown`
        : x.sizeMM < t('threadRecMM') - 1e-9 ? `under M${t('threadRecMM')}, the recommended` : x.lengthMM !== null && x.lengthMM > t('threadLengthRatio') * x.sizeMM + 1e-9 ? `${r3(x.lengthMM)} mm long, over ${t('threadLengthRatio')} × d (${r3(t('threadLengthRatio') * x.sizeMM)} mm): no stronger for it` : '';
      return { x, status, why };
    });
    const status = worst(judged.map(j => j.status)), j = judged.find(y => y.status === status && status !== 'pass');
    const key = !j ? 'threadRecMM' : j.why.startsWith('drilled') ? null : j.why.startsWith('under M' + t('threadMinMM')) ? 'threadMinMM' : j.why.startsWith('under') ? 'threadRecMM' : j.why.includes('× d') ? 'threadLengthRatio' : null;
    rules.push({ id: 'thread', level: status === 'fail' ? 'feasible' : 'recommended', status,
      message: `${tapped.length} tapped hole${tapped.length === 1 ? '' : 's'} (${[...new Set(tapped.map(x => x.thread))].join(', ')})${j ? `; ${j.x.thread} ${j.why}` : ', each on its tap drill'}`,
      ...(key ? { source: T[key].page?.url ?? 'W-WEB' } : j ? { source: 'FAST-TAP' } : {}), entities: (j ?? judged[0]).x.faces.length ? (j ?? judged[0]).x.faces : [(j ?? judged[0]).x.node],
      ...(status === 'unknown' && j ? { why: j.why } : {}) });
  }
  return { holes, tapped };
}

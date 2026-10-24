// CNC1 (O84): machining's process rule in the manufacturability report — the material's family (metal or plastic, the
// library's own field) choosing the wall limits and the general tolerance class, the thinnest wall against them
// (recommended: warned; feasible: failed), the part against the machine's envelope, every limit with its page. CNC2
// (O85): holes and threads — each step's depth over its diameter from its reach, the drill table, a tapped hole's tap
// drill, size and length. CNC3 (O86): inside corners against ⅓ of their depth, cavities' depth over width, small
// features, tall thin walls, text. CNC4 (O87): access from the six directions with the tool's side, and setups. CNC5
// (O88): the drawing a shop machines from (milling and turning alike). CNC7a (O101): the features recognised. CNC6 (O89): turning — the axis, what is turned
// and what is milled by live tools, the lathe's size, the outside profile's grooves and least diameter, holes by their
// axes, points.
import type { StudioDoc } from '../engine/doc';
import type { BodyResult } from '../engine/evaluate';
import { partMaterial } from '../app/bodies';
import { materialData, type ProcessProfile } from '../library/materials';
import { wallsOf } from '../mould/walls';
import { accessOf, type Access } from './access';
import { cavitiesOf, type Cavities } from './cavities';
import { drawingCheck, type DrawingCheck } from './drawing';
import { turningOf, type Turning } from './turning';
import { featuresOf, type Feature } from './features';
import { chooseStock, type StockResult } from './stock';
import { holesOf, nearestDrills, onDrillTable, tappedHoles, type Hole, type TappedHole } from './holes';
import type { PrintabilityReport, PrintRule } from '../print/rules';
import { madeBodies } from '../engine/elements';
import { r3 } from '../util/round';
import { boundsOf } from '../engine/bounds';

export type Family = 'metal' | 'plastic';

/** The machining report for a milling or turning profile. */
export function machinability(doc: StudioDoc, all: readonly BodyResult[], profile: ProcessProfile): PrintabilityReport {
  const bodies = madeBodies(doc.nodes, all); // (O160: a bought element is not machined.)
  const t = (k: string) => profile.thresholds[k], rules: PrintRule[] = [];
  // The material: one for the part, its family the library's (metal or polymer).
  const { id, mixed } = partMaterial(doc, bodies), m = id ? materialData(id) : undefined;
  const family: Family | null = m ? (m.family === 'metal' ? 'metal' : 'plastic') : null;
  rules.push(family ? { id: 'material', level: 'feasible', status: 'pass', message: `${m!.label}: a ${family}, machined to ${family === 'metal' ? 'metal' : 'plastic'} limits` }
    : { id: 'material', level: 'feasible', status: 'unknown', message: 'the material (its family sets the limits)', why: mixed ? 'the bodies are of different materials' : 'the material is not set (set_material, or the brief\'s stated material): none is assumed' });
  // Walls: the thinnest (the inward ray, IM4's walls) against the family's feasible and recommended least.
  const walls = wallsOf(doc, bodies, 0.6), thin = walls.filter(w => w.thinnest !== null).sort((a, b) => a.thinnest! - b.thinnest!)[0];
  if (!thin) rules.push({ id: 'wall', level: 'feasible', status: 'unknown', message: 'the thinnest wall', why: 'no wall measured' });
  else if (!family) rules.push({ id: 'wall', level: 'feasible', status: 'unknown', message: `the thinnest wall, ${r3(thin.thinnest!)} mm`, why: 'its limits are a metal\'s or a plastic\'s: the material is not set' });
  else {
    const min = t(family === 'metal' ? 'wallMetalMin' : 'wallPlasticMin'), rec = t(family === 'metal' ? 'wallMetalRec' : 'wallPlasticRec'), w = thin.thinnest!;
    rules.push({ id: 'wall', level: w < min.value - 1e-9 ? 'feasible' : 'recommended', status: w < min.value - 1e-9 ? 'fail' : w < rec.value - 1e-9 ? 'warn' : 'pass',
      message: `the thinnest wall, ${r3(w)} mm, against a ${family}'s ${min.value} mm feasible and ${rec.value} mm recommended`, value: r3(w), limit: w < min.value - 1e-9 ? min.value : rec.value, unit: 'mm', source: min.source, entities: [thin.body] });
  }
  // Size: the part's sides, sorted, against the envelope (milling); turning's along its axis (CNC6).
  const { min: lo, max: hi } = boundsOf(bodies);
  const e = [0, 1, 2].map(k => hi[k] - lo[k]).sort((a, b) => b - a);
  if (profile.id === 'cnc-milling') {
    const lim = [t('maxPartLongMM').value, t('maxPartWideMM').value, t('maxPartDepthMM').value], fits = e.every((v, k) => v <= lim[k] + 1e-9);
    rules.push({ id: 'size', level: 'feasible', status: fits ? 'pass' : 'fail', message: `the part (${e.map(r3).join(' × ')} mm) within a typical mill's ${lim.join(' × ')} mm`, value: r3(Math.max(...e.map((v, k) => v / lim[k]))), limit: 1, unit: 'ratio', source: t('maxPartLongMM').source });
  }
  let holes: Hole[] = [], tapped: TappedHole[] = [], cavities: Cavities | null = null, access: Access | null = null, turning: Turning | null = null;
  if (profile.id === 'cnc-milling') { ({ holes, tapped } = holeRules(doc, bodies, profile, rules)); cavities = cavityRules(doc, bodies, profile, rules, holes); access = accessRules(bodies, rules); }
  else { holes = holesOf(bodies); turning = turningRules(doc, bodies, profile, rules, holes, id); }
  const drawing = drawingRule(doc, bodies, rules);
  // (CNC7a, O101: the features recognised, for milling — a summary rule after the drawing's, and the list itself.)
  let features: Feature[] | null = null;
  if (profile.id === 'cnc-milling') {
    features = featuresOf(doc, bodies, holes);
    const by = (['pocket', 'slot', 'step', 'hole', 'boss'] as const).map(k => [k, features!.filter(f => f.kind === k).length] as const).filter(([, n]) => n);
    rules.push({ id: 'features', level: 'recommended', status: 'pass', message: by.length ? `${by.map(([k, n]) => `${n} ${k}${n === 1 ? '' : k === 'boss' ? 'es' : 's'}`).join(', ')} recognised, each with its setup` : 'no machined features recognised', value: features.length, unit: 'features' });
  }
  // (CNC7b, O102: the stock it is cut from — the shop's list, the user's; the allowance the user's or an estimate, said.)
  const stock: StockResult = chooseStock(doc, bodies, profile.id as 'cnc-milling' | 'cnc-turning', turning);
  if (stock.ok) { const c = stock.choice; rules.push({ id: 'stock', level: 'recommended', status: 'pass', message: `stock ${c.row.id}: ${c.row.kind === 'block' ? c.size.join(' × ') : `Ø${c.size[0]} × ${c.size[1]}`} mm (${c.row.source}), ${c.allowance.value} mm a face${c.allowance.basis === 'estimate' ? ' (an estimate: set yours)' : ''}`, value: c.row.kind === 'block' ? c.size.reduce((p, x) => p * x, 1) : c.size[0], unit: c.row.kind === 'block' ? 'mm³' : 'mm' }); }
  else rules.push({ id: 'stock', level: 'recommended', status: stock.code === 'STOCK_NONE_FITS' ? 'warn' : 'unknown', message: `${stock.code}: ${stock.message}`, ...(stock.code === 'STOCK_NONE_FITS' ? {} : { why: stock.message }) });
  const classes = profile.toleranceClasses;
  return { process: profile.id, direction: null, rules, machining: { family, material: id, tolerance: { value: t('tolMM').value, feasibleLimit: t('tolFeasibleMM').value, source: t('tolMM').page?.url ?? t('tolMM').source },
    toleranceClass: classes && family ? { name: classes[family], note: 'the class named; its values are the standard\'s, not copied here', source: classes.page.url } : null, holes, tapped, ...(cavities ? { cavities } : {}), ...(access ? { access } : {}), ...(turning ? { turning } : {}), drawing, ...(features ? { features } : {}), stock } };
}

const worst = (xs: readonly PrintRule['status'][]): PrintRule['status'] => xs.includes('fail') ? 'fail' : xs.includes('warn') ? 'warn' : xs.includes('unknown') ? 'unknown' : 'pass';
/** CNC2's three rules: hole depth (each step's reach over its diameter), hole size (the drilled step against the drill table and small features), threads. */
function holeRules(doc: StudioDoc, bodies: readonly BodyResult[], profile: ProcessProfile, rules: PrintRule[]): { holes: Hole[]; tapped: TappedHole[] } {
  const T = profile.thresholds, t = (k: string) => T[k].value, holes = holesOf(bodies), tapped = tappedHoles(doc, holes);
  // Depth: every step, its reach from the nearer open end over its diameter; a hole open at neither end is CNC4's.
  const depths = holes.flatMap(h => h.steps.map(s => ({ h, s, ratio: s.reach === null ? null : s.reach / s.diameter })));
  const deepest = depths.filter(x => x.ratio !== null).sort((x, y) => y.ratio! - x.ratio!)[0], closed = depths.filter(x => x.ratio === null);
  if (!depths.length) rules.push({ id: 'hole-depth', level: 'feasible', status: 'pass', message: 'no holes' });
  else {
    const st = (r: number): PrintRule['status'] => r > t('holeDepthMax') + 1e-9 ? 'fail' : r > t('holeDepthRec') + 1e-9 ? 'warn' : 'pass';
    const status = worst([...(deepest ? [st(deepest.ratio!)] : []), ...(closed.length ? ['unknown' as const] : [])]), r = deepest?.ratio ?? null;
    rules.push({ id: 'hole-depth', level: r !== null && r > t('holeDepthMax') + 1e-9 ? 'feasible' : 'recommended', status,
      message: `${holes.length} hole${holes.length === 1 ? '' : 's'}${deepest ? `; the deepest Ø${r3(deepest.s.diameter)} reaching ${r3(deepest.s.reach!)} mm from its open end, ${r3(r!)} × its diameter, against ${t('holeDepthRec')} × recommended and ${t('holeDepthMax')} × at most` : ''}${closed.length ? `; ${closed.length} open at neither end` : ''}`,
      ...(r !== null ? { value: r3(r), limit: r > t('holeDepthMax') + 1e-9 ? t('holeDepthMax') : t('holeDepthRec'), unit: 'ratio', source: (r > t('holeDepthMax') + 1e-9 ? T.holeDepthMax : T.holeDepthRec).page?.url ?? 'W-WEB' } : {}),
      entities: (deepest ? deepest.s.faces : closed[0].s.faces), ...(closed.length ? { why: 'a hole open at neither end, or a step behind a narrower one, is reached by no straight tool: see the access rule (CNC4)' } : {}) });
  }
  // Size: each hole's narrowest step — drilled — against the small-feature limits and the drill table; wider steps (counterbores) are milled.
  const sized = holes.map(h => {
    const d = h.steps[0].diameter, table = onDrillTable(d, t), status: PrintRule['status'] = d < t('featureMinMM') - 1e-9 ? 'fail' : d < t('featureRecMM') - 1e-9 || table === false ? 'warn' : 'pass';
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
      const off = x.bore === null ? 'none' : x.tapDiameter === null ? 'unknown' : Math.abs(x.bore - x.tapDiameter) > 1e-6 ? 'off' : 'ok';
      const status: PrintRule['status'] = off === 'off' || x.size < t('threadMinMM') - 1e-9 ? 'fail' : off === 'none' || off === 'unknown' ? 'unknown'
        : x.size < t('threadRecMM') - 1e-9 || (x.length !== null && x.length > t('threadLengthRatio') * x.size + 1e-9) ? 'warn' : 'pass';
      const why = off === 'off' ? `drilled Ø${r3(x.bore!)}, not its tap drill Ø${x.tapDiameter} (d − P)` : x.size < t('threadMinMM') - 1e-9 ? `under M${t('threadMinMM')}, the least feasible`
        : off === 'none' ? 'its bore is not in the part' : off === 'unknown' ? `M${x.size} has no row in your loaded fastener sizes: its tap drill unknown`
        : x.size < t('threadRecMM') - 1e-9 ? `under M${t('threadRecMM')}, the recommended` : x.length !== null && x.length > t('threadLengthRatio') * x.size + 1e-9 ? `${r3(x.length)} mm long, over ${t('threadLengthRatio')} × d (${r3(t('threadLengthRatio') * x.size)} mm): no stronger for it` : '';
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

/** CNC3's rules: corners (a tool's radius against ⅓ of the corner's depth), pocket (depth over width), feature (the narrowest cavity), tall (height over thickness), text. */
function cavityRules(doc: StudioDoc, bodies: readonly BodyResult[], profile: ProcessProfile, rules: PrintRule[], holes: readonly Hole[]): Cavities {
  const T = profile.thresholds, t = (k: string) => T[k].value, cv = cavitiesOf(doc, bodies, new Set(holes.flatMap(h => h.steps.flatMap(s => s.faces)))), src = (k: string) => T[k].page?.url ?? T[k].source;
  // Corners: each one a tool comes down, its radius over its depth against ⅓; sharp ones (radius 0) the same; closed or angled ones CNC4's.
  const reached = cv.corners.filter(c => c.reach), closed = cv.corners.filter(c => !c.reach), angled = cv.edges.filter(e => e.kind === 'angled'), k = t('insideRadiusDepthRatio');
  const worstCorner = [...reached].sort((a, b) => a.radius / a.depth - b.radius / b.depth)[0], small = reached.filter(c => c.radius < k * c.depth - 1e-9);
  const extra = [cv.edges.length - angled.length ? `${cv.edges.length - angled.length} sharp edge${cv.edges.length - angled.length === 1 ? '' : 's'} cut sharp (a face open to the tool's end)` : '', cv.edgeFillets ? `${cv.edgeFillets} edge fillet${cv.edgeFillets === 1 ? '' : 's'} (not along a tool's axis)` : '', closed.length ? `${closed.length} reached along no direction` : '', angled.length ? `${angled.length} angled` : ''].filter(Boolean).join('; ');
  if (!reached.length && !closed.length && !angled.length) rules.push({ id: 'corners', level: 'recommended', status: 'pass', message: `no inside corners along a tool's axis${extra ? `; ${extra}` : ''}` });
  else {
    const status = worst([small.length ? 'warn' : 'pass', ...(closed.length || angled.length ? ['unknown' as const] : [])]), c = small[0] ?? worstCorner;
    const what = c ? (c.kind === 'sharp' ? `a sharp inside corner ${r3(c.depth)} deep (a rotating tool leaves its radius: at least ${r3(k * c.depth)} mm wanted)` : `r ${r3(c.radius)} on a corner ${r3(c.depth)} deep, ${small.length ? 'under' : 'at least'} ⅓ of it (${r3(k * c.depth)})`) : '';
    rules.push({ id: 'corners', level: 'recommended', status, message: `${reached.length} inside corner${reached.length === 1 ? '' : 's'} along a tool's axis${what ? `; ${small.length ? `${small.length} under ⅓ of its depth, ` : 'the tightest '}${what}` : ''}${extra ? `; ${extra}` : ''}`,
      ...(c ? { value: r3(c.radius / c.depth), limit: r3(k), unit: 'ratio', source: src('insideRadiusDepthRatio'), entities: c.faces } : {}), ...(closed.length || angled.length ? { why: 'a corner reached along no straight direction, or between planes not square, takes a tool at an angle: see the access rule (CNC4)' } : {}) });
  }
  // Pocket: each cavity floor's depth over its narrowest width against 4.
  const deep = [...cv.floors].sort((a, b) => b.depth / b.width - a.depth / a.width)[0];
  if (!deep) rules.push({ id: 'pocket', level: 'recommended', status: 'pass', message: 'no cavities' });
  else {
    const r = deep.depth / deep.width, over = r > t('pocketDepthWidthRatio') + 1e-9;
    rules.push({ id: 'pocket', level: 'recommended', status: over ? 'warn' : 'pass', message: `${cv.floors.length} cavit${cv.floors.length === 1 ? 'y' : 'ies'} (floors); the deepest for its width ${r3(deep.depth)} deep, ${r3(deep.width)} wide: ${r3(r)} × against ${t('pocketDepthWidthRatio')} × recommended`, value: r3(r), limit: t('pocketDepthWidthRatio'), unit: 'ratio', source: src('pocketDepthWidthRatio'), entities: [deep.face] });
  }
  // Feature: the narrowest cavity floor against the small-feature limits.
  const narrow = [...cv.floors].sort((a, b) => a.width - b.width)[0];
  if (!narrow) rules.push({ id: 'feature', level: 'recommended', status: 'pass', message: 'no cavities' });
  else {
    const w = narrow.width, status: PrintRule['status'] = w < t('featureMinMM') - 1e-9 ? 'fail' : w < t('featureRecMM') - 1e-9 ? 'warn' : 'pass', key = w < t('featureMinMM') - 1e-9 ? 'featureMinMM' : 'featureRecMM';
    rules.push({ id: 'feature', level: status === 'fail' ? 'feasible' : 'recommended', status, message: `the narrowest cavity ${r3(w)} mm wide, against ${t('featureRecMM')} mm recommended and ${t('featureMinMM')} mm feasible`, value: r3(w), limit: t(key), unit: 'mm', source: src(key), entities: [narrow.face] });
  }
  // Tall: each thin standing wall's height over its thickness against 4.
  const measured = cv.tall.filter(x => x.height !== null), tallest = [...measured].sort((a, b) => b.height! / b.thickness - a.height! / a.thickness)[0], unmeasured = cv.tall.length - measured.length;
  if (!cv.tall.length) rules.push({ id: 'tall', level: 'recommended', status: 'pass', message: 'no thin standing walls' });
  else {
    const r = tallest ? tallest.height! / tallest.thickness : null, over = r !== null && r > t('tallFeatureRatio') - 1e-9;
    rules.push({ id: 'tall', level: 'recommended', status: worst([over ? 'warn' : 'pass', ...(unmeasured ? ['unknown' as const] : [])]),
      message: `${cv.tall.length} thin standing wall${cv.tall.length === 1 ? '' : 's'}${tallest ? `; the tallest for its thickness ${r3(tallest.height!)} high, ${r3(tallest.thickness)} thick: ${r3(r!)} × against under ${t('tallFeatureRatio')} ×` : ''}${unmeasured ? `; ${unmeasured} with no root edge to measure from` : ''}`,
      ...(r !== null ? { value: r3(r), limit: t('tallFeatureRatio'), unit: 'ratio', source: src('tallFeatureRatio'), entities: tallest!.faces } : {}), ...(unmeasured ? { why: 'a wall with no straight concave root edge has no height measured' } : {}) });
  }
  // Text: the studio makes no text feature; an imported body's engraving is not read.
  const imported = doc.nodes.some(n => n.kind === 'import' || n.kind === 'mesh');
  rules.push(imported ? { id: 'text', level: 'recommended', status: 'unknown', message: 'engraved or embossed text', why: `imported geometry: text in it is not read (against ${t('textWidthPlasticMM')} / ${t('textWidthMetalMM')} mm stroke, ${t('textDepthMM')} mm deep)` }
    : { id: 'text', level: 'recommended', status: 'pass', message: 'no text: the studio makes no text feature' });
  return cv;
}

/** CNC4's rules: access (area no axis direction reaches, warned: no sourced feasible limit) and setups (counted, greedy). */
function accessRules(bodies: readonly BodyResult[], rules: PrintRule[]): Access {
  const a = accessOf(bodies), faces = a.unreached.slice(0, 4).map(u => u.face);
  rules.push(a.unreachedArea > 0 ? { id: 'access', level: 'recommended', status: 'warn', message: `${r3(a.unreachedArea)} mm² reached from none of ±X, ±Y, ±Z (${faces.join(', ')}${a.unreached.length > 4 ? ' …' : ''}): an undercut for a 3-axis mill — a 5-axis setup, an undercut cutter or a change`, value: r3(a.unreachedArea), unit: 'mm²', entities: faces }
    : { id: 'access', level: 'recommended', status: 'pass', message: 'every surface reached from one of ±X, ±Y, ±Z (the tool from its side)' });
  rules.push({ id: 'setups', level: 'recommended', status: 'pass', message: `${a.setups.length} setup${a.setups.length === 1 ? '' : 's'} (${a.setups.map(x => x.direction).join(', ')}), counted greedily by the area each adds`, value: a.setups.length, unit: 'setups' });
  return a;
}

/** CNC5's rule: the drawing — needed or not, and on it each item a shop needs (the worst of them; each item in `machining.drawing`). */
function drawingRule(doc: StudioDoc, bodies: readonly BodyResult[], rules: PrintRule[]): DrawingCheck {
  const d = drawingCheck(doc, bodies), status = worst(d.items.map(x => x.status)), bad = d.items.filter(x => x.status === status && status !== 'pass');
  rules.push({ id: 'drawing', level: status === 'fail' ? 'feasible' : 'recommended', status,
    message: d.present ? `the drawing: ${d.items.filter(x => x.status === 'pass').length} of ${d.items.length} items in order${bad.length ? `; ${bad.map(x => `${x.id}: ${x.message}`).join('; ')}` : ''}` : d.items[0].message,
    source: (bad[0] ?? d.items[0]).source, ...(status === 'unknown' ? { why: bad[0].message } : {}) });
  return d;
}

/** Aluminium and brass: the metals Protolabs' turning page allows more in (radial holes, grooves, holes at an angle). */
const SOFT = new Set(['al6061', 'brass']);
/** CNC6's rules for a turned part: size (Hubs' lathe; Protolabs' least part), turning (axisymmetry), diameter, groove, holes, point, corners. Protolabs' values are one service's: warned, not failed. */
function turningRules(doc: StudioDoc, bodies: readonly BodyResult[], profile: ProcessProfile, rules: PrintRule[], holes: readonly Hole[], material: string | null): Turning {
  const T = profile.thresholds, t = (k: string) => T[k].value, src = (k: string) => T[k].page?.url ?? T[k].source, tu = turningOf(doc, bodies, holes), soft = !!material && SOFT.has(material);
  if (!tu.axis) {
    rules.push({ id: 'size', level: 'feasible', status: 'unknown', message: 'the part within the lathe\'s diameter and length', why: 'no turning axis' },
      { id: 'turning', level: 'feasible', status: 'fail', message: 'no axis of revolution (no exact cylinder): a lathe makes parts with rotational symmetry', source: src('maxDiameterMM') });
    return tu;
  }
  const D = tu.diameter, L = tu.length, over = D > t('maxDiameterMM') + 1e-9 || L > t('maxLengthMM') + 1e-9, small = D < t('minPartDiameterMM') - 1e-9 || L < t('minPartLengthMM') - 1e-9;
  rules.push({ id: 'size', level: over ? 'feasible' : 'recommended', status: over ? 'fail' : small ? 'warn' : 'pass', message: `Ø${r3(D)} × ${r3(L)} mm along its axis, against a lathe's Ø${t('maxDiameterMM')} × ${t('maxLengthMM')}${small ? ` — under the least part, Ø${t('minPartDiameterMM')} × ${t('minPartLengthMM')}` : ''}`, value: r3(Math.max(D / t('maxDiameterMM'), L / t('maxLengthMM'))), limit: 1, unit: 'ratio', source: src(small && !over ? 'minPartDiameterMM' : 'maxDiameterMM') });
  const offA = tu.area - tu.turnedArea, offFaces = tu.offAxis.slice(0, 4).map(x => x.face);
  rules.push(tu.offAxis.length ? { id: 'turning', level: 'recommended', status: 'warn', message: `${r3(offA)} mm² not turned (${offFaces.join(', ')}${tu.offAxis.length > 4 ? ' …' : ''}): milled by live tools on a mill-turn (flats, slots and grooves), or a second setup`, value: r3(offA / tu.area), unit: 'share', source: src('holeMinRadialMM'), entities: offFaces }
    : { id: 'turning', level: 'feasible', status: 'pass', message: `every surface turned about the axis (its exact normals meet it), L/D ${r3(L / D)}` });
  const dmin = tu.minOuterDiameter;
  rules.push(dmin === null ? { id: 'diameter', level: 'recommended', status: 'unknown', message: 'the least outside diameter', why: 'no outside cylinder on the axis' }
    : { id: 'diameter', level: 'recommended', status: dmin < t('minDiameterMM') - 1e-9 ? 'warn' : 'pass', message: `the least outside diameter Ø${r3(dmin)}, against Ø${t('minDiameterMM')} in any region`, value: r3(dmin), limit: t('minDiameterMM'), unit: 'mm', source: src('minDiameterMM') });
  const wMin = t(soft ? 'grooveWidthMinSoftMM' : 'grooveWidthMinMM'), narrow = tu.grooves.filter(g => g.width < wMin - 1e-9), deep = tu.grooves.filter(g => g.depth > t('grooveDepthMaxMM') + 1e-9);
  const gBad = [...narrow.map(g => `${r3(g.width)} mm wide (under ${wMin}${soft ? ', aluminium and brass' : ''})`), ...deep.map(g => `${r3(g.depth)} deep (over ${t('grooveDepthMaxMM')})`), ...(tu.idGrooves ? [`${tu.idGrooves} inside (ID grooves not supported)`] : [])];
  rules.push({ id: 'groove', level: 'recommended', status: gBad.length ? 'warn' : 'pass', message: tu.grooves.length || tu.idGrooves ? `${tu.grooves.length} outside groove${tu.grooves.length === 1 ? '' : 's'}${gBad.length ? `; ${gBad.join('; ')}` : ', each within width and depth'}` : 'no grooves',
    ...(narrow[0] || deep[0] ? { entities: (narrow[0] ?? deep[0]).faces } : {}), source: src(deep.length && !narrow.length ? 'grooveDepthMaxMM' : soft ? 'grooveWidthMinSoftMM' : 'grooveWidthMinMM') });
  const rMin = t(soft ? 'holeMinRadialSoftMM' : 'holeMinRadialMM'), hBad = tu.holes.flatMap(h => (h.kind === 'on-axis' || h.kind === 'axial') && h.diameter < t('holeMinAxialMM') - 1e-9 ? [`an ${h.kind} hole Ø${r3(h.diameter)} (under ${t('holeMinAxialMM')})`]
    : h.kind === 'radial' && h.diameter < rMin - 1e-9 ? [`a radial hole Ø${r3(h.diameter)} (under ${rMin}${soft ? ', aluminium and brass' : ''})`] : h.kind === 'angled' && !soft ? [`a hole at an angle to the axis (in ${material ?? 'an unset material'}: only aluminium and brass)`] : []);
  const kinds = ['on-axis', 'axial', 'radial', 'angled'].map(k => [k, tu.holes.filter(h => h.kind === k).length] as const).filter(([, n]) => n);
  rules.push({ id: 'holes', level: 'recommended', status: hBad.length ? 'warn' : 'pass', message: tu.holes.length ? `${kinds.map(([k, n]) => `${n} ${k}`).join(', ')}${hBad.length ? `; ${hBad.join('; ')}` : ''}${tu.holes.some(h => h.kind !== 'on-axis') ? '; off the axis: live tools' : ''}` : 'no holes', source: src('holeMinRadialMM') });
  const sharp = tu.points.filter(p => p.includedAngle < t('pointAngleMinDeg') - 1e-9);
  rules.push({ id: 'point', level: 'recommended', status: sharp.length ? 'warn' : 'pass', message: tu.points.length ? `${tu.points.length} point${tu.points.length === 1 ? '' : 's'}; ${sharp.length ? `${r3(sharp[0].includedAngle)}° included, under ${t('pointAngleMinDeg')}°` : `the sharpest ${r3(Math.min(...tu.points.map(p => p.includedAngle)))}°`}` : 'no points', source: src('pointAngleMinDeg'), ...(sharp.length ? { entities: [sharp[0].face] } : {}) });
  rules.push({ id: 'corners', level: 'recommended', status: 'pass', message: 'turned: sharp inside corners come out radiused, outside corners typically chamfered', source: src('minDiameterMM') });
  return tu;
}

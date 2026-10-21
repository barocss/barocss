// R12c on drawings, S2 (O144; the S0 O142): three table sources from the bodies' machine-element data (engine/elements.ts) —
//   - 'elements': each machine element — its kind, our size text, the user's row and its source, bought or made (and
//     whether the person decided it), its mass; each estimate said under the table;
//   - 'springs': what a spring's drawing carries, one row a spring — its type, wire, mean and outer diameter, active
//     and total coils, free (or body) length, pitch, solid height, ends or hooks, hand, rate — and each modulus's basis;
//   - 'glands': each O-ring gland — its kind, its ring (the user's row) by inside diameter and section, the groove's
//     diameter, width and depth, the stretch, the squeeze (free and stretched) and the fill (of the stretched section,
//     as it is judged), and the ranges they are judged by, with their source.
// Every value is the model's (the user's rows, the kernel's report); the column titles are our own words, no standard's.
import type { StudioDoc } from '../engine/doc';
import { evaluatePart, type BodyResult } from '../engine/evaluate';
import { elementLines, type BodyElement } from '../engine/elements';
import type { TableContent } from './table';

type Ctx = { doc: StudioDoc; bodies?: readonly BodyResult[] };
const bodiesOf = (ctx: Ctx) => { if (ctx.bodies) return ctx.bodies; const e = evaluatePart(ctx.doc, 0); return e.ok ? e.bodies : []; };
const itemOf = (doc: StudioDoc, b: BodyResult) => (b.ref ? doc.nodes[b.ref.node]?.id : undefined) ?? b.key;
type Of<K extends BodyElement['kind']> = Extract<BodyElement, { kind: K }>;
const ofKind = <K extends BodyElement['kind']>(bodies: readonly BodyResult[], kind: K) => bodies.filter((b): b is BodyResult & { element: Of<K> } => b.element?.kind === kind);

/** The 'elements' source: the part's machine elements (and what the person marked bought). */
export function elementsSource(ctx: Ctx): TableContent | { error: string } {
  const lines = elementLines(ctx.doc, bodiesOf(ctx));
  if (!lines.length) return { error: 'no machine elements (springs, shafts, keys, keyways, rings, pins, bearings, O-ring glands)' };
  return {
    title: 'MACHINE ELEMENTS',
    columns: [{ key: 'item', label: 'ITEM' }, { key: 'kind', label: 'KIND' }, { key: 'size', label: 'SIZE', unit: 'mm' }, { key: 'row', label: 'ROW' }, { key: 'source', label: 'SOURCE' },
      { key: 'bought', label: 'BOUGHT' }, { key: 'est', label: 'EST.' }, { key: 'mass', label: 'MASS', unit: 'g', digits: 1 }],
    rows: lines.map(l => [l.item, l.kind, l.size, l.row?.id ?? null, [l.row ? (l.row.source ?? (l.row.estimate ? 'estimate' : '')) : '', l.catalogue ?? ''].filter(Boolean).join(' · ') || null, `${l.bought ? 'bought' : 'made'}${l.boughtBy === 'override' ? ' (set)' : ''}`, l.estimate ? 'est.' : '', l.massG]),
    notes: [...lines.filter(l => l.estimate).map(l => `${l.item}: ${l.why.join('; ')}`), 'Sizes and rows are yours (none built in); bought or made by kind unless set; not validated for manufacturing'],
  };
}

/** The 'springs' source: one row a spring, its drawing's data. */
export function springsSource(ctx: Ctx): TableContent | { error: string } {
  const springs = ofKind(bodiesOf(ctx), 'spring');
  if (!springs.length) return { error: 'no springs (make one with the Spring command)' };
  const notes: string[] = [];
  const rows = springs.map(b => {
    const r = b.element.report, d = r.dimensions, item = itemOf(ctx.doc, b), compression = r.type === 'compression';
    const G = d.shearModulusMPa, E = 'youngsModulusMPa' in d ? d.youngsModulusMPa : undefined;
    if (G !== undefined) notes.push(`${item}: G ${+G.toFixed(0)} MPa${d.shearModulusEstimate ? ', an estimate' : ''}`);
    if (E !== undefined) notes.push(`${item}: E ${+E.toFixed(0)} MPa${'youngsModulusEstimate' in d && d.youngsModulusEstimate ? ', an estimate' : ''}`);
    if ('torsionalRateNmmPerDeg' in d && d.torsionalRateNmmPerDeg !== undefined) notes.push(`${item}: torsional rate ${+d.torsionalRateNmmPerDeg.toPrecision(4)} N·mm/°`);
    return [item, r.type, d.wireDiameterMM, d.meanDiameterMM, d.outerDiameterMM, d.activeCoils, 'totalCoils' in d ? d.totalCoils : null, 'freeLengthMM' in d ? d.freeLengthMM : d.bodyLengthMM, d.pitchMM,
      'solidHeightMM' in d ? d.solidHeightMM : null, compression ? r.ends : r.hooks ?? null, r.hand, d.rateNPerMM ?? null];
  });
  return {
    title: 'SPRING DATA',
    columns: [{ key: 'item', label: 'ITEM' }, { key: 'type', label: 'TYPE' }, { key: 'wire', label: 'WIRE Ø', unit: 'mm', digits: 2 }, { key: 'mean', label: 'MEAN Ø', unit: 'mm', digits: 2 }, { key: 'outer', label: 'OUTER Ø', unit: 'mm', digits: 2 },
      { key: 'active', label: 'ACTIVE COILS', digits: 2 }, { key: 'total', label: 'TOTAL COILS', digits: 2 }, { key: 'length', label: 'FREE / BODY LENGTH', unit: 'mm', digits: 2 }, { key: 'pitch', label: 'PITCH', unit: 'mm', digits: 3 },
      { key: 'solid', label: 'SOLID HEIGHT', unit: 'mm', digits: 2 }, { key: 'ends', label: 'ENDS / HOOKS' }, { key: 'hand', label: 'HAND' }, { key: 'rate', label: 'RATE', unit: 'N/mm', digits: 3 }],
    rows,
    notes: [...notes, 'A rate with no G given: —. Values are the model\'s (yours); not validated for manufacturing'],
  };
}

/** The 'glands' source: one row an O-ring gland. */
export function glandsSource(ctx: Ctx): TableContent | { error: string } {
  const glands = ofKind(bodiesOf(ctx), 'oring-gland');
  if (!glands.length) return { error: 'no O-ring glands (make one with the O-ring gland command)' };
  const notes = new Set<string>();
  const rows = glands.map(b => {
    const g = b.element.report, item = itemOf(ctx.doc, b);
    if (g.ringEstimate) notes.add(`${item}: its ring row ${g.ring} is an estimate`);
    const r = g.ranges;
    notes.add(`Judged by: squeeze ${r.squeezePercent[0]}–${r.squeezePercent[1]} %, fill ${r.fillPercent[0]}–${r.fillPercent[1]} %, stretch up to ${r.stretchMaxPercent} %${r.source ? ` — ${r.source}` : ''}${r.estimate ? ' (an estimate)' : ''}`);
    for (const w of g.warnings) notes.add(`${item}: ${w.message}`);
    return [item, g.kind, g.ring, g.insideDiameterMM, g.crossSectionMM, g.grooveDiameterMM, g.widthMM, g.depthMM, g.stretchPercent, g.squeezePercent, g.squeezeStretchedPercent, g.fillStretchedPercent];
  });
  return {
    title: 'O-RING GLANDS',
    columns: [{ key: 'item', label: 'ITEM' }, { key: 'kind', label: 'KIND' }, { key: 'ring', label: 'RING' }, { key: 'id', label: 'RING ID', unit: 'mm', digits: 2 }, { key: 'cs', label: 'SECTION', unit: 'mm', digits: 2 },
      { key: 'groove', label: 'GROOVE Ø', unit: 'mm', digits: 3 }, { key: 'width', label: 'WIDTH', unit: 'mm', digits: 3 }, { key: 'depth', label: 'DEPTH', unit: 'mm', digits: 3 },
      { key: 'stretch', label: 'STRETCH', unit: '%', digits: 1 }, { key: 'squeeze', label: 'SQUEEZE', unit: '%', digits: 1 }, { key: 'squeezeStretched', label: 'SQUEEZE STRETCHED', unit: '%', digits: 1 }, { key: 'fill', label: 'FILL STRETCHED', unit: '%', digits: 1 }],
    rows,
    notes: [...notes, 'Rows and ranges are yours (none built in)'],
  };
}

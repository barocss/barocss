// A part's cut list (FR4a, D127): every frame member's body as a piece, in its own material (its look's, else the part's),
// grouped by the kernel. The studio's densities are the materials library's — every one an estimate (D67) — so the list
// says so.
import { cutList, type CutList } from '@barocss/cad';
import type { StudioDoc } from '../engine/doc';
import { evaluatePart, type BodyResult } from '../engine/evaluate';
import type { TableContent } from '../drawing/table';
import { bodyName, materialIdOf } from './bodies';
import { MATERIALS } from '../library/materials';

export interface PartCutList extends CutList {
  /** Each piece's body key and its name, as the rows list them. */
  readonly names: Readonly<Record<string, string>>;
  /** The materials' densities are estimates (the library's, not the user's stock). */
  readonly densityEstimate: true;
}

/** The cut list of the part's frame members, or null when it has none. `fallback`: the part's material id. */
export function partCutList(doc: StudioDoc, bodies: readonly BodyResult[], fallback?: string): PartCutList | null {
  const members = bodies.filter(b => b.cutPiece);
  if (!members.length) return null;
  const base = MATERIALS.find(m => m.id === fallback) ?? MATERIALS[0], names: Record<string, string> = {};
  const pieces = members.map(b => {
    const mat = MATERIALS.find(m => m.id === materialIdOf(doc, b)) ?? base;
    names[b.key] = bodyName(doc, b);
    return { ...b.cutPiece!, id: b.key, material: mat.label, density: mat.density };
  });
  return { ...cutList(pieces, { density: base.density, material: base.label }), names, densityEstimate: true };
}

/** An end's cut as a table cell: square, `MITRE 45`, `MITRE 30 / BEVEL 10`, or what finishes it (`COPE`, `TRIM`). */
function endCell(e: CutList['rows'][number]['ends'][number]): string {
  if (e.kind === 'square' || e.kind === 'through') return 'SQUARE';
  if (e.mitre === null) return e.kind.toUpperCase();
  const r = (x: number) => String(Math.round(x * 10) / 10);
  return `${e.kind.toUpperCase()} ${r(e.mitre)}${e.bevel ? ` / BEVEL ${r(e.bevel!)}` : ''}`;
}
/**
 * A cut list as a drawing table's content (FR4b, D128; the outer lane's O49 table): a row a group — item, quantity,
 * section, material, axis length, long point, each end's cut, mass each — and notes: the totals, a length by volume
 * marked, the densities' being estimates.
 */
export function cutListTable(list: PartCutList): TableContent {
  const rows: TableContent['rows'] = list.rows.map(r => [r.item, r.quantity, `${r.section}${r.mirrored ? ' (mirrored)' : ''}`, r.material ?? list.material ?? null, r.axisLength, r.longPoint, endCell(r.ends[0]), endCell(r.ends[1]), r.mass]);
  const byVolume = list.rows.filter(r => r.fromVolume).map(r => r.item);
  return {
    title: 'CUT LIST',
    columns: [{ key: 'item', label: 'ITEM' }, { key: 'qty', label: 'QTY' }, { key: 'section', label: 'SECTION' }, { key: 'material', label: 'MATERIAL' },
      { key: 'length', label: 'LENGTH', unit: 'mm', digits: 1 }, { key: 'long', label: 'LONG POINT', unit: 'mm', digits: 1 }, { key: 'start', label: 'START' }, { key: 'end', label: 'END' }, { key: 'mass', label: 'MASS EA', unit: 'g', digits: 3 }],
    rows,
    notes: [
      `${list.totals.quantity} pieces, ${+list.totals.axisLength.toFixed(1)} mm, ${+list.totals.mass.toFixed(3)} g`,
      ...(byVolume.length ? [`Items ${byVolume.join(', ')}: length by volume (an end coped or trimmed to a member)`] : []),
      'Masses by the materials library’s densities: estimates',
    ],
  };
}
/** The drawing tables' 'cut-list' source: the part's frame members (evaluated when the bodies are not given). */
export function cutListSource(ctx: { doc: StudioDoc; bodies?: readonly BodyResult[] }): TableContent | { error: string } {
  const e = ctx.bodies ? null : evaluatePart(ctx.doc, 0), bodies = ctx.bodies ?? (e?.ok ? e.bodies : []);
  const list = partCutList(ctx.doc, bodies);
  return list ? cutListTable(list) : { error: 'no frame members (make a frame or a structural member)' };
}

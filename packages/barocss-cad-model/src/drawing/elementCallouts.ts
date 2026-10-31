// R12c on drawings, S3 (O145; the S0 O142): the machine elements on their dimensions. A diameter dimension on a bearing's
// seat (its shaft's step at the bearing's bore) or on its housing's bore (at the bearing's outside diameter) names the
// bearing — its designation or the user's row, with the row's source or "(est.)"; one on a ring groove's bottom adds the
// groove's width and the ring's row ("Ø19 × 1.3 · ring r20 (the maker's sheet)"). The text goes after the dimension's
// own (a hole's callout, D155's fit), as D155 puts its fit. The values are the kernel's reports and the user's rows.
import { partElements as evaluatedElements } from '../engine/evaluate';
import type { ModelNode, StudioDoc } from '../engine/doc';
import { sizeOf, type BodyElement, type ElementRow } from '../engine/elements';
import { inView } from './dimensions';
import { toSheet, type SheetLayout } from './views';
import type { LengthFormat } from './standard';
import type { DrawingNote, DrawingSettings, DrawingViews, ViewId, XY } from './types';
/** An element and its node (the evaluated bodies', or `partElements`'). */
export interface PartElement { node: number; id: string; element: BodyElement }
/** The bodies' elements (the studio's: evaluated off the main thread already). */
export const elementsOfBodies = (nodes: readonly ModelNode[], bodies: readonly { ref?: { node: number }; element?: BodyElement }[]): PartElement[] => bodies.flatMap(b => b.element && b.ref && nodes[b.ref.node]?.id ? [{ node: b.ref.node, id: nodes[b.ref.node].id!, element: b.element }] : []);

const plain: LengthFormat = (x, places = 3) => `${+x.toFixed(places)}`;
const near = (a: number, b: number) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b));
const cited = (row: ElementRow | undefined) => row ? (row.source ? ` (${row.source})` : row.estimate ? ' (est.)' : '') : ' (est.)';
/** A face's name as the studio shows it: no piece number (`#1`). */
const faceOf = (name: string) => name.replace(/#\d+$/, '');
interface Rule { test: (face: string) => boolean; diameter: number; text: (f: LengthFormat) => string }

/** The part's elements evaluated here (the chat's and the servers' drawings; the studio passes its bodies'). */
export const partElements = (doc: StudioDoc): PartElement[] => evaluatedElements(doc).flatMap(x => doc.nodes[x.node]?.id ? [{ ...x, id: doc.nodes[x.node].id! }] : []);

/** The element callouts' rules for a part: which face, at which diameter, adds which text. */
export function elementRules(doc: StudioDoc, elements: readonly PartElement[]): Rule[] {
  const out: Rule[] = [], idOf = (k: number | undefined) => k === undefined ? undefined : doc.nodes[k]?.id;
  for (const { node, element: e } of elements) {
    const n = doc.nodes[node] as ModelNode & { shaft?: number; housing?: number };
    if (e.kind === 'bearing') {
      const b = e.report, name = `bearing ${b.designation ?? b.row}${cited(e.row)}`, shaft = idOf(n.shaft), housing = idOf(n.housing);
      if (shaft && b.seat) { const re = new RegExp(`^${shaft}\\.seat${b.seat.step}(\\.\\d+)?$`); out.push({ test: f => re.test(f), diameter: b.bore, text: () => name }); }
      if (housing && b.housing) out.push({ test: f => f.startsWith(`${housing}.`), diameter: b.housing.bore, text: () => name });
    }
    if (e.kind === 'retaining-ring') {
      const r = e.report, shaft = idOf(n.shaft); if (!shaft) continue;
      const re = new RegExp(`^${shaft}\\.groove${r.groove}$`), width = r.thickness + r.axialPlay;
      out.push({ test: f => re.test(f), diameter: r.innerDiameter, text: f => `× ${f(width, 3)} · ring${e.row ? ` ${e.row.id}` : ''}${cited(e.row)}` });
    }
  }
  return out;
}
/**
 * A diameter dimension's text with the element its face carries (the elements given, else the part's evaluated here): the inner callout's text (a hole's, a fit's), or Ø and
 * the size, then the element's; the inner text alone when the face carries none.
 */
export function withElements(doc: StudioDoc, inner: (edge: string, diameter?: number, f?: LengthFormat) => string | null, elements: readonly PartElement[] = partElements(doc)): (edge: string, diameter?: number, f?: LengthFormat) => string | null {
  const rules = elementRules(doc, elements);
  if (!rules.length) return inner;
  return (edge, diameter, f = plain) => {
    const base = inner(edge, diameter, f);
    if (diameter === undefined) return base;
    const faces = edge.split('|').map(faceOf), hit = rules.find(r => near(r.diameter, diameter) && faces.some(r.test));
    return hit ? `${base ?? `Ø${f(diameter, 3)}`} ${hit.text(f)}` : base;
  };
}

// ——— Leader notes (O145): an element with no dimension of its own in a view — a key (its width undimensioned), a dowel
// pin (seen end-on) — named by a note with a leader to it, the same words as its line in the element list. Placed just
// outside the first view (front, top, right) where an edge of its faces shows, on the side nearest that edge; Auto
// layout's issue list moves one that overlaps clear. Their ids `el-<feature>`: made again by each auto pass.
const NOTE_KINDS: ReadonlySet<string> = new Set(['key', 'pin']);
const NOTE_VIEWS: readonly ViewId[] = ['front', 'top', 'right'];
export const ELEMENT_NOTE = 'el-';
/** The element notes for the part's keys and pins, in the views as laid out. */
export function elementNotes(views: DrawingViews, layout: SheetLayout, elements: readonly PartElement[]): DrawingNote[] {
  const out: DrawingNote[] = [];
  for (const { id, element: e } of elements) {
    if (!NOTE_KINDS.has(e.kind)) continue;
    for (const v of NOTE_VIEWS) {
      const place = layout.views[v]; if (place.hidden) continue;
      const pr = views[v], edge = pr.edges.find(x => x.ends && x.pieces.some(p => p.visible) && x.name.split('|').some(f => f.startsWith(`${id}.`)));
      if (!edge?.ends) continue;
      const a = inView(pr, edge.ends[0]), b = inView(pr, edge.ends[1]), mid: XY = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], tip = toSheet(place, mid);
      // (Out past the side of the view box nearest the edge: 8 mm, the text's top left there.)
      const [x0, y0, x1, y1] = place.box, d = [tip[0] - x0, x1 - tip[0], tip[1] - y0, y1 - tip[1]], k = d.indexOf(Math.min(...d));
      const at: XY = k === 0 ? [x0 - 34, tip[1] - 6] : k === 1 ? [x1 + 8, tip[1] - 6] : k === 2 ? [tip[0] + 6, y0 - 12] : [tip[0] + 6, y1 + 6];
      out.push({ id: `${ELEMENT_NOTE}${id}`, text: `${e.kind === 'pin' ? 'dowel pin' : e.kind} ${sizeOf(e)}`, at, leader: { view: v, at: mid } });
      break;
    }
  }
  return out;
}
/** The settings with the element notes made again (the person's own notes kept). */
export function withElementNotes(settings: DrawingSettings, notes: readonly DrawingNote[]): DrawingSettings {
  const own = (settings.notes ?? []).filter(n => !n.id.startsWith(ELEMENT_NOTE)), all = [...own, ...notes];
  const { notes: _n, ...base } = settings; void _n;
  return all.length ? { ...base, notes: all } : base;
}

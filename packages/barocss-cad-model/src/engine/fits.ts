// Fits and tolerances in the studio (R12c.2, D155): the user's fit tables (none built in — the owner: "끼워맞춤 표는
// 사용자가 불러오고"), a class on cylindrical faces by name, and declared hole–shaft pairs. Evaluation resolves each
// class at its face's nominal size against the tables and checks each pair at its limits by the kernel (checkFit): the
// limits go into the bodies' notes; a class with no row ([FIT_TABLE_MISS], saying what to load), a class on the wrong
// kind of face, or a clearance fit the geometry contradicts at MMC ([FIT_PAIR]) refuses the evaluation.
import { checkFit, faceGeometry, fitTableProblem, isHoleClass, lookupFit, FitError, type Brep, type FitCheck, type FitTable } from '@barocss/cad';
import type { StudioDoc } from './doc';
import { editRows } from './rowEdits';

/** The document's fits: the tables loaded, the faces' classes (by face name) and the pairs declared. */
export interface StudioFits { version: 1; tables?: FitTable[]; faces?: { face: string; class: string }[]; pairs?: { hole: string; shaft: string }[] }
type Note = { text: string; warning?: boolean };
type Output = { readonly id: string; readonly brep: Brep };

/** Tables added (each checked; one with an id held already replaces it) and removed by id. */
export function editFitTables(doc: StudioDoc, add: readonly unknown[], remove: readonly string[] = []): { doc: StudioDoc } | { error: string } {
  const r = editRows<FitTable>(doc.fits?.tables ?? [], add, remove, { problem: t => { const p = fitTableProblem(t); return p ? `[FIT_TABLE] ${p}` : null; }, noun: 'fit table', list: 'tables' });
  return 'error' in r ? r : { doc: { ...doc, fits: { ...(doc.fits ?? { version: 1 }), version: 1, tables: r.rows } } };
}
/** A face's class set (or cleared with null); its pairs go with it when cleared. */
export function setFaceClass(doc: StudioDoc, face: string, cls: string | null): StudioDoc {
  const f = doc.fits ?? { version: 1 as const }, faces = (f.faces ?? []).filter(x => x.face !== face);
  if (cls) faces.push({ face, class: cls });
  const pairs = cls ? f.pairs : (f.pairs ?? []).filter(p => p.hole !== face && p.shaft !== face);
  return { ...doc, fits: { ...f, version: 1, faces, ...(pairs ? { pairs } : {}) } };
}
/** A hole–shaft pair declared (or removed). */
export function setFitPair(doc: StudioDoc, hole: string, shaft: string, remove = false): StudioDoc {
  const f = doc.fits ?? { version: 1 as const }, pairs = (f.pairs ?? []).filter(p => !(p.hole === hole && p.shaft === shaft));
  if (!remove) pairs.push({ hole, shaft });
  return { ...doc, fits: { ...f, version: 1, pairs } };
}
/**
 * A key's width fit (O138): a planar face of a key (`n7.side0`), of a shaft's keyseat (`n0.keyseat1`) or of a hub's
 * keyway (`n5.keyway`) carries a class like a cylinder; the size is the key's width, the limits the key's kernel fit
 * (seat/hub as holes, the key as the shaft). Which of the three a face's name is, or null.
 */
export function keyFitRole(doc: Pick<StudioDoc, 'nodes'>, face: string): { role: 'key' | 'keyseat' | 'keyway'; node: number; seat?: number } | null {
  const m = /^(n\d+)\.(.+?)(?:#\d+)?$/.exec(face); if (!m) return null;
  const node = doc.nodes.findIndex(n => n.id === m[1]), n = doc.nodes[node]; if (!n) return null;
  if (n.kind === 'key') return { role: 'key', node };
  if (n.kind === 'keyway' && m[2] === 'keyway') return { role: 'keyway', node };
  const seat = /^keyseat(\d+)$/.exec(m[2]);
  if (n.kind === 'shaft' && seat) return { role: 'keyseat', node, seat: Number(seat[1]) };
  return null;
}
/** The classes on a key's faces, its keyseat's and its hub keyway's (by the key node and the ids of what it sits in). */
export function keyClasses(faces: readonly { face: string; class: string }[], ids: { key: string; shaft: string; keyseat: number; hub?: string }): { key?: string; seat?: string; hub?: string } {
  const on = (test: (name: string) => boolean) => faces.find(f => test(f.face.replace(/#\d+$/, '')))?.class;
  const key = on(n => n.startsWith(`${ids.key}.`)), seat = on(n => n === `${ids.shaft}.keyseat${ids.keyseat}`), hub = ids.hub ? on(n => n === `${ids.hub}.keyway`) : undefined;
  return { ...(key ? { key } : {}), ...(seat ? { seat } : {}), ...(hub ? { hub } : {}) };
}

/** The class a face carries. */
export const classOf = (doc: StudioDoc, face: string): string | undefined => doc.fits?.faces?.find(x => x.face === face)?.class;
/** The classes the tables hold, holes first. */
export function fitClasses(doc: StudioDoc): string[] {
  const all = [...new Set((doc.fits?.tables ?? []).flatMap(t => t.rows.map(r => r.class)))];
  return [...all.filter(isHoleClass).sort(), ...all.filter(c => !isHoleClass(c)).sort()];
}

const mm = (x: number) => +x.toFixed(4);
const dev = (um: number) => `${um > 0 ? '+' : um < 0 ? '−' : ''}${mm(Math.abs(um) / 1000)}`;
// (A pair's check builds two Booleans: kept per pair of B-reps and classes.)
const checks = new WeakMap<Brep, Map<string, { shaft: Brep; check: FitCheck }>>();

/** Each output's fit notes, by output id (throws a refusal). */
export function fitNotes(doc: StudioDoc, outputs: readonly Output[]): Map<string, Note[]> {
  const out = new Map<string, Note[]>(), f = doc.fits;
  if (!f?.faces?.length) return out;
  const tables = f.tables ?? [], add = (id: string, n: Note) => { const l = out.get(id); if (l) l.push(n); else out.set(id, [n]); };
  // (A face by its name as the studio shows it: a cylinder the kernel keeps in halves, `#1` and `#2`, is one face there.)
  const find = (face: string) => { for (const o of outputs) { const x = o.brep.faces.find(y => y.name === face) ?? o.brep.faces.find(y => y.name?.replace(/#\d+$/, '') === face); if (x) return { o, x }; } return null; };
  for (const { face, class: cls } of f.faces) {
    const hit = find(face);
    if (!hit) { add('', { text: `${face} (${cls}): no face of that name now`, warning: true }); continue; }
    const g = faceGeometry(hit.x);
    // (A key's, keyseat's or keyway's side: the key's width fit, in the key's notes from its kernel fit, O138.)
    const key = g.kind === 'plane' ? keyFitRole(doc, face) : null;
    if (key) {
      const hole = key.role !== 'key';
      if (hole !== isHoleClass(cls)) throw new FitError('FIT_FACE', `${face} is ${key.role === 'key' ? "a key's side: give it a shaft's class (a small letter: h9)" : `a ${key.role}'s side: give it a hole's class (a capital letter: N9, JS9, P9)`}, not ${cls}`);
      continue;
    }
    if (g.kind !== 'cylinder') throw new FitError('FIT_FACE', `${face} carries ${cls} but is not a cylinder now (a plane takes a class only on a key's, keyseat's or keyway's side)`);
    const hole = g.out === -1;
    if (hole !== isHoleClass(cls)) throw new FitError('FIT_FACE', `${face} is a ${hole ? 'hole' : 'shaft'}'s face: give it a ${hole ? "hole's class (a capital letter: H7)" : "shaft's class (a small letter: g6)"}, not ${cls}`);
    const l = lookupFit(tables, cls, 2 * g.r), src = tables.find(t => t.id === l.table)?.sources?.find(s => s.id === l.source);
    add(hit.o.id, { text: `${face}: Ø${mm(l.nominal)} ${cls} ${dev(l.upperUM)}/${dev(l.lowerUM)} mm — ${mm(l.min)} to ${mm(l.max)} (${l.table} row ${l.row}${l.estimate ? ', an estimate' : src ? `, ${src.label}` : ''})`, ...(l.estimate ? { warning: true } : {}) });
  }
  for (const p of f.pairs ?? []) {
    const h = find(p.hole), s = find(p.shaft), hc = classOf(doc, p.hole), sc = classOf(doc, p.shaft);
    if (!h || !s || !hc || !sc) { add(s?.o.id ?? h?.o.id ?? '', { text: `Fit ${p.hole} / ${p.shaft}: ${!h || !s ? 'a face is gone' : 'a face has no class'}`, warning: true }); continue; }
    const key = `${p.hole}\u0001${p.shaft}\u0001${hc}\u0001${sc}\u0001${JSON.stringify(tables)}`;
    let kept = checks.get(h.o.brep); if (!kept) { kept = new Map(); checks.set(h.o.brep, kept); }
    const memo = kept.get(key), c = memo && memo.shaft === s.o.brep ? memo.check : checkFit(tables, { brep: h.o.brep, face: h.x.id, class: hc }, { brep: s.o.brep, face: s.x.id, class: sc });
    kept.set(key, { shaft: s.o.brep, check: c });
    if (c.contradicted) throw new FitError('FIT_PAIR', `${p.hole} / ${p.shaft}: ${c.message}`);
    add(s.o.id, { text: `Fit ${p.hole} / ${p.shaft}: ${c.message}; at MMC ${c.mmc.overlap > 0 ? `${+c.mmc.overlap.toPrecision(4)} mm³ interfering` : 'clear'}, at LMC ${c.lmc.overlap > 0 ? `${+c.lmc.overlap.toPrecision(4)} mm³ interfering` : 'clear'} (by the Boolean at the limit sizes, over ${mm(c.length)} mm)`, ...(c.limits.estimate ? { warning: true } : {}) });
  }
  return out;
}

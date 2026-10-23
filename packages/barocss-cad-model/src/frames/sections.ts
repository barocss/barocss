// FRc (O117): the user's section library — rows of sections by their dimensions, each with where its sizes come from
// (a source, or flagged as an estimate; none is built in, D122) — that a frame or member names by id
// (`{kind: 'library', id}`), resolved before the kernel (engine/part.ts). A row edited moves every frame on it; a row a
// frame uses is not removed.
import { featureLabel, type FrameSectionRow, type MemberSection, type StudioDoc } from '../engine/doc';
import { checkSectionRow } from '../chat/features';

export type { FrameSectionRow };
export type SectionEdit = { doc: StudioDoc; added: string[]; replaced: string[]; removed: string[] } | { error: string };

/** The features naming each row: frames (their section and overrides) and members, as `feature i (label)`. */
export function sectionUses(doc: StudioDoc): Map<string, string[]> {
  const uses = new Map<string, string[]>();
  const note = (s: MemberSection | undefined, label: string) => { if (s?.kind !== 'library') return; const l = uses.get(s.id) ?? []; if (!l.includes(label)) l.push(label); uses.set(s.id, l); };
  doc.nodes.forEach((n, i) => {
    if (n.kind === 'frame') { const label = `feature ${i} (${featureLabel(n, i, doc.nodes)})`; note(n.section, label); for (const o of n.overrides ?? []) note(o.section, label); }
    else if (n.kind === 'frame-member') note(n.section, `feature ${i} (${featureLabel(n, i, doc.nodes)})`);
  });
  return uses;
}

/** The library with `rows` added (or replaced, by id) and `remove` taken out: each row checked, refused by name; a row in use stays. */
// (Not engine/rowEdits' editRows: a section row is normalised as it is read, ids may not repeat among those added, and
// its refusals carry their own codes and the row's index.)
export function editSections(doc: StudioDoc, rows: readonly unknown[] = [], remove: readonly string[] = []): SectionEdit {
  const was = doc.frames?.sections ?? [], good: FrameSectionRow[] = [];
  for (const [k, r] of rows.entries()) {
    const why = checkSectionRow(r, doc.parameters);
    if (why) return { error: `[FRAME_SECTION_ROW] row ${k}: ${why}` };
    const o = r as Record<string, unknown>, source = typeof o.source === 'string' ? o.source.trim() : '';
    good.push({ id: (o.id as string).trim(), ...(typeof o.name === 'string' && o.name.trim() ? { name: o.name.trim() } : {}), section: o.section as FrameSectionRow['section'], ...(source ? { source } : { estimate: true as const }) });
  }
  if (new Set(good.map(r => r.id)).size !== good.length) return { error: '[FRAME_SECTION_ROW] two rows with one id.' };
  const uses = sectionUses(doc), gone = remove.filter(id => was.some(r => r.id === id)), unknown = remove.filter(id => !was.some(r => r.id === id) && !good.some(r => r.id === id));
  if (unknown.length) return { error: `[FRAME_SECTION_UNKNOWN] no row ${unknown.map(x => `"${x}"`).join(', ')} to remove (rows: ${was.map(r => r.id).join(', ') || 'none'}).` };
  const busy = gone.filter(id => uses.has(id) && !good.some(r => r.id === id));
  if (busy.length) return { error: `[FRAME_SECTION_IN_USE] ${busy.map(id => `"${id}" is used by ${uses.get(id)!.join(', ')}`).join('; ')}: give those another section first.` };
  const replaced = good.filter(r => was.some(w => w.id === r.id)).map(r => r.id), added = good.filter(r => !was.some(w => w.id === r.id)).map(r => r.id);
  const sections = [...was.filter(r => !gone.includes(r.id)).map(r => good.find(g => g.id === r.id) ?? r), ...good.filter(r => added.includes(r.id))];
  const frames = { version: 1 as const, ...doc.frames, sections };
  return { doc: { ...doc, frames }, added, replaced, removed: gone.filter(id => !good.some(r => r.id === id)) };
}

/** A row's section in words, for the library's list: `RHS 40×40×3` and the like. */
export { sectionLabel } from '../engine/doc';

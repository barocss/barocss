// R12c.7 (D162): a section table (one kind's named sizes, the user's — none built in) read into the section library
// (FRc, O117) as one row a size: `<table>:<size>`, its section by the size's dimensions and its source (its own, the
// table's) or the estimate flag. The table is checked whole by the kernel's `sectionTableProblem` first, so a table the
// kernel would refuse never half-loads.
import { sectionTableProblem, type SectionTable } from '@barocss/cad';
import type { FrameSectionRow } from '../engine/doc';

/** A file's contents that look like a section table (`kind` one of FR's and `rows` of sizes), as opposed to library rows. */
export const isSectionTable = (j: unknown): boolean => typeof j === 'object' && j !== null && !Array.isArray(j) && Array.isArray((j as { rows?: unknown }).rows) && typeof (j as { kind?: unknown }).kind === 'string';
/** The table's sizes as library rows, or why the table is refused (`[SECTION_TABLE] …`). */
export function sectionTableRows(table: unknown): { rows: FrameSectionRow[] } | { error: string } {
  const p = sectionTableProblem(table);
  if (p) return { error: `[SECTION_TABLE] ${p}` };
  const t = table as SectionTable, label = t.label ?? t.id;
  return { rows: t.rows.map(r => {
    const { size, source, estimate, ...dims } = r as Record<string, unknown> & { size: string; source?: string; estimate?: boolean };
    // (A T-slot's own size dimension is `sizeMM` in a table: the row's name is `size`.)
    const section = (t.kind === 'tslot' ? (() => { const { sizeMM, ...rest } = dims; return { kind: t.kind, size: sizeMM, ...rest }; })() : { kind: t.kind, ...dims }) as FrameSectionRow['section'];
    const src = source ?? (estimate ? undefined : t.source);
    return { id: `${t.id}:${size}`, name: `${label} ${size}`, section, ...(src ? { source: src } : { estimate: true as const }) };
  }) };
}

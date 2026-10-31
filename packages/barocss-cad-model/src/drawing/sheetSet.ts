// 11 ④: a drawing set built sheet by sheet — each sheet's settings (sheets.ts `forSheet`), laid out and built as a
// drawing of its own, its issues named by sheet; Auto layout run on each sheet in turn.
import { autoLayout, type AutoLayoutReport } from './layout';
import { coverage, drawingIssues, duplicates, issueContext, type DrawingIssue, type IssueContext, type SheetInputs } from './issues';
import { buildSheet, sectionExtents, type Sheet, type SheetSection } from './sheet';
import { forSheet, mergeSheet, sheetCount, sheetMap, sheetName, sheetSetIssues } from './sheets';
import { layoutSheet, type SheetLayout } from './views';
import { VIEW_IDS, type DrawingSettings, type DrawingViews } from './types';

export interface BuiltSheet { settings: DrawingSettings; layout: SheetLayout; sheet: Sheet }
/** Every sheet of the drawing, built from `meta` as `buildSheet` takes it. A drawing with one sheet gives that sheet. */
export function buildSheets(views: DrawingViews, settings: DrawingSettings, meta: Parameters<typeof buildSheet>[3], sections?: readonly SheetSection[]): BuiltSheet[] {
  return Array.from({ length: sheetCount(settings) }, (_, k) => {
    const s = forSheet(settings, k), layout = layoutSheet(views, s, sectionExtents(s, sections));
    return { settings: s, layout, sheet: buildSheet(views, layout, s, meta, sections) };
  });
}

/** Each sheet's contexts, for the issue list: the sheet's number (from 1) and name with what `drawingIssues` finds on it, then the sheets' own problems. */
export interface SheetIssue { sheet: number; name: string; issue: Pick<DrawingIssue, 'code' | 'severity' | 'message'> & Partial<DrawingIssue> }
/**
 * What is missing — a hole's size or position, a step, the overall sizes, a view a hole shows round in — and what is
 * given twice, judged on the
 * whole drawing: every view as placed on its sheet, every sheet's dimensions together. Each is named by the sheet of its
 * view (the first without one). A drawing with one sheet has these on its own issue list already.
 */
export function setCoverage(settings: DrawingSettings, contexts: readonly IssueContext[]): SheetIssue[] {
  if (contexts.length < 2) return [];
  const at = sheetMap(settings), first = contexts[0], views = { ...first.layout.views };
  for (const v of VIEW_IDS) views[v] = contexts[Math.min(at.get(v) ?? 0, contexts.length - 1)].layout.views[v];
  const whole: IssueContext = { ...first, settings: { ...settings, sheetContext: undefined }, layout: { ...first.layout, views }, sheet: { ...first.sheet, dimensions: contexts.flatMap(c => c.sheet.dimensions), groups: contexts.flatMap(c => c.sheet.groups), sections: contexts.flatMap(c => c.sheet.sections ?? []), details: contexts.flatMap(c => c.sheet.details ?? []) } };
  delete whole.settings.sheetContext;
  return [...duplicates(whole), ...coverage(whole)].map(issue => { const k = issue.view ? at.get(issue.view) ?? 0 : 0; return { sheet: k + 1, name: sheetName(settings, k), issue }; });
}

export function sheetsIssues(i: SheetInputs, contexts?: readonly IssueContext[]): SheetIssue[] {
  const n = sheetCount(i.settings), out: SheetIssue[] = [], all: IssueContext[] = [];
  for (let k = 0; k < n; k++) {
    const ctx = contexts?.[k] ?? issueContext({ ...i, settings: forSheet(i.settings, k) });
    all.push(ctx);
    for (const issue of drawingIssues(ctx)) out.push({ sheet: k + 1, name: sheetName(i.settings, k), issue });
  }
  out.push(...setCoverage(i.settings, all));
  for (const x of sheetSetIssues(i.settings)) out.push({ sheet: x.sheet, name: sheetName(i.settings, x.sheet - 1), issue: { code: 'SHEET_SET', severity: 'warning', message: x.message } });
  return out.sort((a, b) => a.sheet - b.sheet);
}

/** Auto layout on each sheet in turn, each as a drawing of its own; the settings with every sheet's result written back, and each sheet's report. */
export function autoLayoutSheets(i: SheetInputs): { settings: DrawingSettings; reports: AutoLayoutReport[] } {
  let settings = i.settings;
  const reports: AutoLayoutReport[] = [];
  for (let k = 0; k < sheetCount(i.settings); k++) {
    const r = autoLayout({ ...i, settings: forSheet(settings, k) });
    settings = mergeSheet(settings, k, r.settings); reports.push(r.report);
  }
  return { settings, reports };
}

/** What the issue list of sheet `k` (from 0) adds in a drawing set: what is missing, judged on the whole drawing, and the set's own problems for that sheet. Nothing for one sheet. */
export function setIssuesOn(i: SheetInputs, k: number): DrawingIssue[] {
  const n = sheetCount(i.settings);
  if (n < 2) return [];
  const contexts = Array.from({ length: n }, (_, j) => issueContext({ ...i, settings: forSheet(i.settings, j) }));
  const own = sheetSetIssues(i.settings).map((x): SheetIssue => ({ sheet: x.sheet, name: sheetName(i.settings, x.sheet - 1), issue: { code: 'SHEET_SET', severity: 'warning', message: x.message } }));
  return [...setCoverage(i.settings, contexts), ...own].filter(x => x.sheet === k + 1).map(x => x.issue as DrawingIssue);
}

// The agent's drawing tools (R14.5, O6): the same Auto layout, issue list and tolerance suggestions the Drawing
// workspace offers, on the document's drawing. Reading tools change nothing; the others change the drawing, which an
// agent can only propose (`propose` with them as ops; D41): the user accepts it in the studio.
import { brepsFor } from '../engine/evaluate';
import type { StudioDoc } from '../engine/doc';
import { projectViews } from '../drawing/project';
import { tableContent } from '../drawing/tables';
import { holeCallout } from '../drawing/callout';
import { sectionOf } from '../drawing/section';
import { threadsOf } from '../app/threads';
import { autoDimensions } from '../drawing/auto';
import { autoLayout, frontByInformation } from '../drawing/layout';
import { reorient } from '../drawing/reorient';
import { drawingIssues, fixAll, issueContext, type DrawingIssueCode, type SheetInputs } from '../drawing/issues';
import { acceptAll, applySuggestion, toleranceSuggestions } from '../drawing/tolerance';
import { readDrawing, VIEW_IDS, type DrawingSettings, type ViewId } from '../drawing/types';
import { SCALES, scaleLabel } from '../drawing/views';

export const DRAWING_TOOL_NAMES = new Set(['drawing_issues', 'tolerance_suggestions', 'auto_dimension', 'fix_drawing', 'accept_tolerances', 'set_drawing']);
/** Those that change the drawing (an agent proposes them). */
export const DRAWING_CHANGES = new Set(['auto_dimension', 'fix_drawing', 'accept_tolerances', 'set_drawing']);

export const DRAWING_TOOLS = [
  {
    name: 'drawing_issues',
    description: 'The drawing’s issue list, as the Drawing workspace shows it: what is wrong on the sheet (errors: lost dimensions, overlapping text, text over lines, off the sheet, views that do not fit, datums or frames lost) and what is missing or repeated (warnings: holes without size or position, steps not located, overall sizes missing, a size given twice, re-matched references, a view needed). Each with its code, message and the fix it offers (if any). Also the sheet, scale and views shown. Changes nothing.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'tolerance_suggestions',
    description: 'Tolerance and GD&T suggestions for the drawing, each with its basis (the fastener data and the relation it comes from) or marked an estimate: a general tolerance note; in ± mode ± values on hole positions; in geometric mode datums A B C and a position frame per kind of hole. mode: look at the other mode without changing it. Changes nothing.',
    input_schema: { type: 'object', properties: { mode: { type: 'string', enum: ['plus-minus', 'geometric'] } }, additionalProperties: false },
  },
  {
    name: 'auto_dimension',
    description: 'Lays the drawing out and dimensions it from the part: the views it needs, room for their dimensions, the largest scale and sheet that read cleanly; overall sizes, steps, hole positions (a row at one pitch as N× pitch, a bolt circle by its pitch circle and centre) and one callout per kind of hole. Keeps dimensions the user placed. layout: false keeps the sheet, scale and views as they are and only dimensions. Changes the drawing: propose it (as an op of propose).',
    input_schema: { type: 'object', properties: { layout: { type: 'boolean' } }, additionalProperties: false },
  },
  {
    name: 'fix_drawing',
    description: 'Applies the issue list’s fixes, one at a time and the list looked at again after each (errors first): moves text clear, removes lost dimensions and repeats, an automatic scale, Auto-dimension for what is missing. codes: only issues with these codes (default every one with a fix). Changes the drawing: propose it.',
    input_schema: { type: 'object', properties: { codes: { type: 'array', items: { type: 'string' } } }, additionalProperties: false },
  },
  {
    name: 'accept_tolerances',
    description: 'Accepts tolerance suggestions (ids from tolerance_suggestions; default all, datums before the frames that name them), mode first set if given. Say which are estimates when you report it. Changes the drawing: propose it.',
    input_schema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' } }, mode: { type: 'string', enum: ['plus-minus', 'geometric'] } }, additionalProperties: false },
  },
  {
    name: 'set_drawing',
    description: 'Sets the drawing’s sheet (A4 | A3), scale (a standard one: 10, 5, 2, 1, 0.5, 0.2, 0.1, … or "auto"), projection (third | first), front (the side the front view looks from: y- default, x+, y+, x-; the annotations re-mapped to the views showing their axes, or refused when one would read differently), views shown (the front and top always; right, iso optional), tolerancing mode (plus-minus | geometric) and title. Changes the drawing: propose it.',
    input_schema: { type: 'object', properties: { sheet: { type: 'string', enum: ['A4', 'A3'] }, scale: { anyOf: [{ type: 'number' }, { type: 'string', enum: ['auto'] }] }, projection: { type: 'string', enum: ['third', 'first'] }, front: { type: 'string', enum: ['y-', 'x+', 'y+', 'x-'] }, views: { type: 'array', items: { type: 'string', enum: ['front', 'top', 'right', 'iso'] } }, tolerancing: { type: 'string', enum: ['plus-minus', 'geometric'] }, title: { type: 'string' } }, additionalProperties: false },
  },
];

/** What the drawing is built from: the part's views, its drawing settings, callouts, threads and section A–A. */
export function drawingInputs(doc: StudioDoc, settings: DrawingSettings = readDrawing(doc.drawing)): SheetInputs | string {
  const b = brepsFor(doc);
  if ('error' in b) return `The part could not be evaluated: ${b.error}`;
  const r = projectViews(b.breps, b.prefixes, { tangentEdges: !!settings.tangent, ...(settings.orientation ? { orientation: settings.orientation } : {}) });
  if (!r.ok) return r.empty ? 'There is no body to draw yet.' : `The views could not be projected: ${r.error}`;
  const section = settings.section ? sectionOf(doc, settings.section.y, settings.orientation) : undefined;
  return { views: r.views, settings, callout: e => holeCallout(doc.nodes, e), meta: { title: settings.title ?? 'part', date: new Date().toISOString().slice(0, 10), threads: threadsOf(doc.nodes), tableContent: tb => tableContent(tb, { doc }) }, ...(section?.ok ? { section } : {}) };
}

type Outcome = { doc: StudioDoc; content: Record<string, unknown>; changed: boolean; summary: string } | { error: string };

function sheetOf(i: SheetInputs) {
  const ctx = issueContext(i);
  return { ctx, sheet: { sheet: i.settings.sheet, scale: scaleLabel(ctx.layout.scale), fits: ctx.layout.fits, views: VIEW_IDS.filter(v => !ctx.layout.views[v].hidden), dimensions: ctx.sheet.dimensions.map(d => d.ok ? d.text : `lost: ${d.reason}`), tolerancing: i.settings.tolerancing ?? 'plus-minus' } };
}
const issueList = (i: SheetInputs) => { const { ctx, sheet } = sheetOf(i); return { sheet, issues: drawingIssues(ctx).map(x => ({ code: x.code, severity: x.severity, message: x.message, ...(x.fix ? { fix: x.fix.kind } : {}) })) }; };

/** Runs a drawing tool on the document. */
export function runDrawingTool(doc: StudioDoc, name: string, args: Record<string, unknown>): Outcome {
  const i = drawingInputs(doc);
  if (typeof i === 'string') return { error: i };
  // (`from`: the projection the settings are for — another front side's when one was turned to.)
  const set = (settings: DrawingSettings, summary: string, extra: Record<string, unknown> = {}, from: SheetInputs = i): Outcome => {
    const next = { ...from, settings };
    return { doc: { ...doc, drawing: settings }, content: { ...extra, ...issueList(next) }, changed: JSON.stringify(settings) !== JSON.stringify(i.settings), summary };
  };
  switch (name) {
    case 'drawing_issues': { const out = issueList(i); return { doc, content: out, changed: false, summary: `${out.issues.length} drawing issue${out.issues.length === 1 ? '' : 's'}` }; }
    case 'tolerance_suggestions': {
      const mode = args.mode === 'geometric' || args.mode === 'plus-minus' ? args.mode : undefined;
      const settings = mode ? withMode(i.settings, mode) : i.settings, list = toleranceSuggestions(issueContext({ ...i, settings }));
      return { doc, content: { mode: settings.tolerancing ?? 'plus-minus', suggestions: list.map(x => ({ id: x.id, kind: x.kind, message: x.message, basis: x.basis, estimate: x.estimate })) }, changed: false, summary: `${list.length} suggestion${list.length === 1 ? '' : 's'}` };
    }
    case 'auto_dimension': {
      if (args.layout === false) {
        const ctx = issueContext(i), r = autoDimensions(i.views, ctx.layout, i.settings, i.callout);
        return set({ ...i.settings, dimensions: r.dimensions }, 'drawing dimensioned', { added: r.report.added, kept: r.report.kept, skipped: r.report.skipped, crowded: r.report.crowded });
      }
      // The front's side by information, when nothing placed by hand ties it (R14.3b): the part projected for it first.
      let base = i, front: string | undefined;
      const pick = frontByInformation(i.views, i.settings);
      if (pick) {
        const other = drawingInputs(doc, pick.orientation === 'y-' ? { ...i.settings } : { ...i.settings, orientation: pick.orientation });
        const turned = typeof other === 'string' ? null : reorient(i.views, other.views, i.settings, pick.orientation);
        if (typeof other !== 'string' && turned?.ok) { base = { ...other, settings: turned.settings }; front = `${pick.orientation}: ${pick.why}`; }
      }
      const r = autoLayout(base);
      return set(r.settings, `drawing laid out on ${r.report.sheet} at ${scaleLabel(r.report.scale)} and dimensioned`, { added: r.report.dimensions.added, kept: r.report.dimensions.kept, skipped: r.report.dimensions.skipped, dropped_views: r.report.dropped, readable: r.report.readable, ...(front ? { front } : {}) }, base);
    }
    case 'fix_drawing': {
      const codes = Array.isArray(args.codes) ? args.codes.map(String) : null;
      const r = codes ? fixAll(i, 40, (_f, issue) => codes.includes(issue.code as DrawingIssueCode)) : fixAll(i);
      return set(r.settings, `${r.applied.length} drawing fix${r.applied.length === 1 ? '' : 'es'}`, { applied: r.applied.map(f => f.kind) });
    }
    case 'accept_tolerances': {
      const mode = args.mode === 'geometric' || args.mode === 'plus-minus' ? args.mode : undefined;
      const start = mode ? withMode(i.settings, mode) : i.settings, ids = Array.isArray(args.ids) ? args.ids.map(String) : null;
      if (!ids) { const r = acceptAll({ ...i, settings: start }); return set(r.settings, `${r.accepted.length} tolerance suggestion${r.accepted.length === 1 ? '' : 's'} accepted`, { accepted: r.accepted.map(x => ({ id: x.id, message: x.message, estimate: x.estimate })) }); }
      const offered = toleranceSuggestions(issueContext({ ...i, settings: start })), unknown = ids.filter(id => !offered.some(x => x.id === id));
      if (unknown.length) return { error: `No suggestion ${unknown.join(', ')} (offered: ${offered.map(x => x.id).join(', ') || 'none'}).` };
      let settings = start;
      // (Datums first: a frame names them.)
      for (const x of [...offered.filter(o => ids.includes(o.id))].sort((a, b) => Number(b.kind === 'datum') - Number(a.kind === 'datum'))) settings = applySuggestion(settings, x);
      return set(settings, `${ids.length} tolerance suggestion${ids.length === 1 ? '' : 's'} accepted`, { accepted: offered.filter(o => ids.includes(o.id)).map(x => ({ id: x.id, message: x.message, estimate: x.estimate })) });
    }
    case 'set_drawing': {
      let s: DrawingSettings = { ...i.settings }, turnedTo: SheetInputs | null = null;
      if (args.sheet === 'A4' || args.sheet === 'A3') s.sheet = args.sheet;
      if (args.scale === 'auto') delete s.scale;
      else if (args.scale !== undefined) { const v = Number(args.scale); if (!SCALES.includes(v)) return { error: `A scale is one of ${SCALES.join(', ')} or "auto".` }; s.scale = v; }
      if (args.projection === 'third' || args.projection === 'first') s.projection = args.projection;
      if (typeof args.front === 'string' && args.front !== (s.orientation ?? 'y-')) {
        if (!['y-', 'x+', 'y+', 'x-'].includes(args.front)) return { error: 'front is one of y-, x+, y+, x- (the side the front view looks from).' };
        const other = drawingInputs(doc, args.front === 'y-' ? (() => { const x = { ...s }; delete x.orientation; return x; })() : { ...s, orientation: args.front as 'x+' });
        if (typeof other === 'string') return { error: other };
        const t = reorient(i.views, other.views, s, args.front as 'y-');
        if (!t.ok) return { error: `[${t.code}] ${t.message}${t.code === 'ORIENTATION_REMAP_FAILED' ? ` ${t.failed.map(f => `${f.dim}: ${f.was} → ${f.now}`).join('; ')}` : ''}` };
        s = t.settings; turnedTo = other;
      }
      if (Array.isArray(args.views)) { const v = VIEW_IDS.filter(x => (args.views as unknown[]).includes(x) || x === 'front' || x === 'top'); if (v.length === VIEW_IDS.length) delete s.views; else s.views = v as ViewId[]; }
      if (args.tolerancing === 'geometric' || args.tolerancing === 'plus-minus') s = withMode(s, args.tolerancing);
      if (typeof args.title === 'string' && args.title.trim()) s.title = args.title.trim().slice(0, 80);
      return set(s, 'drawing settings changed', {}, turnedTo ?? i);
    }
  }
  return { error: `No drawing tool ${name}.` };
}

const withMode = (s: DrawingSettings, mode: 'plus-minus' | 'geometric'): DrawingSettings => { const next = { ...s }; delete next.tolerancing; return mode === 'geometric' ? { ...next, tolerancing: 'geometric' } : next; };

import { manufacturingDrawingProperties, checkManufacturingDrawing, withManufacturingDrawing } from '../drawing/options';
import { firstProblem, isRefusal } from '../engine/refusal';
// The agent's drawing tools (R14.5, O6): the same Auto layout, issue list and tolerance suggestions the Drawing
// workspace offers, on the document's drawing. Reading tools change nothing; the others change the drawing, which an
// agent can only propose (`propose` with them as ops; D41): the user accepts it in the studio.
import { drawingDocument, drawingSource, drawingScopeOf, checkDrawingScope, changeDrawingScope, drawsMadeOnly, type DrawingScope } from '../drawing/scope';
import { elementNotes, partElements, withElementNotes, withElements } from '../drawing/elementCallouts';
import { followedStale, staleText } from '../frames/skeleton';
import { fitMiss, withFit } from '../drawing/fits';
import { weldList, type WeldJoint } from '../frames/welds';
import { evaluatePart } from '../engine/evaluate';
import { baseBodyFaces, brepsFor } from '../engine/evaluate';
import type { StudioDoc } from '../engine/doc';
import { projectViews } from '../drawing/project';
import { tableContent } from '../drawing/tables';
import { bomPanelDataOf } from '../bom/bom';
import type { Bom } from '../bom/core';
import { holeCallout, holeCalloutOwnerOf } from '../drawing/callout';
import { sectionsCut } from '../drawing/section';
import { sheetSections } from '../drawing/sheet';
import { threadsOf } from '../app/threads';
import { fastenerSizesOf } from '../engine/fastenerSizeRows';
import { revisionOf } from '../util/revision';
import { autoDimensions } from '../drawing/auto';
import { autoLayout, frontByInformation } from '../drawing/layout';
import { reorient } from '../drawing/reorient';
import { drawingIssues, fixRound, fixRoundsOutcome, fixRoundsStart, issueContext, type DrawingFix, type DrawingIssue, type DrawingIssueCode, type SheetInputs } from '../drawing/issues';
import { acceptAll, applySuggestion, toleranceSuggestions } from '../drawing/tolerance';
import { readDrawing, sectionsOf, VIEW_IDS, type DrawingSettings, type ViewId } from '../drawing/types';
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
    description: 'Sets drawing-only scope ({kind: part, part?: instance id}, local coordinates; or {kind: assembly}, existing BOM/balloons). Default is base part, legacy BOM/balloons remain assembly. Scope changes with manual model references are refused. Sets weldSymbols/balloons booleans (false removes the flag), sections [{id, view: front|top|right, at: model mm, half?: {line: vertical|horizontal, at, cut: after|before} (a half section), steps?: [{past, at}] with along? (an offset section: from past on, the plane at depth at)}], details [{id, view: front|top|right|section:<letter>, center: [x, y] and radius in that view’s model mm, scale?, at?: sheet [x, y]}] (a detail view enlarges what lies inside the circle), breaks [{axis: x|y|z, from, to: model mm}] (that band left out of the views, drawn shorter; dimensions keep true values) and source tables [{id, from: bom|cut-list|weld-list, title?, at?: [sheet x,y], corner?, whole?}]. Lists replace completely; [] clears, omitted keeps. Referenced section changes and invalid inputs are refused atomically. Scope does not change when enabling tables or balloons. Sets the drawing’s sheet (A4 | A3), scale (10, 5, 2, 1, 0.5, 0.2, 0.1, … or "auto"), projection (third | first), front (the side the front view looks from: y- default, x+, y+, x-; the annotations re-mapped to the views showing their axes, or refused when one would read differently), views shown (the front and top always; right, iso optional), tolerancing mode (plus-minus | geometric), title and standard (iso | asme | none clears). Changes the drawing: propose it.',
    input_schema: { type: 'object', properties: { ...manufacturingDrawingProperties, scope: { oneOf: [{ type: 'object', properties: { kind: { const: 'part' }, part: { type: 'string' } }, required: ['kind'], additionalProperties: false }, { type: 'object', properties: { kind: { const: 'assembly' } }, required: ['kind'], additionalProperties: false }] }, sheet: { type: 'string', enum: ['A4', 'A3'] }, scale: { anyOf: [{ type: 'number' }, { type: 'string', enum: ['auto'] }] }, projection: { type: 'string', enum: ['third', 'first'] }, standard: { type: 'string', enum: ['iso', 'asme', 'none'] }, front: { type: 'string', enum: ['y-', 'x+', 'y+', 'x-'] }, views: { type: 'array', items: { type: 'string', enum: ['front', 'top', 'right', 'iso'] } }, tolerancing: { type: 'string', enum: ['plus-minus', 'geometric'] }, title: { type: 'string' } }, additionalProperties: false },
  },
];

/** What the drawing is built from: the part's views, its drawing settings, callouts, threads and sections (O148 X1). */
export function drawingInputs(doc: StudioDoc, settings: DrawingSettings = readDrawing(doc.drawing)): SheetInputs | string {
  let authored = doc;
  try { authored = drawingSource(doc, settings); doc = drawingDocument(doc, settings); } catch (cause) { return String(cause instanceof Error ? cause.message : cause); }
  // (O174: a part's drawing is what the part makes — its bought elements out of its views and sections; an assembly's keeps
  // them, and a sheet with balloons, O175.)
  const made = drawsMadeOnly(settings);
  const b = brepsFor(doc, { made });
  if ('error' in b) return `The part could not be evaluated: ${b.error}`;
  const r = projectViews(b.breps, b.prefixes, { tangentEdges: !!settings.tangent, ...(settings.orientation ? { orientation: settings.orientation } : {}) });
  if (!r.ok) return r.empty ? 'There is no body to draw yet.' : `The views could not be projected: ${r.error}`;
  const sections = sheetSections(sectionsCut(doc, sectionsOf(settings), settings.orientation, made)), elements = partElements(doc), bom = bomOf(doc, settings);
  return { views: r.views, settings, locationOwner: e => holeCalloutOwnerOf(doc, e), fastenerSizes: fastenerSizesOf(doc), elements, callout: withElements(doc, withFit(doc, e => holeCallout(doc.nodes, e, doc.parameters)), elements), fitMiss: fitMiss(doc), followedChanged: followedStale(authored).map(staleText), meta: { title: settings.title ?? 'part', date: new Date().toISOString().slice(0, 10), source: revisionOf(authored), threads: threadsOf(doc.nodes, fastenerSizesOf(doc)), tableContent: tb => tableContent(tb, { doc, ...(bom ? { bom } : {}) }), ...(settings.weldSymbols ? { welds: weldJointsOf(doc) } : {}), ...(bom ? { bom } : {}), ...(bom && settings.balloons ? { bodyFaces: baseBodyFaces(doc) } : {}) }, ...(sections.length ? { sections } : {}) };
}

/** O147 B2: the BOM, when a table or the balloons read it (each document evaluated on its own, synchronously). */
function bomOf(doc: StudioDoc, settings: DrawingSettings): Bom | undefined {
  if (!settings.balloons && !(settings.tables ?? []).some(t => t.from === 'bom')) return undefined;
  return bomPanelDataOf(doc, d => evaluatePart(d, 0, 8, 'read'), settings.title ?? 'part').bom;
}
/** FRd2 (O119): the frame's weld joints for the symbols (the part evaluated for its members). */
function weldJointsOf(doc: StudioDoc): readonly WeldJoint[] { const e = evaluatePart(doc, 0); return e.ok ? weldList(doc, e.bodies).joints : []; }

type Outcome = { doc: StudioDoc; content: Record<string, unknown>; changed: boolean; summary: string } | { error: string };

function sheetOf(i: SheetInputs) {
  const ctx = issueContext(i);
  return { ctx, sheet: { sheet: i.settings.sheet, scale: scaleLabel(ctx.layout.scale), fits: ctx.layout.fits, views: VIEW_IDS.filter(v => !ctx.layout.views[v].hidden), dimensions: ctx.sheet.dimensions.map(d => d.ok ? d.text : `lost: ${d.reason}`), tolerancing: i.settings.tolerancing ?? 'plus-minus' } };
}
const issueList = (i: SheetInputs) => { const { ctx, sheet } = sheetOf(i); return { sheet, issues: drawingIssues(ctx).map(x => ({ code: x.code, severity: x.severity, message: x.message, ...(x.fix ? { fix: x.fix.kind } : {}) })) }; };

/** Runs a drawing tool on the document. */
export function runDrawingTool(doc: StudioDoc, name: string, args: Record<string, unknown>): Outcome {
  if (name === 'set_drawing') { const why = setDrawingProblem(args, readDrawing(doc.drawing).frames); if (why) return { error: why }; }
  const original = readDrawing(doc.drawing);
  let settings = original;
  if (name === 'set_drawing' && args.scope !== undefined) {
    const why = firstProblem(checkDrawingScope(args.scope)); if (why) return { error: why };
    try { settings = changeDrawingScope(original, args.scope as DrawingScope); } catch (cause) { return { error: cause instanceof Error ? cause.message : String(cause) }; }
  }
  const i = drawingInputs(doc, settings);
  if (typeof i === 'string') return { error: i };
  // (`from`: the projection the settings are for — another front side's when one was turned to.)
  const set = (settings: DrawingSettings, summary: string, extra: Record<string, unknown> = {}, from: SheetInputs = i): Outcome => {
    settings = readDrawing({ ...settings, scope: drawingScopeOf(settings) });
    const next = { ...from, settings };
    return { doc: { ...doc, drawing: settings }, content: { ...extra, ...issueList(next) }, changed: JSON.stringify(settings) !== JSON.stringify(original), summary };
  };
  switch (name) {
    case 'drawing_issues': { const out = issueList(i); return { doc, content: out, changed: false, summary: `${out.issues.length} drawing issue${out.issues.length === 1 ? '' : 's'}` }; }
    case 'tolerance_suggestions': {
      const mode = args.mode === 'geometric' || args.mode === 'plus-minus' ? args.mode : undefined;
      const settings = mode ? withMode(i.settings, mode) : i.settings, list = toleranceSuggestions(issueContext({ ...i, settings }));
      return { doc, content: { mode: settings.tolerancing ?? 'plus-minus', suggestions: list.map(x => ({ id: x.id, kind: x.kind, message: x.message, basis: x.basis, estimate: x.estimate })) }, changed: false, summary: `${list.length} suggestion${list.length === 1 ? '' : 's'}` };
    }
    case 'auto_dimension': {
      if (drawingScopeOf(i.settings).kind === 'assembly') return { error: '[DRAWING_SCOPE_AUTO] automatic component dimensions belong to a part drawing; assembly annotations and BOM are retained' };
      if (args.layout === false) {
        const ctx = issueContext(i), r = autoDimensions(i.views, ctx.layout, i.settings, i.callout, i.elements, i.sections, i.locationOwner);
        return set(withElementNotes({ ...i.settings, dimensions: r.dimensions }, i.elements ? elementNotes(i.views, ctx.layout, i.elements) : []), 'drawing dimensioned', { added: r.report.added, kept: r.report.kept, skipped: r.report.skipped, crowded: r.report.crowded });
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
      const assembly = drawingScopeOf(i.settings).kind === 'assembly';
      const codes = Array.isArray(args.codes) ? args.codes.map(String) : null;
      // (O170, F8: a fix can change what the sheet is built from — a section added is a new view to lay out — so the inputs
      // are built again from the fixed settings and the fixes run again, until a round applies none (FIX_ROUNDS at most).
      // In one round the overlap a new section brings was invisible: a second Fix found it.)
      // (A later round dimensions again only when the round before added a section — its new view — or Auto-dimension and
      // the moves after it undo each other round after round, on issues it cannot meet.)
      // (O174: the rounds run as before, and the best sheet they reach is kept — fewer errors, else fewer warnings — only
      // when it is better than the one Fix started from: a round may make what the next one clears (a section's view), so
      // no round is judged alone; and a Fix whose moves and Auto-dimension cannot meet what is left changes nothing, so a
      // second Fix applies nothing.)
      // (O175: the rounds are drawing/issues' fixRound, which the studio's Fix all runs too, a round per sheet cut.)
      const built = new Map<DrawingSettings, SheetInputs>([[i.settings, i]]);
      const only = (fix: DrawingFix, issue: DrawingIssue) => (!assembly || fix.kind !== 'auto-dimension') && (!codes || codes.includes(issue.code as DrawingIssueCode));
      let step = fixRound(fixRoundsStart(i), i, only);
      while (step.next) {
        const next = drawingInputs({ ...doc, drawing: step.next }, step.next);
        if (typeof next === 'string') { step = fixRoundsOutcome(step.state); break; }
        built.set(step.next, next);
        step = fixRound(step.state, next, only);
      }
      const { settings, applied } = step, inputs = built.get(settings) ?? i;
      return set(settings, `${applied.length} drawing fix${applied.length === 1 ? '' : 'es'}`, { applied: applied.map(f => f.kind) }, inputs);
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
      let s: DrawingSettings = { ...i.settings };
      if (args.sheet === 'A4' || args.sheet === 'A3') s.sheet = args.sheet;
      if (args.scale === 'auto') delete s.scale;
      else if (args.scale !== undefined) { const v = Number(args.scale); if (!SCALES.includes(v)) return { error: `A scale is one of ${SCALES.join(', ')} or "auto".` }; s.scale = v; }
      if (args.projection === 'third' || args.projection === 'first') s.projection = args.projection;
      if (args.standard === 'none') delete s.standard; else if (args.standard === 'iso' || args.standard === 'asme') s.standard = args.standard;
      if (typeof args.front === 'string' && args.front !== (s.orientation ?? 'y-')) {
        if (!['y-', 'x+', 'y+', 'x-'].includes(args.front)) return { error: 'front is one of y-, x+, y+, x- (the side the front view looks from).' };
        const other = drawingInputs(doc, args.front === 'y-' ? (() => { const x = { ...s }; delete x.orientation; return x; })() : { ...s, orientation: args.front as 'x+' });
        if (typeof other === 'string') return { error: other };
        const t = reorient(i.views, other.views, s, args.front as 'y-');
        if (!t.ok) return { error: `[${t.code}] ${t.message}${t.code === 'ORIENTATION_REMAP_FAILED' ? ` ${t.failed.map(f => `${f.dim}: ${f.was} → ${f.now}`).join('; ')}` : ''}` };
        s = t.settings;
      }
      if (Array.isArray(args.views)) { const v = VIEW_IDS.filter(x => (args.views as unknown[]).includes(x) || x === 'front' || x === 'top'); if (v.length === VIEW_IDS.length) delete s.views; else s.views = v as ViewId[]; }
      if (args.tolerancing === 'geometric' || args.tolerancing === 'plus-minus') s = withMode(s, args.tolerancing);
      if (typeof args.title === 'string' && args.title.trim()) s.title = args.title.trim().slice(0, 80);
      // Freeze the pre-change scope before BOM/balloons can affect legacy scope inference.
      s = { ...s, scope: drawingScopeOf(i.settings) };
      try { s = withManufacturingDrawing(s, args); } catch (e) { if (isRefusal(e, 'DRAWING_SECTION_REFERENCES', 'DRAWING_DETAIL_REFERENCES', 'DRAWING_DETAIL_LETTER', 'DRAWING_DETAIL_PARENT')) return { error: e.message }; throw e; }
      // Sections, weld symbols and source tables need their new projection/meta for this result too.
      const updated = drawingInputs(doc, s);
      if (typeof updated === 'string') return { error: updated };
      return set(s, 'drawing settings changed', {}, updated);
    }
  }
  return { error: `No drawing tool ${name}.` };
}

const withMode = (s: DrawingSettings, mode: 'plus-minus' | 'geometric'): DrawingSettings => { const next = { ...s }; delete next.tolerancing; return mode === 'geometric' ? { ...next, tolerancing: 'geometric' } : next; };

/** The handler also validates input: dispatch and saved proposal replay do not enforce JSON schema. */
function setDrawingProblem(args: Record<string, unknown>, frames: DrawingSettings['frames']): string | null {
  const allowed = ['scope', 'sheet', 'scale', 'projection', 'standard', 'front', 'views', 'tolerancing', 'title', ...Object.keys(manufacturingDrawingProperties), 'response_format', 'because'];
  const unknown = Object.keys(args).find(k => !allowed.includes(k));
  if (unknown) return `[DRAWING_OPTIONS] Unknown drawing setting ${unknown}.`;
  const choices: Record<string, readonly unknown[]> = { sheet: ['A4', 'A3'], projection: ['third', 'first'], standard: ['iso', 'asme', 'none'], front: ['y-', 'x+', 'y+', 'x-'], tolerancing: ['plus-minus', 'geometric'], response_format: ['auto', 'concise', 'detailed'] };
  for (const [key, values] of Object.entries(choices)) if (key in args && !values.includes(args[key])) return `[DRAWING_OPTIONS] ${key} must be one of ${values.join(', ')}.`;
  if ('scope' in args) { const why = firstProblem(checkDrawingScope(args.scope)); if (why) return why; }
  if ('scale' in args && args.scale !== 'auto' && (typeof args.scale !== 'number' || !SCALES.includes(args.scale))) return '[DRAWING_OPTIONS] scale must be a standard numeric scale or "auto".';
  for (const key of ['title', 'because']) if (key in args && typeof args[key] !== 'string') return `[DRAWING_OPTIONS] ${key} must be a string.`;
  if ('views' in args && (!Array.isArray(args.views) || !args.views.every(v => VIEW_IDS.includes(v)) || new Set(args.views).size !== args.views.length)) return '[DRAWING_OPTIONS] views must be unique front/top/right/iso names.';
  return firstProblem(checkManufacturingDrawing(args, frames));
}

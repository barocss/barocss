// The part's view handlers (R3, moved verbatim from chat/tools.ts's runPartTool): rendered views, a face's or an
// edge's detail, and the selection by name.
import { resolveNames, resolveSelectors, type NameSelection } from '../names';
import { edgeDetail, faceDetail } from '../observe';
import { renderViews } from '../views';
import { type ChatState, type Evaluate, type ToolOutcome, type PartHandler, json, fail, isObj, strings, list } from '../toolKit';

async function renderViewsTool(state: ChatState, args: Record<string, unknown>, evaluate: Evaluate): Promise<ToolOutcome> {
  const highlight = strings(args.highlight), sec = isObj(args.section) ? args.section : undefined;
  if (sec && (!['x', 'y', 'z'].includes(String(sec.axis)) || !Number.isFinite(Number(sec.at)))) return fail(state, 'A section takes an axis (x, y or z) and at (mm).');
  const r = await renderViews(state.doc, state.bodies, evaluate, { ...(highlight.length ? { highlight } : {}), ...(sec ? { section: { axis: String(sec.axis) as 'x' | 'y' | 'z', at: Number(sec.at) } } : {}) });
  if (typeof r === 'string') return fail(state, r);
  const { image, ...rest } = r;
  return { state, content: json(rest), isError: false, changed: false, summary: `views (${Object.keys(r.legend).length} faces labelled)`, images: [{ data: image, mediaType: 'image/png' }] };
}
async function inspectTool(state: ChatState, args: Record<string, unknown>): Promise<ToolOutcome> {
  const r = resolveSelectors(state.doc.nodes, state.bodies, { faces: list(args.faces), edges: list(args.edges) });
  if (r.error) return fail(state, r.error);
  const faces = r.names.faces.map(n => faceDetail(state.doc, state.bodies, n) ?? { name: n, error: 'no such face' });
  const edges = r.names.edges.map(n => edgeDetail(state.doc, state.bodies, n) ?? { name: n, error: 'no such edge' });
  const out = { ...(faces.length ? { faces } : {}), ...(edges.length ? { edges } : {}), ...(r.resolved.length ? { resolved: r.resolved } : {}) };
  return { state, content: json(out), isError: false, changed: false, summary: `${faces.length + edges.length} inspected` };
}
async function selectTool(state: ChatState, args: Record<string, unknown>): Promise<ToolOutcome> {
  const r = resolveSelectors(state.doc.nodes, state.bodies, { faces: list(args.faces), edges: list(args.edges), bodies: list(args.bodies) });
  if (r.error) return fail(state, r.error);
  const sel: NameSelection = r.names, { unknown } = resolveNames(state.bodies, sel);
  if (unknown.length) return fail(state, `No face, edge or body named ${unknown.map(n => `"${n}"`).join(', ')}.`);
  const count = sel.faces.length + sel.edges.length + sel.bodies.length;
  return { state: { ...state, selection: sel }, content: json({ ok: true, selected: sel, ...(r.resolved.length ? { resolved: r.resolved } : {}) }), isError: false, changed: false, summary: `${count} selected` };
}

/** The view group's handlers, by v1 tool name (R3). */
export const VIEW_HANDLERS: Readonly<Record<string, PartHandler>> = { render_views: renderViewsTool, inspect: inspectTool, select: selectTool };

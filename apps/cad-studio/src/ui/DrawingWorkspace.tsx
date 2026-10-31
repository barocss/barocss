// The Drawing workspace: the part's standard views on a sheet, dimensioned by clicking in a view.
// Tools: Select (click a dimension to select it, drag to move it, Delete removes it), Linear (two
// points, or one straight edge, then where the dimension line goes), Diameter and Radius (a circle
// that shows round in the view, then where the text goes). The sheet exports as SVG, PDF or DXF (R11b, O1);
// section A–A also alone as a 1:1 DXF.
import { drawsMadeOnly } from '@barocss/cad-model/drawing/scope';





import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import { signaturesOf } from '@barocss/cad-model/engine/rematch';
import { toSig } from '@barocss/cad-model/engine/references';
import { modelAnnotations } from '@barocss/cad-model/drawing/annotations3d';


import type { ProjectedEdge } from '@barocss/cad';
import type { EngineClient } from '../engine/client';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { FriendlyError } from '@barocss/cad-model/engine/errors';
import { buildSheet, curveMark, dimensionMarks, placementOf, projectionOf, sheetSections } from '@barocss/cad-model/drawing/sheet';
import { marksSvg, sheetGroupsSvg, sheetSvg } from '@barocss/cad-model/io/svg';

import { pdfMissing, sheetPdf } from '@barocss/cad-model/io/pdf';
import { sectionDxfDocument, sheetDxf } from '@barocss/cad-model/io/dxf';
import { MIN_HOLE_ON_PAPER_MM, autoLayout, frontByInformation } from '@barocss/cad-model/drawing/layout';
import { reorient, turnSections } from '@barocss/cad-model/drawing/reorient';
import { applyFix, drawingIssues, fixRound, fixRoundsOutcome, fixRoundsStart, type DrawingFix, type DrawingIssue, type FixRoundStep, type FixRounds, type SheetInputs } from '@barocss/cad-model/drawing/issues';
import { acceptAll, toleranceSuggestions, type ToleranceSuggestion } from '@barocss/cad-model/drawing/tolerance';
import { writeDxf, type DxfVersion } from '@barocss/cad';


import { VIEWS, fromSheet, scaleLabel, toSheet, type Orientation } from '@barocss/cad-model/drawing/views';
import { angleBetween, edgeAt, inView, resolveLine, newDimensionId, orientFor, resolveDimension, roundIn, snapPoints, type SnapPoint } from '@barocss/cad-model/drawing/dimensions';
import { DETAIL_PARENTS, type DetailParent } from '@barocss/cad-model/drawing/detail';
import { DetailsList } from './drawing/DetailsList';
import { BreaksList } from './drawing/BreaksList';
import { VIEW_IDS, detailLetter, isDetailRef, isSectionRef, isViewId, nextSectionId, sameSection, sectionLetter, sectionsOf, withSections, type DimView, type DimPoint, type DrawingNote, type EdgeRef, type DrawingDimension, type DrawingSettings, type DrawingViews, type Vec3, type ViewId, type XY } from '@barocss/cad-model/drawing/types';
import { downloadBytes } from './files';
import { today, useDrawingSheet } from './useDrawingSheet';
import { fastenerSizesOf } from '@barocss/cad-model/engine/fastenerSizeRows';
import { Icon, Kbd } from './atoms';
import { SIDE_NAMES } from './drawing/sheetShared';
import { SheetSettings } from './drawing/SheetSettings';
import { IssuesList } from './drawing/IssuesList';
import { TolerancingList } from './drawing/TolerancingList';
import { DimensionsList } from './drawing/DimensionsList';
import { DatumsEditor } from './drawing/DatumsEditor';
import { DatumTargetsEditor, DEFAULT_TARGET_DRAFT, type DatumTargetDraft } from './drawing/DatumTargetsEditor';
import { checkDatumTargetOptions, datumTargetConflicts, datumTargetEndpoint, resolveDatumTarget, type DatumTargetPoint, type DrawingDatumTarget } from '@barocss/cad-model/drawing/datumTargets';
import { FrameEditor } from './drawing/FrameEditor';
import { committedSettings } from './drawing/commitSettings';
import { StandaloneFramesEditor } from './drawing/StandaloneFramesEditor';
import { checkDrawingFrames, readFrames, type DrawingFrame } from '@barocss/cad-model/drawing/controls';
import { ToleranceEditor } from './drawing/ToleranceEditor';
import { NotesList } from './drawing/NotesList';
import { ExportActions } from './drawing/ExportActions';
import '../drawing/drawing.css';

type Tool = 'select' | 'linear' | 'diameter' | 'radius' | 'angle' | 'note' | 'detail' | 'datum-target';
const TOOLS: { tool: Tool; label: string; icon: string; key: string; hint: string }[] = [
  { tool: 'select', label: 'Select', icon: 'arrow_selector_tool', key: 'V', hint: 'Click a dimension to select it, drag to move it · Delete removes it · drag the paper to pan, scroll to zoom' },
  { tool: 'linear', label: 'Linear dimension', icon: 'straighten', key: 'D', hint: 'Click two points (edge ends, circle centres) or one straight edge, then where the dimension goes' },
  { tool: 'diameter', label: 'Diameter', icon: 'radio_button_unchecked', key: 'Ø', hint: 'Click a circle, then where its diameter goes' },
  { tool: 'radius', label: 'Radius', icon: 'line_end_circle', key: 'R', hint: 'Click a circle or an arc, then where its radius goes' },
  { tool: 'angle', label: 'Angle', icon: 'architecture', key: 'A', hint: 'Click two straight edges, then the side of their corner the angle goes on' },
  { tool: 'note', label: 'Note', icon: 'sticky_note_2', key: 'N', hint: 'Click on the paper for a note, or on a view for a leader and then where its text goes' },
  { tool: 'detail', label: 'Detail view', icon: 'zoom_in', key: 'E', hint: 'Click the centre of what to enlarge on a view or a section, then how far its circle reaches' },
  { tool: 'datum-target', label: 'Datum target', icon: 'my_location', key: 'T', hint: 'Choose point, line or area under Datum targets. Point: click a straight edge endpoint. Line: click its two ends. Area: click its centre. Then place the target symbol.' },
];
type Pending =
  | { kind: 'standalone-frame'; view: DimView; frame: Extract<DrawingFrame, { view: DimView }>; moving: boolean; settingsKey: string; sourceDoc: StudioDoc; model: StudioDoc }
  | { kind: 'datum-target'; view: ViewId; target: DrawingDatumTarget; moving: boolean }
  /** A target line's first end, picked in its view (view mm). */
  | { kind: 'datum-line'; view: ViewId; from: XY }
  | { kind: 'linear'; view: DimView; a: DimPoint; b?: DimPoint }
  | { kind: 'diameter' | 'radius'; view: DimView; edge: string; near: Vec3 }
  | { kind: 'angle'; view: DimView; a: EdgeRef; b?: EdgeRef }
  | { kind: 'note'; leader: { view: ViewId; at: XY } }
  /** DR-1: a detail's circle, its centre picked on its parent. */
  | { kind: 'detail'; view: DetailParent; center: XY };
/** `q`: the pointer on the sheet (mm); `at`: in the view under it (model mm). */
/** `view` (O148 X2): a view, or a section the sheet placed (`section:B`). */
interface Hover { q: XY; view: DimView; at: XY; snap: SnapPoint | null; edge: ProjectedEdge | null }

export interface DrawingReferencePreview { dimensionId: string; edge?: string }
export interface DrawingReferenceLabel { dimensionId: string; view: DimView; text: string | null; reason?: string }

export function DrawingWorkspace({ engine, doc: sourceDoc, bodies: sourceBodies, settings, fileName, onChange: sourceOnChange, onToast, referencePreview, onReferenceLabels }: {
  engine: EngineClient; doc: StudioDoc; bodies?: readonly BodyResult[]; settings: DrawingSettings; fileName: string;
  onChange(next: DrawingSettings): void; onToast(e: FriendlyError): void;
  referencePreview?: DrawingReferencePreview | null; onReferenceLabels?(labels: readonly DrawingReferenceLabel[]): void;
}) {
  // (The sheet's pipeline, shared with the viewport's 3D annotations, G24: views, layout, sheet and what they are built from.)
  const { source, scopeRead, scope, scopeKey, doc, model, currentModel, bodies, views, cutsMade, sectionList, error, empty, busy, title, cuts, sectionA, cutA, layout, elements, callout, locationOwner, fitMissOf, followedChanged, threads, bom, tableContentOf, hasSheet, hasFrame, kinds, hasBought, weldJoints, bodyFaces, sheet } = useDrawingSheet(true, { engine, doc: sourceDoc, bodies: sourceBodies, settings, fileName });
  const onChange = (next: DrawingSettings) => {
    if (!scopeRead.scope) { onToast({ title: 'Drawing scope unchanged', hint: scopeRead.error ?? 'Invalid drawing scope', detail: '' }); return; }
    sourceOnChange(committedSettings(next, scopeRead.scope));
  };
  const [dxfSection, setDxfSection] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>('select');
  const [pending, setPending] = useState<Pending | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [selectedFrame, setSelectedFrame] = useState<string | null>(null);
  const [targetChoices, setTargetChoices] = useState<DrawingDatumTarget[]>([]);
  const [reselectTarget, setReselectTarget] = useState<DrawingDatumTarget | null>(null);
  const [targetDraft, setTargetDraft] = useState<DatumTargetDraft>(DEFAULT_TARGET_DRAFT);
  useEffect(() => { if (selected !== null) { setSelectedTarget(null); setSelectedFrame(null); } }, [selected]);
  useEffect(() => { if (selectedTarget !== null) setSelectedFrame(null); }, [selectedTarget]);
  const [message, setMessage] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; place: XY } | { target: string; original: DrawingDatumTarget; place: XY } | { note: string; at: XY; grab: XY } | { detail: string; at: XY; grab: XY } | { removed: string; at: XY; grab: XY } | { pan: XY; box: [number, number, number, number] } | null>(null);
  /** The selected note's text while it is typed, and the selected dimension's tolerance fields. */
  const [noteDraft, setNoteDraft] = useState<string | null>(null);
  const [tolDraft, setTolDraft] = useState<Record<string, string>>({});
  /** A note just added: its text box takes the keyboard, its placeholder text selected. */
  const noteBox = useRef<HTMLTextAreaElement>(null), [typeNote, setTypeNote] = useState<string | null>(null);
  // (Once the new note has come back in the settings and its text box shows it.)
  const shownNote = selected && settings.notes?.some(n => n.id === selected) ? selected : null;
  useEffect(() => {
    if (!typeNote || shownNote !== typeNote) return;
    const t = setTimeout(() => { noteBox.current?.focus(); noteBox.current?.select(); setTypeNote(null); }, 0);
    return () => clearTimeout(t);
  }, [typeNote, shownNote]);
  const svg = useRef<SVGSVGElement>(null);
  useEffect(() => {
    setPending(null); setSelected(null); setSelectedTarget(null); setSelectedFrame(null); setTargetChoices([]); setReselectTarget(null); setHover(null); setDrag(null); setNoteDraft(null); setTolDraft({});
  }, [scopeKey]);

  // The drawing's issue list (R14.2, O3): what is wrong on the sheet, then what is missing; fixes where safe.
  const issues = useMemo<DrawingIssue[]>(() => views && layout && sheet ? drawingIssues({ views, layout, settings, sheet, callout, locationOwner, fitMiss: fitMissOf, followedChanged, elements, ...(cuts.length ? { sections: cuts } : {}) }) : [], [views, layout, settings, sheet, callout, locationOwner, fitMissOf, followedChanged, elements, cuts]);
  // Tolerance and GD&T suggestions (R14.4, O5): offered with their basis, applied only when accepted.
  const suggestions = useMemo<ToleranceSuggestion[]>(() => views && layout && sheet ? toleranceSuggestions({ views, layout, settings, sheet, callout, locationOwner, fastenerSizes: fastenerSizesOf(doc) }) : [], [views, layout, settings, sheet, callout, locationOwner, doc.fastenerSizes]);
  const acceptEvery = () => {
    if (!views) return;
    const r = acceptAll({ views, settings, fastenerSizes: fastenerSizesOf(doc), callout, locationOwner, fitMiss: fitMissOf, meta: { title, date: today(), source, threads, tableContent: tableContentOf, welds: weldJoints, bodyFaces, ...(bom ? { bom } : {}) }, ...(cuts.length ? { sections: cuts } : {}) });
    onChange(r.settings);
    const est = r.accepted.filter(x => x.estimate).length;
    onToast({ title: `${r.accepted.length} suggestion${r.accepted.length === 1 ? '' : 's'} accepted`, hint: est ? `${est} of them ${est === 1 ? 'is an estimate' : 'are estimates'}: check ${est === 1 ? 'it' : 'them'} against your process.` : 'Each from the studio’s data.', detail: r.accepted.map(x => `${x.message} — ${x.basis}`).join('\n') });
  };
  const fixIssue = (x: DrawingIssue) => { if (scope.kind === 'assembly' && x.fix?.kind === 'auto-dimension') return; if (views && layout && sheet && x.fix) onChange(applyFix({ views, layout, settings, sheet, callout, locationOwner, elements, ...(cuts.length ? { sections: cuts } : {}) }, x.fix)); };
  // (O175: Fix all runs the chat's rounds, fixRound: a round that adds a section waits for the worker to cut it, and the
  // next round runs on the sheet with its view — one Fix, as the chat's fix_drawing, not a second click. The rounds stop
  // when the settings change from elsewhere. Each round is its own undo step.)
  const fixing = useRef<{ state: FixRounds; want: string } | null>(null);
  const fixInputs = (): SheetInputs | null => views ? { views, settings, callout, locationOwner, elements, fitMiss: fitMissOf, meta: { title, date: today(), source, threads, tableContent: tableContentOf, welds: weldJoints, bodyFaces, ...(bom ? { bom } : {}) }, ...(cuts.length ? { sections: cuts } : {}) } : null;
  const fixOnly = (fix: DrawingFix) => scope.kind !== 'assembly' || fix.kind !== 'auto-dimension';
  const fixStep = (step: FixRoundStep) => {
    if (step.next) {
      fixing.current = { state: step.state, want: JSON.stringify({ ...step.next, scope: step.next.scope ?? scopeRead.scope }) };
      onChange(step.next); return;
    }
    fixing.current = null;
    if (JSON.stringify(step.settings) !== JSON.stringify(settings)) onChange(step.settings);
    onToast({ title: `${step.applied.length} fix${step.applied.length === 1 ? '' : 'es'} applied`, hint: step.left.length ? `${step.left.length} issue${step.left.length === 1 ? '' : 's'} left: ${step.left[0].message}` : 'The drawing has no issues.', detail: step.left.slice(1).map(x => x.message).join('\n') });
  };
  const fixEvery = () => {
    const i = fixInputs(); if (!i) return;
    fixStep(fixRound(fixRoundsStart(i), i, fixOnly));
  };
  useEffect(() => {
    const f = fixing.current; if (!f) return;
    if (JSON.stringify(settings) !== f.want) { fixing.current = null; return; }
    if (error) { fixStep(fixRoundsOutcome(f.state)); return; }
    // (Settled: every section the settings list cut for them, the views projected.)
    if (busy || !views || !layout || !sheet || !sectionList.every(x => cutsMade?.some(c => sameSection(c, x)))) return;
    const i = fixInputs(); if (i) fixStep(fixRound(f.state, i, fixOnly));
  }, [settings, busy, views, layout, sheet, cutsMade, error, locationOwner]);
  // Reference inspection reads this sheet; it does not change the selected reference or the saved drawing.
  const referenceLabels = useMemo<readonly DrawingReferenceLabel[]>(() => !busy && sheet ? sheet.dimensions.map(r => ({ dimensionId: r.dim.id, view: r.dim.view, text: r.ok ? r.text : null, ...(!r.ok ? { reason: r.reason } : {}) })) : [], [busy, sheet]);
  useEffect(() => { onReferenceLabels?.(referenceLabels); }, [onReferenceLabels, referenceLabels]);
  const referenceInspection = useMemo(() => {
    if (!referencePreview) return null;
    const unavailable = (reason: string, dimensionId: string | null = null) => ({ dimensionId, markup: '', message: `Reference preview unavailable: ${reason}` });
    const dimensions = settings.dimensions.filter(d => d.id === referencePreview.dimensionId);
    if (dimensions.length !== 1) return unavailable(dimensions.length ? 'the dimension ID is not unique.' : 'the dimension is not in this drawing.');
    const dimension = dimensions[0];
    if (busy || !views || !layout || !sheet) return unavailable('the current sheet is not ready.');
    const placement = placementOf(layout, sheet, dimension.view), projection = projectionOf(views, sheet, dimension.view);
    if (!placement || placement.hidden || !projection) return unavailable('the dimension view is not shown.');
    const resolved = sheet.dimensions.filter(r => r.dim.id === dimension.id);
    if (resolved.length !== 1 || !resolved[0].ok) return unavailable('the dimension has no resolved display on this sheet.');
    const label = `${dimension.view}: ${resolved[0].text}`;
    if (referencePreview.edge === undefined) return { dimensionId: dimension.id, markup: '', message: `${label}. Dimension highlighted; no reference changed.` };
    const edges = projection.edges.filter(e => e.name === referencePreview.edge);
    if (edges.length !== 1) return unavailable(edges.length ? 'the candidate has more than one projected edge in this view.' : 'the candidate is not in this view.', dimension.id);
    const pieces = edges[0].pieces.filter(p => p.visible);
    if (!pieces.length) return unavailable('the candidate has no visible segments in this view.', dimension.id);
    return { dimensionId: dimension.id, markup: marksSvg(pieces.map(p => curveMark(placement, p.curve, 'visible'))), message: `${label}. Candidate highlighted for inspection only; no reference changed.` };
  }, [referencePreview, settings.dimensions, busy, views, layout, sheet]);
  const referenceDimensionId = referenceInspection?.dimensionId ?? null;
  useEffect(() => {
    if (!referencePreview) return;
    setSelected(referenceDimensionId); setSelectedTarget(null); setSelectedFrame(null); setTargetChoices([]); setReselectTarget(null); setTool('select'); setPending(null);
  }, [referencePreview, referenceDimensionId]);
  const sheetMarkup = useMemo(() => sheet ? sheetGroupsSvg(sheet, selected, selectedTarget, selectedFrame) : '', [sheet, selected, selectedTarget, selectedFrame]);
  const [W, H] = layout?.size ?? [297, 210];
  const [box, setBox] = useState<[number, number, number, number] | null>(null);
  useEffect(() => { setBox(null); }, [settings.sheet]);
  const viewBox = box ?? [-6, -6, W + 12, H + 12];

  // Pointer position on the sheet (mm), and the view under it.
  const sheetPoint = useCallback((clientX: number, clientY: number): XY | null => {
    const el = svg.current, m = el?.getScreenCTM(); if (!el || !m) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse()); return [p.x, p.y];
  }, []);
  const mmPerPx = () => { const m = svg.current?.getScreenCTM(); return m ? 1 / m.a : 0.3; };
  const viewAt = useCallback((q: XY): DimView | null => {
    if (!layout) return null;
    let best: DimView | null = null, bestD = 30;
    // (DR-4: a revolved section lies on its view: inside its box, it is taken before the view.)
    const near = (id: DimView, [x0, y0, x1, y1]: readonly number[], over = 0) => { const d = Math.max(x0 - q[0], q[0] - x1, y0 - q[1], q[1] - y1, 0); if (d - (d === 0 ? over : 0) < bestD) { bestD = d - (d === 0 ? over : 0); best = id; } };
    for (const id of VIEW_IDS) if (!layout.views[id].hidden) near(id, layout.views[id].box);
    // (O148 X2: the sections as placed, dimensioned as views are.)
    for (const x of sheet?.sections ?? []) near(`section:${x.id}`, x.placement.box, x.form === 'revolved' ? 1 : 0);
    // (DR-1: the details as drawn, dimensioned as views are.)
    for (const x of sheet?.details ?? []) near(`detail:${x.id}`, x.placement.box);
    return best;
  }, [layout, sheet]);
  const snaps = useMemo(() => views ? { ...Object.fromEntries(VIEW_IDS.map(id => [id, snapPoints(views[id])])), ...Object.fromEntries((sheet?.sections ?? []).map(x => [`section:${x.id}`, snapPoints(x.projection)])), ...Object.fromEntries((sheet?.details ?? []).map(x => [`detail:${x.id}`, snapPoints(x.projection)])) } as Partial<Record<DimView, SnapPoint[]>> : null, [views, sheet?.sections, sheet?.details]);
  const placementAt = (v: DimView) => layout ? placementOf(layout, sheet ?? undefined, v) : undefined;
  const projectionAt = (v: DimView) => views ? projectionOf(views, sheet ?? undefined, v) : undefined;
  const viewLabel = (v: DimView) => isSectionRef(v) ? `section ${sectionLetter(v)}–${sectionLetter(v)}` : isDetailRef(v) ? `detail ${detailLetter(v)}` : `${VIEWS[v].label.toLowerCase()} view`;

  const hoverAt = useCallback((clientX: number, clientY: number): Hover | null => {
    const q = sheetPoint(clientX, clientY); if (!q || !layout || !views || !snaps) return null;
    const view = viewAt(q), v = view && placementOf(layout, sheet ?? undefined, view), pr = view && projectionOf(views, sheet ?? undefined, view); if (!view || !v || !pr) return null;
    const at = fromSheet(v, q), tol = 9 * mmPerPx() / v.scale;
    let snap: SnapPoint | null = null, best = tol;
    for (const s of snaps[view] ?? []) { const d = Math.hypot(s.at[0] - at[0], s.at[1] - at[1]); if (d < best) { best = d; snap = s; } }
    return { q, view, at, snap, edge: snap ? null : edgeAt(pr, at, 6 * mmPerPx() / v.scale) };
  }, [sheetPoint, layout, views, snaps, viewAt, sheet]);

  /** Placing a dimension (its points picked): where it goes, read in its own view wherever the pointer is on the sheet —
   *  beyond the views' reach too (hoverAt finds a view only within 30 mm), so a click out on the paper places it. */
  const placingAt = (clientX: number, clientY: number): Hover | null => {
    if (!pending || pending.kind === 'note' || ((pending.kind === 'linear' || pending.kind === 'angle') && !pending.b)) return null;
    const q = sheetPoint(clientX, clientY), v = q && placementAt(pending.view);
    return q && v ? { q, view: pending.view, at: fromSheet(v, q), snap: null, edge: null } : null;
  };

  const commitDims = (dimensions: DrawingDimension[]) => onChange({ ...settings, dimensions });
  const commitFrames = (frames: DrawingFrame[]) => {
    if (!scopeRead.scope) { setMessage(scopeRead.error ?? 'Invalid drawing scope.'); return false; }
    const why = checkDrawingFrames({ frames }, settings.frames ?? [])[0];
    if (why) { setMessage(why.message); return false; }
    onChange({ ...settings, frames: readFrames(frames) }); return true;
  };
  const removeFrame = (frame: DrawingFrame) => {
    if (frame.dim !== undefined) return;
    if (commitFrames((settings.frames ?? []).filter(row => row !== frame))) { setSelectedFrame(null); setPending(null); setMessage(null); }
  };
  const commitTargets = (datumTargets: DrawingDatumTarget[]) => {
    if (!scopeRead.scope) { setMessage(scopeRead.error ?? 'Invalid drawing scope.'); return false; }
    if (datumTargets.length > 200 || datumTargetConflicts(datumTargets).size) { setMessage('Datum targets need at most 200 rows with unique IDs and letter-number pairs.'); return false; }
    // Saved legacy rows may remain untouched while one row is explicitly repaired. New objects stay strict.
    const existing = new Set(settings.datumTargets ?? []), changed = datumTargets.filter(row => !existing.has(row));
    const why = checkDatumTargetOptions({ datumTargets: changed })[0];
    if (why) { setMessage(why.message); return false; }
    onChange({ ...settings, datumTargets }); setPending(null); setTargetChoices([]); return true;
  };
  const cancel = () => { setPending(null); setTargetChoices([]); setReselectTarget(null); setMessage(null); };
  const chooseTarget = (target: DrawingDatumTarget, moving = false) => {
    setSelectedFrame(null);
    if (reselectTarget && !moving) {
      const current = (settings.datumTargets ?? []).filter(row => row.id === reselectTarget.id);
      if (!views || busy || current.length !== 1 || current[0] !== reselectTarget) { setMessage('The target changed or its current drawing is not ready. Select Reselect endpoint again.'); return; }
      const next = { ...reselectTarget, point: target.point } as DrawingDatumTarget, resolved = resolveDatumTarget(views[next.view], next);
      if (!resolved.ok) { setMessage(`${resolved.code}: ${resolved.reason}`); return; }
      if (commitTargets(settings.datumTargets!.map(row => row === reselectTarget ? next : row))) {
        setReselectTarget(null); setTool('select'); setSelected(null); setSelectedTarget(next.id); setMessage(null);
      }
      return;
    }
    setReselectTarget(null);
    setTargetChoices([]); setPending({ kind: 'datum-target', view: target.view, target, moving });
    setMessage('Click where the target symbol goes. Esc cancels.');
  };
  const placeFrame = (view: DimView, frame?: DrawingFrame) => {
    const placement = placementAt(view);
    if (busy || !views || !placement || placement.hidden) { setMessage('Show the frame view and wait for the current drawing before placing a frame.'); return; }
    if (frame && frame.dim !== undefined) return;
    const frames = settings.frames ?? [];
    if (!frame && frames.length >= 200) { setMessage('A drawing can contain up to 200 geometric control frames.'); return; }
    let id = 'frame-1', index = 2; while (frames.some(row => row.id === id)) id = `frame-${index++}`;
    cancel(); setSelected(null); setSelectedTarget(null); setSelectedFrame(frame?.id ?? null); setTool('select'); setDrag(null);
    setPending({ kind: 'standalone-frame', view, frame: frame ?? { id, view, place: [0, 0], characteristic: 'position', value: 0.1, datums: [] }, moving: !!frame, settingsKey: JSON.stringify(settings), sourceDoc, model });
    setMessage(`Click where the standalone frame goes in the ${viewLabel(view)}. Esc cancels.`);
  };

  /** A line or area target: its points are clicked in a view (a snapped edge end or centre, else the exact point). */
  const pickFreeTarget = (h: Hover, view: ViewId) => {
    const rows = settings.datumTargets ?? [], round = (p: readonly number[]): XY => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100];
    if (rows.length >= 200) { setMessage('A drawing can contain up to 200 datum targets.'); return; }
    const picked = round(h.snap ? h.snap.at : h.at);
    let n = 1; while (rows.some(t => t.letter === 'A' && t.number === n)) n++;
    let id = 'target-1', k = 2; while (rows.some(t => t.id === id)) id = `target-${k++}`;
    const head = { id, letter: 'A', number: n, view, place: round(h.at) };
    if (targetDraft.kind === 'line') {
      if (pending?.kind !== 'datum-line') { setPending({ kind: 'datum-line', view, from: picked }); setMessage('Click the other end of the target line. Esc cancels.'); return; }
      if (pending.view !== view) { setMessage(`Pick the other end in the ${pending.view} view.`); return; }
      if (pending.from[0] === picked[0] && pending.from[1] === picked[1]) { setMessage('A target line needs two distinct points.'); return; }
      chooseTarget({ ...head, kind: 'line', line: { from: pending.from, to: picked } }); return;
    }
    const number = (v: string) => v.trim() ? Number(v) : NaN;
    const area = targetDraft.shape === 'circle' ? { shape: 'circle' as const, at: picked, d: number(targetDraft.d) } : { shape: 'rect' as const, at: picked, w: number(targetDraft.w), h: number(targetDraft.h) };
    const why = checkDatumTargetOptions({ datumTargets: [{ ...head, kind: 'area', area }] })[0];
    if (why) { setMessage(why.message); return; }
    chooseTarget({ ...head, kind: 'area', area });
  };

  const click = (h: Hover) => {
    if (!views) return;
    if (pending?.kind === 'standalone-frame') return; // Placed directly from its explicit view in onPointerDown.
    setMessage(null);
    if (tool === 'datum-target') {
      if (busy) { setMessage('Wait for the current drawing.'); return; }
      if (pending?.kind === 'datum-target') {
        const target = { ...pending.target, place: fromSheet(layout!.views[pending.view], h.q) };
        const resolved = resolveDatumTarget(views[pending.view], target);
        if (!resolved.ok) { setMessage(`${resolved.code}: ${resolved.reason}`); return; }
        const rows = settings.datumTargets ?? [];
        const current = rows.filter(t => t.id === target.id);
        if (pending.moving && (current.length !== 1 || current[0] !== pending.target)) { setMessage('The target changed. Select it again before moving its symbol.'); return; }
        if (commitTargets(pending.moving ? rows.map(t => t === pending.target ? target : t) : [...rows, target])) {
          setPending(null); setTool('select'); setSelected(null); setSelectedTarget(target.id);
        }
        return;
      }
      if (!isViewId(h.view)) { setMessage('Datum targets use a base view. Select a point on the front, top or right view.'); return; }
      if (!reselectTarget && targetDraft.kind !== 'point') { pickFreeTarget(h, h.view); return; }
      if (reselectTarget && h.view !== reselectTarget.view) { setMessage(`Select a current endpoint in the target's ${reselectTarget.view} view.`); return; }
      if (!bodies) { setMessage('Wait for the current drawing bodies before selecting a target endpoint.'); return; }
      const rows = settings.datumTargets ?? [];
      if (!reselectTarget && rows.length >= 200) { setMessage('A drawing can contain up to 200 point targets.'); return; }
      const pr = views[h.view], placement = layout!.views[h.view];
      let n = 1; while (rows.some(t => t.letter === 'A' && t.number === n)) n++;
      let id = 'target-1', k = 2; while (rows.some(t => t.id === id)) id = `target-${k++}`;
      const picked = endpointSnap(pr, h.at, 9 * mmPerPx() / placement.scale, bodies);
      if (picked.error) { setMessage(picked.error); return; }
      const candidates = picked.points.map((point): DrawingDatumTarget => reselectTarget ? { ...reselectTarget, point } as DrawingDatumTarget : { id, letter: 'A', number: n, view: h.view as ViewId, place: [...h.at] as XY, point, ...(targetDraft.moveable ? { moveable: true as const } : {}) });
      if (!candidates.length) { setMessage('Select a visible straight edge endpoint. Circle centres and curved edges are not supported.'); return; }
      if (candidates.length > 1) { setTargetChoices(candidates); setMessage('Endpoints overlap here. Choose the exact edge and endpoint in Point datum targets.'); return; }
      const resolved = resolveDatumTarget(pr, candidates[0]);
      if (!resolved.ok) { setMessage(`${resolved.code}: ${resolved.reason}`); return; }
      chooseTarget(candidates[0]); return;
    }
    // Where a dimension goes is read in its own view, wherever the pointer is.
    if (pending?.kind === 'note') { addNote(h.q, pending.leader); return; }
    if (tool === 'detail') { pickDetail(h); return; }
    const placing = pending && ((pending.kind !== 'linear' && pending.kind !== 'angle') || pending.b);
    const into = placing ? placementAt(pending.view) : null, place = placing && into ? fromSheet(into, h.q) : h.at;
    if (h.view === 'iso' && !placing) { setMessage('Dimensions go on the front, top and right views.'); return; }
    const pr = projectionAt(placing ? pending.view : h.view); if (!pr) return;
    if (tool === 'linear') {
      if (pending?.kind === 'linear' && pending.b) {
        const a = pointIn(pr, pending.a), b = pointIn(pr, pending.b);
        commitDims([...settings.dimensions, { id: newDimensionId(settings.dimensions), view: pending.view, kind: 'linear', a: pending.a, b: pending.b, orient: orientFor(a, b, place), place }]);
        setPending(null); return;
      }
      if (pending?.kind === 'linear' && pending.view !== h.view) { setMessage('Pick the second point in the same view.'); return; }
      if (h.snap) {
        if (!pending || pending.kind !== 'linear') { setPending({ kind: 'linear', view: h.view, a: h.snap.ref }); return; }
        const a = pointIn(pr, pending.a);
        if (Math.hypot(a[0] - h.snap.at[0], a[1] - h.snap.at[1]) < 1e-9) { setMessage('Pick a different point.'); return; }
        setPending({ ...pending, b: h.snap.ref }); return;
      }
      if (h.edge && !pending && h.edge.ends && h.edge.kind !== 'circle' && h.edge.kind !== 'curve') {
        const [p, q] = h.edge.ends;
        setPending({ kind: 'linear', view: h.view, a: { edge: h.edge.name, at: 'end', near: [...p] as Vec3 }, b: { edge: h.edge.name, at: 'end', near: [...q] as Vec3 } }); return;
      }
      setMessage(pending ? 'Click an edge end or a circle centre.' : 'Click an edge end, a circle centre or a straight edge.'); return;
    }
    if (tool === 'angle') {
      if (pending?.kind === 'angle' && pending.b) {
        commitDims([...settings.dimensions, { id: newDimensionId(settings.dimensions), view: pending.view, kind: 'angle', a: pending.a, b: pending.b, place }]);
        setPending(null); return;
      }
      // (A straight edge under the pointer, even near its ends.)
      const e = h.edge ?? edgeAt(pr, h.at, 6 * mmPerPx() / (placementAt(h.view)?.scale ?? 1));
      if (!e || !e.ends || e.circle || (e.kind !== 'line' && e.kind !== 'silhouette')) { setMessage('Click a straight edge.'); return; }
      const ref: EdgeRef = { edge: e.name, near: [0, 1, 2].map(k => (e.ends![0][k] + e.ends![1][k]) / 2) as Vec3 };
      if (!pending || pending.kind !== 'angle') { setPending({ kind: 'angle', view: h.view, a: ref }); return; }
      if (pending.view !== h.view) { setMessage('Pick the second edge in the same view.'); return; }
      const a = resolveLine(pr, pending.a), b = resolveLine(pr, ref);
      if (!a || !b || !angleBetween(a, b, h.at)) { setMessage('These edges are parallel here — pick one that meets the first at an angle.'); return; }
      setPending({ ...pending, b: ref }); return;
    }
    if (tool === 'diameter' || tool === 'radius') {
      if (pending && pending.kind === tool) {
        commitDims([...settings.dimensions, { id: newDimensionId(settings.dimensions), view: pending.view, kind: tool, edge: pending.edge, near: pending.near, place }]);
        setPending(null); return;
      }
      const e = h.edge ?? (h.snap ? pr.edges.find(x => x.name === h.snap!.ref.edge && x.circle) ?? null : null);
      if (!e?.circle) { setMessage('Click a circle or an arc.'); return; }
      if (!roundIn(pr, e)) { setMessage(`This circle is not round in the ${viewLabel(h.view)} — dimension it where it shows as a circle.`); return; }
      setPending({ kind: tool, view: h.view, edge: e.name, near: [...e.circle.center] as Vec3 }); return;
    }
  };

  /** DR-1: the detail tool — its centre on a view or a section, then a point its circle reaches; the next free letter, its scale and place automatic. */
  const pickDetail = (h: Hover) => {
    if (pending?.kind === 'detail') {
      const into = placementAt(pending.view), at = into ? fromSheet(into, h.q) : h.at, radius = Math.round(Math.hypot(at[0] - pending.center[0], at[1] - pending.center[1]) * 100) / 100;
      if (!(radius > 0)) { setMessage('Click away from the centre: that is how far the circle reaches.'); return; }
      // (A stays the front section's, by its checkbox, as added sections leave it.)
      const id = nextSectionId([{ id: 'A', view: 'front', at: 0 }, ...sectionsOf(settings)], (settings.details ?? []).map(d => d.id));
      onChange({ ...settings, details: [...(settings.details ?? []), { id, view: pending.view, center: pending.center, radius }] });
      setPending(null); return;
    }
    if (!(DETAIL_PARENTS as readonly string[]).includes(h.view) && !isSectionRef(h.view)) { setMessage('A detail enlarges part of the front, top or right view, or of a section.'); return; }
    const c = h.snap?.at ?? h.at;
    setPending({ kind: 'detail', view: h.view as DetailParent, center: [Math.round(c[0] * 100) / 100, Math.round(c[1] * 100) / 100] });
  };

  /** A new note at a sheet point (with a leader to a view point), selected with its text ready to type. */
  const addNote = (at: XY, leader?: { view: ViewId; at: XY }) => {
    const used = new Set((settings.notes ?? []).map(n => n.id)); let k = 1; while (used.has(`n${k}`)) k++;
    const note: DrawingNote = { id: `n${k}`, text: 'NOTE', at: [Math.round(at[0] * 10) / 10, Math.round(at[1] * 10) / 10], ...(leader ? { leader } : {}) };
    onChange({ ...settings, notes: [...(settings.notes ?? []), note] });
    setPending(null); setTool('select'); setSelected(note.id); setNoteDraft(note.text); setTypeNote(note.id);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if (pending?.kind === 'standalone-frame') {
      const q = sheetPoint(e.clientX, e.clientY), placement = placementAt(pending.view);
      const before = pending.sourceDoc;
      const documentChanged = sourceDoc.nodes !== before.nodes || sourceDoc.outputs !== before.outputs || sourceDoc.parameters !== before.parameters || sourceDoc.instances !== before.instances;
      if (busy || !views || !q || !placement || placement.hidden || documentChanged || currentModel.current !== pending.model || JSON.stringify(settings) !== pending.settingsKey) { setMessage('The drawing changed or the frame view is not ready. Select Add or Move frame again.'); return; }
      const rows = settings.frames ?? [], current = rows.filter(row => row.id === pending.frame.id);
      if (pending.moving && (current.length !== 1 || current[0] !== pending.frame)) { setMessage('The frame changed. Select it again before moving it.'); return; }
      const next: DrawingFrame = { ...pending.frame, view: pending.view, place: fromSheet(placement, q) };
      if (commitFrames(pending.moving ? rows.map(row => row === pending.frame ? next : row) : [...rows, next])) {
        setPending(null); setSelectedFrame(next.id); setMessage(null);
      }
      return;
    }
    const target = (e.target as Element).closest('[data-dim]');
    if (tool === 'note') e.preventDefault(); // (the note's text box keeps the focus it is given)
    if (tool === 'note' && !pending) {
      // On (or right by) a view: the leader's point first; elsewhere the note itself.
      const q = sheetPoint(e.clientX, e.clientY), h = hoverAt(e.clientX, e.clientY); if (!q || !layout) return;
      const hv = h && isViewId(h.view) ? h.view : null, [x0, y0, x1, y1] = hv ? layout.views[hv].box : [0, 0, 0, 0], on = hv && q[0] >= x0 - 3 && q[0] <= x1 + 3 && q[1] >= y0 - 3 && q[1] <= y1 + 3;
      if (h && hv && on) { setPending({ kind: 'note', leader: { view: hv, at: h.snap?.at ?? h.at } }); setMessage(null); } else addNote(q);
      return;
    }
    if (tool === 'note' && pending?.kind === 'note') { const q = sheetPoint(e.clientX, e.clientY); if (q) addNote(q, pending.leader); return; }
    if (tool === 'select') {
      const frameId = (e.target as Element).closest('[data-standalone-frame]')?.getAttribute('data-standalone-frame');
      const frames = frameId ? (settings.frames ?? []).filter(frame => frame.dim === undefined && frame.id === frameId) : [];
      if (frames.length === 1) { setSelected(null); setSelectedTarget(null); setSelectedFrame(frames[0].id); setDrag(null); return; }
      setSelectedFrame(null);
      const targetId = (e.target as Element).closest('[data-datum-target]')?.getAttribute('data-datum-target');
      const targets = targetId ? (settings.datumTargets ?? []).filter(t => t.id === targetId) : [];
      if (targets.length === 1) {
        setSelected(null); setSelectedTarget(targets[0].id); setDrag({ target: targets[0].id, original: targets[0], place: targets[0].place });
        (e.currentTarget as Element).setPointerCapture(e.pointerId); return;
      }
      setSelectedTarget(null);
      // (DR-1: a detail grabbed anywhere in its square — not on one of its dimensions — moves it on the sheet.)
      const qd = sheetPoint(e.clientX, e.clientY), onDim = !!target && settings.dimensions.some(x => x.id === target.getAttribute('data-dim'));
      const det = !onDim && qd ? sheet?.details?.find(x => qd[0] >= x.placement.box[0] && qd[0] <= x.placement.box[2] && qd[1] >= x.placement.box[1] && qd[1] <= x.placement.box[3]) : undefined;
      const sd = det && settings.details?.find(x => x.id === det.id);
      if (det && sd && qd) {
        const at = toSheet(det.placement, sd.center);
        setSelected(null); setDrag({ detail: det.id, at, grab: [qd[0] - at[0], qd[1] - at[1]] }); (e.currentTarget as Element).setPointerCapture(e.pointerId); return;
      }
      // (DR-4: a removed section grabbed anywhere in its box moves it; its place is its box's centre.)
      const rem = !onDim && qd ? sheet?.sections?.find(x => x.form === 'removed' && qd[0] >= x.placement.box[0] && qd[0] <= x.placement.box[2] && qd[1] >= x.placement.box[1] && qd[1] <= x.placement.box[3]) : undefined;
      if (rem && qd) {
        const b = rem.placement.box, at: XY = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
        setSelected(null); setDrag({ removed: rem.id, at, grab: [qd[0] - at[0], qd[1] - at[1]] }); (e.currentTarget as Element).setPointerCapture(e.pointerId); return;
      }
      const id = target?.getAttribute('data-dim') ?? null;
      setSelected(id); setNoteDraft(null); setTolDraft({});
      const d = id ? settings.dimensions.find(x => x.id === id) : undefined, n = id ? settings.notes?.find(x => x.id === id) : undefined, q = sheetPoint(e.clientX, e.clientY);
      if (n) setNoteDraft(n.text);
      if (d) setDrag({ id: d.id, place: d.place });
      else if (n && q) setDrag({ note: n.id, at: n.at, grab: [q[0] - n.at[0], q[1] - n.at[1]] });
      else setDrag({ pan: [e.clientX, e.clientY], box: [...viewBox] as [number, number, number, number] });
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      return;
    }
    const h = hoverAt(e.clientX, e.clientY) ?? placingAt(e.clientX, e.clientY); if (h) click(h);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (drag && 'pan' in drag) {
      const k = mmPerPx(); setBox([drag.box[0] - (e.clientX - drag.pan[0]) * k, drag.box[1] - (e.clientY - drag.pan[1]) * k, drag.box[2], drag.box[3]]); return;
    }
    if (drag && ('note' in drag || 'detail' in drag || 'removed' in drag)) {
      const q = sheetPoint(e.clientX, e.clientY);
      if (q) setDrag({ ...drag, at: [Math.round((q[0] - drag.grab[0]) * 10) / 10, Math.round((q[1] - drag.grab[1]) * 10) / 10] });
      return;
    }
    if (drag && 'target' in drag) {
      const target = settings.datumTargets?.find(t => t.id === drag.target), q = sheetPoint(e.clientX, e.clientY);
      if (target && q && layout) setDrag({ ...drag, place: fromSheet(layout.views[target.view], q) });
      return;
    }
    if (drag && layout) {
      const q = sheetPoint(e.clientX, e.clientY), d = settings.dimensions.find(x => x.id === drag.id);
      const at = d && placementOf(layout, sheet ?? undefined, d.view);
      if (q && d && at) setDrag({ id: drag.id, place: fromSheet(at, q) });
      return;
    }
    setHover(hoverAt(e.clientX, e.clientY) ?? placingAt(e.clientX, e.clientY));
  };
  const onPointerUp = () => {
    if (drag && 'target' in drag) {
      const targets = (settings.datumTargets ?? []).filter(t => t.id === drag.target), target = targets[0];
      if (targets.length === 1 && target === drag.original && views && !busy) {
        const resolved = resolveDatumTarget(views[target.view], target);
        if (!resolved.ok) setMessage(`${resolved.code}: ${resolved.reason}`);
        else if (target.place[0] !== drag.place[0] || target.place[1] !== drag.place[1]) commitTargets(settings.datumTargets!.map(t => t === target ? { ...t, place: drag.place } : t));
      } else setMessage('The current target is not ready or has changed. Select it again.');
      setDrag(null); return;
    }
    if (drag && 'removed' in drag) {
      const list = sectionsOf(settings), x = list.find(y => y.id === drag.removed);
      if (x?.removed && (x.removed.at?.[0] !== drag.at[0] || x.removed.at?.[1] !== drag.at[1])) onChange(withSections(settings, list.map(y => y === x ? { ...y, removed: { ...y.removed, at: drag.at } } : y)));
      setDrag(null); return;
    }
    if (drag && 'detail' in drag) {
      const d = settings.details?.find(x => x.id === drag.detail);
      if (d && (d.at?.[0] !== drag.at[0] || d.at?.[1] !== drag.at[1])) onChange({ ...settings, details: settings.details!.map(x => x.id === d.id ? { ...x, at: drag.at } : x) });
      setDrag(null); return;
    }
    if (drag && 'note' in drag) {
      const n = settings.notes?.find(x => x.id === drag.note);
      if (n && (n.at[0] !== drag.at[0] || n.at[1] !== drag.at[1])) onChange({ ...settings, notes: settings.notes!.map(x => x.id === n.id ? { ...x, at: drag.at } : x) });
      setDrag(null); return;
    }
    if (drag && !('pan' in drag)) {
      const d = settings.dimensions.find(x => x.id === drag.id);
      if (d && (d.place[0] !== drag.place[0] || d.place[1] !== drag.place[1])) {
        commitDims(settings.dimensions.map(x => x.id !== d.id ? x : x.kind === 'linear' && views
          ? { ...x, place: drag.place, orient: orientFor(pointIn(projectionOf(views, sheet ?? undefined, x.view)!, x.a), pointIn(projectionOf(views, sheet ?? undefined, x.view)!, x.b), drag.place) } : { ...x, place: drag.place }));
      }
    }
    setDrag(null);
  };
  const onWheel = (e: React.WheelEvent) => {
    const q = sheetPoint(e.clientX, e.clientY); if (!q) return;
    const k = Math.exp(e.deltaY * 0.0015), [x, y, w, h] = viewBox, nw = Math.min(W * 4, Math.max(20, w * k)), f = nw / w;
    setBox([q[0] - (q[0] - x) * f, q[1] - (q[1] - y) * f, nw, h * f]);
  };

  const remove = useCallback((id: string) => {
    if (settings.notes?.some(n => n.id === id)) { const notes = settings.notes.filter(n => n.id !== id), rest = { ...settings }; delete rest.notes; onChange(notes.length ? { ...rest, notes } : rest); }
    else commitDims(settings.dimensions.filter(d => d.id !== id));
    setSelected(null); setNoteDraft(null);
  },
    [settings]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement || e.metaKey || e.ctrlKey) return;
      if (e.key === 'Escape') { if (pending || targetChoices.length || reselectTarget) cancel(); else { setSelected(null); setSelectedTarget(null); setSelectedFrame(null); setTool('select'); } return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedFrame) {
        e.preventDefault();
        const frames = (settings.frames ?? []).filter(frame => frame.dim === undefined && frame.id === selectedFrame);
        if (frames.length === 1) removeFrame(frames[0]);
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedTarget) {
        e.preventDefault();
        if (commitTargets((settings.datumTargets ?? []).filter(t => t.id !== selectedTarget))) setSelectedTarget(null);
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected) { e.preventDefault(); remove(selected); return; }
      const t = ({ v: 'select', d: 'linear', o: 'diameter', r: 'radius', a: 'angle', n: 'note', e: 'detail', t: 'datum-target' } as Record<string, Tool>)[e.key.toLowerCase()];
      if (t) { setTool(t); cancel(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Dev/test hooks: a view point (model mm in the view) in client pixels, and the sheet's state.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as Record<string, unknown>;
    w.__studioDrawingAt = (view: DimView, u: number, v: number) => {
      const m = svg.current?.getScreenCTM(), at = layout && placementOf(layout, sheet ?? undefined, view); if (!m || !at) return null;
      const q = toSheet(at, [u, v]), p = new DOMPoint(q[0], q[1]).matrixTransform(m); return { x: p.x, y: p.y };
    };
    w.__studioDrawing = () => sheet && { scale: layout?.scale, dimensions: sheet.dimensions.map(r => r.ok ? { id: r.dim.id, text: r.text, value: r.value } : { id: r.dim.id, lost: r.reason }),
      hidden: Object.fromEntries(VIEW_IDS.map(id => [id, views![id].edges.reduce((n, e) => n + e.pieces.filter(p => !p.visible).length, 0)])),
      section: cutA ? (cutA.result.ok ? { rings: cutA.result.rings.length, edges: cutA.result.projection.edges.length } : { error: cutA.result.error }) : null,
      sections: (cutsMade ?? []).map(c => ({ id: c.id, view: c.view, at: c.at, ...(c.result.ok ? { rings: c.result.rings.length, edges: c.result.projection.edges.length } : { error: c.result.error }) })),
      placedSections: (layout?.sections ?? []).map(p => ({ id: p.section, of: p.of, box: p.box })),
      apartSections: (sheet.sections ?? []).filter(x => x.form).map(x => ({ id: x.id, form: x.form, ...(x.on ? { on: x.on } : {}), scale: x.placement.scale, box: x.placement.box, edges: x.projection.edges.length })),
      details: (sheet.details ?? []).map(d => ({ id: d.id, view: d.view, scale: d.scale, box: d.placement.box, edges: d.projection.edges.length })),
      boxes: Object.fromEntries(VIEW_IDS.map(id => [id, layout!.views[id].box])), breaks: Object.fromEntries(VIEW_IDS.filter(id => layout!.views[id].breaks).map(id => [id, layout!.views[id].breaks])),
      issues: issues.map(x => ({ code: x.code, severity: x.severity, ...(x.fix ? { fix: x.fix.kind } : {}), ...(x.tables ? { tables: x.tables } : {}) })),
      tables: (sheet.tables ?? []).map(x => ({ id: x.id, box: x.box, ...(x.error ? { error: x.error } : {}) })),
      ...(sheet.welds ? { welds: { placed: sheet.welds.placed.map(p => ({ label: p.label, view: p.view })), unshown: sheet.welds.unshown } } : {}),
      ...(sheet.balloons ? { balloons: { placed: sheet.balloons.placed.map(p => ({ no: p.no, item: p.item, view: p.view, edge: p.edge })), unclear: sheet.balloons.unclear, noEdge: sheet.balloons.noEdge } } : {}),
      suggestions: suggestions.map(x => ({ id: x.id, kind: x.kind, estimate: x.estimate })) };
    // (G24: the drawing's annotations on the model, for the GPU lane's 3D display and the flow.)
    w.__studioAnnotations = () => sheet && layout && views ? modelAnnotations({ views, layout, settings, sheet, ...(weldJoints ? { welds: weldJoints } : {}) }) : null;
    return () => { delete w.__studioDrawingAt; delete w.__studioDrawing; delete w.__studioAnnotations; };
  }, [layout, sheet, views, cutsMade, issues, suggestions, settings, weldJoints]);

  const exportSvg = () => { if (sheet) downloadBytes(new TextEncoder().encode(sheetSvg(sheet, title)), `${fileName}.svg`, 'image/svg+xml'); };
  const exportPdf = () => {
    if (!sheet) return;
    downloadBytes(sheetPdf(sheet, title), `${fileName}.pdf`, 'application/pdf');
    const missing = pdfMissing(sheet);
    if (missing.length) onToast({ title: 'PDF written, with some characters as ?', hint: `The PDF's standard fonts cannot show ${missing.map(c => `“${c}”`).join(' ')}: they print as ?. The SVG export keeps them.`, detail: '' });
  };
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
  /**
   * Auto (R14.1–R14.3, O2–O4): the views chosen and laid out with room for their dimensions, the scale and sheet that
   * give a clean drawing, then Auto-dimension; its own earlier dimensions replaced, those placed by hand kept.
   */
  const autoDimension = async () => {
    if (!views || scope.kind === 'assembly') return;
    // The front's side by information (R14.3b), when nothing placed by hand ties it: the part projected for it first.
    let base = { views, settings, sections: cuts };
    const pick = frontByInformation(views, settings);
    // (O174: the turned part projected as the sheet is, its bought elements out.)
    if (pick) {
      const ts = turnSections(settings, pick.orientation), list = Array.isArray(ts) ? ts : [];
      const r = await engine.drawing(model, { tangentEdges: !!settings.tangent, ...(list.length ? { sections: list } : {}), ...(pick.orientation !== 'y-' ? { orientation: pick.orientation as 'x+' } : {}), made: drawsMadeOnly(settings) });
      if (currentModel.current !== model) return;
      const turned = r.ok ? reorient(views, r.views, settings, pick.orientation) : null;
      if (r.ok && turned?.ok) base = { views: r.views, settings: turned.settings, sections: sheetSections(r.sections ?? []) };
    }
    const { settings: next, report } = autoLayout({ views: base.views, settings: base.settings, elements, callout, locationOwner, fitMiss: fitMissOf, meta: { title, date: today(), source, threads, tableContent: tableContentOf, welds: weldJoints, bodyFaces, ...(bom ? { bom } : {}) }, ...(base.sections.length ? { sections: base.sections } : {}) });
    onChange(next);
    const a = report.dimensions.added, n = a.overall + a.levels + a.holePositions + a.pitches + a.callouts + report.dimensions.keys;
    const side = base.views !== views && pick ? `, the front seen from ${SIDE_NAMES[pick.orientation]} (${pick.why})` : '';
    const where = `${report.sheet} at ${scaleLabel(report.scale)}${side}${report.dropped.length ? `, without the ${report.dropped.join(' and ')} view (it shows nothing the others do)` : ''}`;
    const notes = [...report.dimensions.skipped.map(x => `${x.what} (${x.view}): ${x.why}`), ...report.left.map(x => x.message), ...(report.readable ? [] : [`The smallest hole is under ${MIN_HOLE_ON_PAPER_MM} mm on paper at this scale: a larger sheet reads better.`])];
    onToast({ title: `${n} dimension${n === 1 ? '' : 's'} placed · ${where}`, hint: `${a.overall} overall, ${plural(a.levels, 'step')}, ${plural(a.holePositions + a.pitches, 'hole position')}, ${plural(a.callouts, 'callout')}${report.dimensions.kept ? `; ${report.dimensions.kept} of yours kept` : ''}${report.left.length ? `; ${plural(report.left.length, 'issue')} left` : ''}.`, detail: notes.join('\n') });
  };
  /** Another front side (R14.3b, O7): the annotations re-mapped to the views showing their axes, or refused, typed. */
  const turnTo = async (o: Orientation) => {
    if (!views || o === (settings.orientation ?? 'y-')) return;
    // (O174: projected as the sheet is — a part's without its bought elements.)
    const r = await engine.drawing(model, { tangentEdges: !!settings.tangent, ...(o !== 'y-' ? { orientation: o as 'x+' } : {}), made: drawsMadeOnly(settings) });
    if (currentModel.current !== model) return;
    if (!r.ok) { onToast({ title: 'Could not turn the drawing', hint: r.error, detail: '' }); return; }
    const t = reorient(views, r.views, settings, o);
    if (!t.ok) { onToast({ title: 'The drawing was not turned', hint: t.message, detail: t.code === 'ORIENTATION_REMAP_FAILED' ? t.failed.map(f => `${f.dim}: ${f.was} → ${f.now}`).join('\n') : '' }); return; }
    onChange(t.settings);
    if (t.moved.length) onToast({ title: `Front now seen from ${SIDE_NAMES[o]}`, hint: `Annotations moved with their axes: ${t.moved.map(m => `${m.from} → ${m.to}`).join(', ')}.`, detail: '' });
  };
  const [dxfVersion, setDxfVersion] = useState<DxfVersion>('AC1015');
  const dxfFailed = (e: unknown) => onToast({ title: 'Could not write the DXF', hint: 'Nothing was downloaded.', detail: e instanceof Error ? e.message : String(e) });
  const exportDxf = () => {
    if (!sheet || !layout) return;
    try {
      const r = sheetDxf(sheet, layout, dxfVersion);
      downloadBytes(r.bytes, `${fileName}.dxf`, 'image/vnd.dxf');
      // R12 has no ellipses, splines, hatches, line weights or units: say what was changed to fit it.
      if (r.report.r12) { const x = r.report.r12, n = x.ellipses + x.splines; onToast({ title: 'DXF R12 written', hint: `${n ? `${n} curve${n > 1 ? 's' : ''} as polylines within 0.001 mm; ` : ''}${x.hatches ? 'hatching as lines; ' : ''}no line weights or units in R12 (the drawing is in mm).`, detail: '' }); }
    } catch (e) { dxfFailed(e); }
  };
  // (O148 X1: the section chosen — the first by default — alone as a 1:1 DXF.)
  const dxfCut = cuts.find(c => c.id === dxfSection) ?? cuts[0];
  const exportSectionDxf = () => {
    if (!dxfCut) return;
    try { downloadBytes(writeDxf(sectionDxfDocument(dxfCut), { version: dxfVersion }).bytes, `${fileName}-section-${dxfCut.id}-${dxfCut.id}.dxf`, 'image/vnd.dxf'); } catch (e) { dxfFailed(e); }
  };
  useEffect(() => { if (error && !empty) onToast({ title: 'Could not draw the part', hint: 'Fix the model’s errors first, then open the drawing again.', detail: error }); }, [error, empty]);

  // What follows the cursor: the snap, the hovered edge, and the dimension being placed or dragged.
  const overlay = useMemo(() => {
    if (!layout || !views) return '';
    const parts: string[] = [];
    const P = (x: DimView) => placementOf(layout, sheet ?? undefined, x)!, R = (x: DimView) => projectionOf(views, sheet ?? undefined, x)!;
    const v = hover ? P(hover.view) : null;
    if (pending?.kind === 'note' && hover) {
      const t = toSheet(layout.views[pending.leader.view], pending.leader.at);
      parts.push(`<g class="dw-preview"><line x1="${t[0]}" y1="${t[1]}" x2="${hover.q[0]}" y2="${hover.q[1]}" stroke-width="0.25"/></g><circle class="dw-pick" cx="${t[0]}" cy="${t[1]}" r="0.9"/>`);
      return parts.join('');
    }
    if (pending?.kind === 'detail') {
      const c = toSheet(P(pending.view), pending.center), r = hover ? Math.hypot(hover.q[0] - c[0], hover.q[1] - c[1]) : 0;
      parts.push(`<circle class="dw-pick" cx="${c[0]}" cy="${c[1]}" r="0.9"/>`);
      if (r > 0) parts.push(`<g class="dw-preview"><circle cx="${c[0]}" cy="${c[1]}" r="${r}" fill="none" stroke-width="0.25"/></g>`);
      return parts.join('');
    }
    if (pending?.kind === 'datum-line') {
      const q = toSheet(P(pending.view), pending.from);
      parts.push(`<circle class="dw-pick" cx="${q[0]}" cy="${q[1]}" r="0.9"/>`);
      if (hover) parts.push(`<g class="dw-preview"><line x1="${q[0]}" y1="${q[1]}" x2="${hover.q[0]}" y2="${hover.q[1]}" stroke-width="0.25"/></g>`);
      return parts.join('');
    }
    if (pending?.kind === 'datum-target') {
      const resolved = resolveDatumTarget(views[pending.view], pending.target);
      if (resolved.ok) {
        const q = toSheet(P(pending.view), inView(views[pending.view], resolved.at));
        parts.push(`<circle class="dw-pick" cx="${q[0]}" cy="${q[1]}" r="0.9"/>`);
        if (hover) parts.push(`<g class="dw-preview"><line x1="${q[0]}" y1="${q[1]}" x2="${hover.q[0]}" y2="${hover.q[1]}" stroke-width="0.25"/></g>`);
      }
      return parts.join('');
    }
    if (pending?.kind === 'standalone-frame') {
      if (hover) parts.push(`<circle class="dw-pick" cx="${hover.q[0]}" cy="${hover.q[1]}" r="0.9"/>`);
      return parts.join('');
    }
    const placing = pending && hover && pending.kind !== 'note' && ((pending.kind !== 'linear' && pending.kind !== 'angle') || pending.b);
    if (pending?.kind === 'angle') for (const ref of [pending.a, ...(pending.b ? [pending.b] : [])]) {
      const l = resolveLine(R(pending.view), ref);
      if (l) parts.push(`<g class="dw-hover">${marksSvg([{ kind: 'line', a: toSheet(P(pending.view), l[0]), b: toSheet(P(pending.view), l[1]), pen: 'visible' }])}</g>`);
    }
    if (pending?.kind === 'linear') for (const ref of [pending.a, ...(pending.b ? [pending.b] : [])]) {
      const q = toSheet(P(pending.view), pointIn(R(pending.view), ref)); parts.push(`<circle class="dw-pick" cx="${q[0]}" cy="${q[1]}" r="0.9"/>`);
    }
    if (placing && hover) {
      const at = fromSheet(P(pending.view), hover.q);
      const d: DrawingDimension = pending.kind === 'linear'
        ? { id: 'preview', view: pending.view, kind: 'linear', a: pending.a, b: pending.b!, orient: orientFor(pointIn(R(pending.view), pending.a), pointIn(R(pending.view), pending.b!), at), place: at }
        : pending.kind === 'angle' ? { id: 'preview', view: pending.view, kind: 'angle', a: pending.a, b: pending.b!, place: at }
        : { id: 'preview', view: pending.view, kind: pending.kind, edge: pending.edge, near: pending.near, place: at };
      const r = resolveDimension({ ...views, [pending.view]: R(pending.view) }, d);
      if (r.ok) parts.push(`<g class="dw-preview">${marksSvg(dimensionMarks(P(pending.view), r))}</g>`);
    } else if (hover && v && tool === 'datum-target' && isViewId(hover.view)) {
      for (const point of (bodies ? endpointSnap(views[hover.view], hover.at, 9 * mmPerPx() / v.scale, bodies).points : [])) {
        const q = toSheet(v, inView(views[hover.view], point.near));
        parts.push(`<circle class="dw-snap" cx="${q[0]}" cy="${q[1]}" r="1.4"/>`);
      }
    } else if (hover && v && tool !== 'select') {
      if (hover.snap && tool === 'linear') { const q = toSheet(v, hover.snap.at); parts.push(`<circle class="dw-snap" cx="${q[0]}" cy="${q[1]}" r="1.4"/>`); }
      else if (hover.edge && (tool !== 'linear' || !pending)) {
        const ok = tool === 'linear' || tool === 'angle' ? hover.edge.kind !== 'circle' && hover.edge.kind !== 'curve' : !!hover.edge.circle && roundIn(R(hover.view), hover.edge);
        if (ok) parts.push(`<g class="dw-hover">${marksSvg(hover.edge.pieces.map(p => curveMark(v, p.curve, 'visible')))}</g>`);
      }
    }
    return parts.join('');
  }, [layout, views, bodies, hover, pending, tool]);

  // The dimension being dragged is drawn where it goes.
  const shownMarkup = useMemo(() => {
    if (!drag || 'pan' in drag || !views || !layout || !sheet) return sheetMarkup;
    if ('target' in drag) return sheetGroupsSvg(buildSheet(views, layout, { ...settings, datumTargets: (settings.datumTargets ?? []).map(t => t.id === drag.target ? { ...t, place: drag.place } : t) }, { title, date: today(), callout, threads, tableContent: tableContentOf, welds: weldJoints, bodyFaces, ...(bom ? { bom } : {}) }, cuts), selected, selectedTarget);
    if ('detail' in drag) return sheetGroupsSvg(buildSheet(views, layout, { ...settings, details: (settings.details ?? []).map(d => d.id === drag.detail ? { ...d, at: drag.at } : d) }, { title, date: today(), callout, threads, tableContent: tableContentOf, welds: weldJoints, bodyFaces, ...(bom ? { bom } : {}) }, cuts), selected, selectedTarget);
    if ('removed' in drag) return sheetGroupsSvg(buildSheet(views, layout, withSections(settings, sectionsOf(settings).map(x => x.id === drag.removed && x.removed ? { ...x, removed: { ...x.removed, at: drag.at } } : x)), { title, date: today(), callout, threads, tableContent: tableContentOf, welds: weldJoints, bodyFaces, ...(bom ? { bom } : {}) }, cuts), selected, selectedTarget);
    if ('note' in drag) return sheetGroupsSvg(buildSheet(views, layout, { ...settings, notes: (settings.notes ?? []).map(n => n.id === drag.note ? { ...n, at: drag.at } : n) }, { title, date: today(), callout, threads, tableContent: tableContentOf, welds: weldJoints, bodyFaces, ...(bom ? { bom } : {}) }, cuts), selected, selectedTarget);
    const dims = settings.dimensions.map(d => d.id === drag.id ? (d.kind === 'linear' ? { ...d, place: drag.place, orient: orientFor(pointIn(projectionOf(views, sheet ?? undefined, d.view)!, d.a), pointIn(projectionOf(views, sheet ?? undefined, d.view)!, d.b), drag.place) } : { ...d, place: drag.place }) : d);
    return sheetGroupsSvg(buildSheet(views, layout, { ...settings, dimensions: dims }, { title, date: today(), callout, threads, tableContent: tableContentOf, welds: weldJoints, bodyFaces, ...(bom ? { bom } : {}) }, cuts), selected, selectedTarget);
  }, [drag, views, layout, sheet, sheetMarkup, settings, title, selected, selectedTarget, weldJoints, bom]);

  const hint = message ?? (pending ? (pending.kind === 'standalone-frame' ? 'Click where the standalone frame goes · Esc cancels' : pending.kind === 'datum-target' ? 'Click where the target symbol goes · Esc cancels' : pending.kind === 'datum-line' ? 'Now the other end of the target line · Esc cancels' : pending.kind === 'note' ? 'Click where the note’s text goes · Esc cancels' : pending.kind === 'detail' ? 'Now how far the detail’s circle reaches · Esc cancels' : pending.kind === 'angle' && !pending.b ? 'Now the second edge · Esc cancels' : pending.kind === 'linear' && !pending.b ? 'Now the second point · Esc cancels' : 'Click where the dimension goes · Esc cancels') : TOOLS.find(t => t.tool === tool)!.hint);
  const selDim = selected ? settings.dimensions.find(d => d.id === selected) : undefined, selNote = selected ? settings.notes?.find(n => n.id === selected) : undefined;

  return (
    <div className="dw" aria-label="Drawing">
      <nav className="card dw-tools" aria-label="Drawing tools">
        {TOOLS.map(t => <button key={t.tool} className={'tool' + (tool === t.tool ? ' on' : '')} aria-label={t.label} title={`${t.label} (${t.key === 'Ø' ? 'O' : t.key})`}
          onClick={() => { setTool(t.tool); cancel(); }}><Icon name={t.icon} /></button>)}
        <div className="sep" />
        <button className="tool" aria-label="Fit sheet" title="Fit the sheet" onClick={() => setBox(null)}><Icon name="fit_screen" /></button>
      </nav>

      <div className="dw-canvas">
        <div className="dw-paper">
          {layout && <svg ref={svg} viewBox={viewBox.join(' ')} className={drag && 'pan' in drag ? 'dw-pan' : ''} aria-label="Drawing sheet" data-scale={layout.scale}
            onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={() => setHover(null)} onWheel={onWheel}>
            <rect className="dw-sheet" x={0} y={0} width={W} height={H} fill="#fff" />
            <g fill="none" stroke="#000" strokeLinecap="round" strokeLinejoin="round" fontFamily="Helvetica, Arial, sans-serif" dangerouslySetInnerHTML={{ __html: shownMarkup }} />
            <g dangerouslySetInnerHTML={{ __html: overlay }} />
            {selectedTarget && !(drag && 'target' in drag) && sheet?.groups.filter(g => g.datumTarget && g.id === selectedTarget).length === 1 && <g className="dw-hover" pointerEvents="none" aria-label="Selected datum target" dangerouslySetInnerHTML={{ __html: marksSvg(sheet.groups.find(g => g.datumTarget && g.id === selectedTarget)!.marks) }} />}
            {selectedFrame && sheet?.groups.filter(g => g.standaloneFrame && g.id === selectedFrame).length === 1 && <g className="dw-hover" pointerEvents="none" aria-label="Selected standalone frame" dangerouslySetInnerHTML={{ __html: marksSvg(sheet.groups.find(g => g.standaloneFrame && g.id === selectedFrame)!.marks) }} />}
            {referenceInspection?.markup && <g className="dw-hover" pointerEvents="none" aria-label="Reference candidate preview" dangerouslySetInnerHTML={{ __html: referenceInspection.markup }} />}
          </svg>}
          {busy && !views && <div className="dw-busy">Projecting views…</div>}
          {!busy && !views && <div className="dw-busy">{error ?? 'Nothing to draw.'}</div>}
        </div>
        <div className={'card dw-hint' + (message ? ' warn' : '')} role="status">
          <span>{hint}</span>
          {(selected || selectedTarget || selectedFrame) && <span><Kbd>Del</Kbd> remove</span>}
          <span><Kbd>V</Kbd> <Kbd>D</Kbd> <Kbd>O</Kbd> <Kbd>R</Kbd> <Kbd>A</Kbd> <Kbd>N</Kbd> <Kbd>E</Kbd> <Kbd>T</Kbd> tools</span>
        </div>
      </div>

      <aside className="card dw-panel" aria-label="Drawing settings">
        {referenceInspection && <div role="status" aria-label="Reference preview" style={{ marginBottom: 8 }}>{referenceInspection.message}</div>}
        <SheetSettings sheet={{ scopeRead, scope, views, layout, sectionA, sectionList, cutA, cutsMade, hasSheet, hasFrame, kinds, hasBought, doc, title, busy }} settings={settings} sourceDoc={sourceDoc} fileName={fileName} onChange={onChange} onToast={onToast}
          onScopeChanged={() => { setPending(null); setSelected(null); setSelectedTarget(null); setSelectedFrame(null); setTargetChoices([]); setReselectTarget(null); setHover(null); setDrag(null); }} turnTo={turnTo} />

        <DetailsList settings={settings} sheet={sheet} layout={layout} onChange={onChange} />

        <BreaksList settings={settings} views={views} onChange={onChange} onRefused={why => onToast({ title: 'Break unchanged', hint: why, detail: '' })} />

        <DatumsEditor settings={settings} views={views} scale={layout?.scale ?? 1} onChange={onChange} onRefused={setMessage} />

        <DatumTargetsEditor draft={targetDraft} onDraft={next => { if (next.kind !== targetDraft.kind && (pending?.kind === 'datum-line' || (pending?.kind === 'datum-target' && !pending.moving))) cancel(); setTargetDraft(next); }} settings={settings} views={busy ? null : views} hiddenViews={VIEW_IDS.filter(id => !!layout?.views[id].hidden)} selected={selectedTarget} choices={targetChoices} onChoose={chooseTarget} onSelect={id => { setSelectedTarget(id); setSelected(null); setTool('select'); cancel(); }}
          onAdd={() => { setTool('datum-target'); cancel(); }} onMove={target => { setTool('datum-target'); chooseTarget(target, true); }}
          onReselect={target => { cancel(); if (layout?.views[target.view].hidden) { setMessage('Show the target view before selecting its endpoint again.'); return; } setTool('datum-target'); setReselectTarget(target); setSelected(null); setSelectedTarget(target.id); setMessage(`Select the target endpoint again in the ${target.view} view. Its symbol position will be kept. Esc cancels.`); }}
          onCommit={commitTargets} onRefused={setMessage} />

        <StandaloneFramesEditor settings={settings} ready={!busy && !!views && !!layout} selected={selectedFrame}
          availableViews={([...VIEW_IDS, ...(sheet?.sections ?? []).map(x => `section:${x.id}` as DimView), ...(sheet?.details ?? []).map(x => `detail:${x.id}` as DimView)]).filter(id => { const placement = placementAt(id); return !!placement && !placement.hidden; })}
          onSelect={id => { cancel(); setSelected(null); setSelectedTarget(null); setSelectedFrame(id); setDrag(null); setTool('select'); }}
          onAdd={view => placeFrame(view)} onMove={frame => { if (frame.dim === undefined) placeFrame(frame.view, frame); }} onRemove={removeFrame} />

        <IssuesList issues={issues} scope={scope} views={views} fixIssue={fixIssue} fixEvery={fixEvery} onSelectDimension={d => { setSelected(d); setTool('select'); }} />

        <TolerancingList suggestions={suggestions} settings={settings} views={views} onChange={onChange} acceptEvery={acceptEvery} />

        <DimensionsList sheet={sheet} views={views} layout={layout} scope={scope} settings={settings} selected={selected} onSelect={id => { setSelected(id); setTool('select'); }} remove={remove} autoDimension={autoDimension} />

        <ToleranceEditor selDim={selDim} settings={settings} tolDraft={tolDraft} setTolDraft={setTolDraft} commitDims={commitDims} setMessage={setMessage} />

        <FrameEditor key={selectedFrame ? `frame:${selectedFrame}` : selDim?.id ?? 'none'} dim={selectedFrame ? undefined : selDim?.id} frameId={selectedFrame ?? undefined} settings={settings} onChange={onChange} onRefused={setMessage} />

        <NotesList settings={settings} selected={selected} selNote={selNote} noteDraft={noteDraft} setNoteDraft={setNoteDraft} noteBox={noteBox} onSelect={n => { setSelected(n.id); setNoteDraft(n.text); setTool('select'); }} remove={remove} onChange={onChange} />

        <ExportActions sheet={sheet} layout={layout} views={views} cuts={cuts} settings={settings} dxfVersion={dxfVersion} setDxfVersion={setDxfVersion} dxfCut={dxfCut} setDxfSection={setDxfSection} exportSvg={exportSvg} exportPdf={exportPdf} exportDxf={exportDxf} exportSectionDxf={exportSectionDxf} />
      </aside>
    </div>
  );
}

/** Keep every visible straight-edge endpoint near the pointer. A 2D overlap is a choice, not a 3D match. */
function endpointSnap(pr: DrawingViews[ViewId], at: XY, tolerance: number, bodies: readonly BodyResult[]): { points: DatumTargetPoint[]; error?: string } {
  const out: DatumTargetPoint[] = [];
  for (const edge of pr.edges) {
    if (edge.kind !== 'line' || edge.circle || !edge.ends || !edge.pieces.some(piece => piece.visible)) continue;
    // Apply the existing snap routine per edge so it cannot discard another edge's overlapping endpoint.
    const nearby = snapPoints({ ...pr, edges: [edge] }).some(snap => snap.ref.at === 'end' && Math.hypot(snap.at[0] - at[0], snap.at[1] - at[1]) < tolerance);
    if (!nearby) continue;
    const matches = bodies.flatMap(body => body.mesh.edges.filter(e => e.names.includes(edge.name)).map(e => ({ body, edge: e })));
    if (matches.length !== 1 || !matches[0].edge.straight) return { points: [], error: 'The target edge needs one current straight edge in the drawing bodies. No target was added.' };
    const signature = signaturesOf(matches[0].body).edges.get(edge.name);
    if (!signature || signature.kind !== 'line') return { points: [], error: 'The current target edge has no unique straight-edge signature. No target was added.' };
    // A view along the edge can project both 3D ends to the same 2D snap. Keep both choices.
    for (const point of edge.ends) {
      const q = inView(pr, point);
      if (Math.hypot(q[0] - at[0], q[1] - at[1]) < tolerance) {
        const endpoint = datumTargetEndpoint(edge.ends, point);
        if (!endpoint) return { points: [], error: 'The current target endpoint has no distinct min/max identity. No target was added.' };
        out.push({ edge: edge.name, at: 'end', near: [...point] as Vec3, endpoint, sig: toSig(signature) });
      }
    }
  }
  return { points: out };
}

/** A dimension point in a view's coordinates, by its stored model point (it may since have moved). */
function pointIn(pr: DrawingViews[ViewId], ref: DimPoint): XY {
  for (const e of pr.edges) if (e.name === ref.edge) {
    const cands = ref.at === 'center' ? (e.circle ? [e.circle.center] : []) : (e.ends ?? []);
    let best: readonly number[] | null = null, bd = Infinity;
    for (const p of cands) { const d = Math.hypot(p[0] - ref.near[0], p[1] - ref.near[1], p[2] - ref.near[2]); if (d < bd) { bd = d; best = p; } }
    if (best) return inView(pr, best);
  }
  return inView(pr, ref.near);
}

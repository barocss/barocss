// G17: the 3D skeleton sketch in the App — a session on a new or an existing skeleton node (FRf/FRg, the outer lane's
// model and solver): points placed with the pointer (on the sketch's points, the bodies' corners, an axis through the
// last point, else the work plane through it), segments drawn point to point, points dragged and solved live, the
// constraints a selection offers, the diagnosis (well, under, over, conflict) drawn on the points and marks, a session
// undo, and Apply writing the node once (stored solved, as the model keeps it). Without a session, the document's
// skeletons drawn faint.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { featureLabel, withNode, type ModelNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import type { Command } from '@barocss/cad-model/app/commands';
import type { Axis3, BoundConstraint3D, V3 } from '@barocss/cad-model/frames/sketch3d';
import { checkSkeletonEdit, SKELETON_CODES, solvedSkeleton } from '@barocss/cad-model/frames/skeleton';
import { firstProblem, isRefusal } from '@barocss/cad-model/engine/refusal';
import type { ToolView, ViewportTool } from '../viewport/Viewport';
import { diagnoseDraft, dragSolve, NO_SELECTION, nearestSnap, onAxisLine, onGrid, onPlane, removeFromDraft, segmentAt, type Diagnosis, type Selection3D, type SkeletonDraft, type Snap, type WorkPlane } from './skeletonTool';
import { SkeletonMarks } from './SkeletonMarks';

type SkeletonNode = Extract<ModelNode, { kind: 'skeleton' }>;
/** The palette's command for it (the studio's own: the model's command list is the outer lane's). */
export const SKETCH3D_COMMAND: Command = {
  id: 'sketch3d', label: '3D sketch', icon: 'polyline', group: 'create', keywords: '3d sketch',
  hint: 'Points and lines in space, constrained and solved (a skeleton frames follow)',
  available: () => ({ ok: true }),
};

export interface SkeletonSession {
  /** The node edited, or null for a new skeleton. */
  node: number | null;
  draft: SkeletonDraft;
  name?: string;
}
/** Copy the authored draft before solving; this is also the new-node shape used by Apply. */
function copySkeletonPoint(p: V3): [number, number, number] { return [p[0], p[1], p[2]]; }
export function skeletonSessionNode(session: SkeletonSession, previous?: SkeletonNode): SkeletonNode {
  const node: SkeletonNode = { ...previous, kind: 'skeleton', points: session.draft.points.map(copySkeletonPoint), segments: session.draft.segments };
  // An empty draft list removes constraints; spreading metadata must not resurrect the old list.
  delete node.constraints; delete node.name;
  if (session.name) node.name = session.name;
  if (session.draft.constraints.length) node.constraints = session.draft.constraints;
  return node;
}
export type SkeletonMode = 'draw' | 'select';
export interface SkeletonEditor {
  readonly session: SkeletonSession | null;
  begin(node: number | null): void;
  readonly tool: ViewportTool | null;
  readonly diagnosis: Diagnosis | null;
  readonly selection: Selection3D;
  select(sel: Selection3D): void;
  readonly mode: SkeletonMode; setMode(m: SkeletonMode): void;
  readonly plane: WorkPlane; setPlane(p: WorkPlane): void;
  readonly axis: Axis3 | null; setAxis(a: Axis3 | null): void;
  addConstraint(c: BoundConstraint3D): void;
  /** A length's, distance's or angle's value set (a number), the sketch solved again. */
  setValue(k: number, v: number): void;
  removeSelected(): void;
  undo(): void; redo(): void;
  apply(): void; cancel(): void;
  onKey(e: KeyboardEvent): boolean;
  /** The last drag: whether the dragged point reached the pointer (for the flow and the panel). */
  readonly lastDrag: { index: number; reached: boolean } | null;
}

/** The draft's points set from a solve where it met them (anything short of a conflict), else kept. */
function settled(d: SkeletonDraft, parameters: Readonly<Record<string, number>>): SkeletonDraft {
  const r = diagnoseDraft(d, parameters);
  return 'error' in r || r.solve.status === 'conflict' ? d : { ...d, points: r.solve.points };
}

export function useSkeletonEditor(doc: StudioDoc, commit: (next: StudioDoc) => void, fail: (title: string, hint: string) => void, snapStep: number): SkeletonEditor {
  const [session, setSession] = useState<SkeletonSession | null>(null);
  const [selection, select] = useState<Selection3D>(NO_SELECTION);
  const [mode, setMode] = useState<SkeletonMode>('draw');
  const [plane, setPlane] = useState<WorkPlane>('xy');
  const [axis, setAxis] = useState<Axis3 | null>(null);
  const [lastDrag, setLastDrag] = useState<{ index: number; reached: boolean } | null>(null);
  const [, redraw] = useState(0);
  /** The point the next segment starts from (drawing), the pointer's place and snap (drawn), a point being dragged. */
  const chain = useRef<number | null>(null);
  const hover = useRef<{ at: V3 | null; snap: Snap | null }>({ at: null, snap: null });
  const drag = useRef<{ index: number; from: V3; x: number; y: number; moved: boolean; live: V3[] | null } | null>(null);
  const press = useRef<{ x: number; y: number; snap: Snap | null } | null>(null);
  const history = useRef<{ past: SkeletonDraft[]; future: SkeletonDraft[] }>({ past: [], future: [] });
  const params = doc.parameters;
  const ref = useRef({ session, selection, mode, plane, axis, params, snapStep });
  ref.current = { session, selection, mode, plane, axis, params, snapStep };

  const diagnosis = useMemo(() => session ? diagnoseDraft(session.draft, params) : null, [session, params]);
  const from = useRef<ModelNode | null>(null);

  /** The draft changed by a step (undone by ⌘Z). */
  const step = useCallback((next: SkeletonDraft) => {
    const s = ref.current.session; if (!s) return;
    history.current.past.push(s.draft); history.current.future = [];
    setSession({ ...s, draft: next });
  }, []);

  const begin = useCallback((node: number | null) => {
    const n = node === null ? null : doc.nodes[node];
    if (n && n.kind !== 'skeleton') return;
    from.current = n ?? null;
    const draft: SkeletonDraft = n ? { points: n.points.map(p => p.map(Number) as V3), segments: n.segments.map(s => [...s] as [number, number]), constraints: [...(n.constraints ?? [])] } : { points: [], segments: [], constraints: [] };
    setSession({ node, draft, ...(n?.name ? { name: n.name } : {}) }); select(NO_SELECTION); setMode(n ? 'select' : 'draw'); setAxis(null); setLastDrag(null);
    chain.current = null; drag.current = null; history.current = { past: [], future: [] };
  }, [doc]);

  // The part changed under an edit (a file opened, the agent's edit): the session ends with nothing written, and says so.
  useEffect(() => {
    if (!session || session.node === null || doc.nodes[session.node] === from.current) return;
    setSession(null); from.current = null;
    fail('3D sketch ended', 'The part changed while the skeleton was being edited; nothing was written. Edit it again.');
  }, [doc, session, fail]);

  const end = useCallback(() => { setSession(null); select(NO_SELECTION); chain.current = null; drag.current = null; from.current = null; }, []);
  const apply = useCallback(() => {
    const s = ref.current.session; if (!s) return;
    if (!s.draft.points.length) { end(); return; }
    const base = skeletonSessionNode(s, s.node === null ? undefined : doc.nodes[s.node] as SkeletonNode);
    let solved: ReturnType<typeof solvedSkeleton>;
    try { solved = solvedSkeleton(base, doc.parameters); }
    catch (e) { if (!isRefusal(e, ...SKELETON_CODES)) throw e; fail('The 3D sketch cannot be applied', e.message); return; }
    const node = solved.node as SkeletonNode;
    if (s.node === null) commit(withNode(doc, node));
    else {
      const why = firstProblem(checkSkeletonEdit(doc.nodes, s.node, node));
      if (why) { fail(`${featureLabel(doc.nodes[s.node], s.node, doc.nodes)} cannot change so`, why); return; }
      commit({ ...doc, nodes: doc.nodes.map((n, i) => i === s.node ? node : n) });
    }
    end();
  }, [doc, commit, fail, end]);

  const addConstraint = useCallback((c: BoundConstraint3D) => {
    const s = ref.current.session; if (!s) return;
    step(settled({ ...s.draft, constraints: [...s.draft.constraints, c] }, ref.current.params));
    select({ ...NO_SELECTION, constraints: [s.draft.constraints.length] });
  }, [step]);
  const setValue = useCallback((k: number, v: number) => {
    const s = ref.current.session, c = s?.draft.constraints[k]; if (!s || !c || !(v > 0)) return;
    const next = c.kind === 'angle' ? { ...c, degrees: v } : c.kind === 'length' || c.kind === 'distance' ? { ...c, value: v } : c;
    step(settled({ ...s.draft, constraints: s.draft.constraints.map((x, i) => i === k ? next : x) }, ref.current.params));
  }, [step]);
  const removeSelected = useCallback(() => {
    const s = ref.current.session, sel = ref.current.selection; if (!s || (!sel.points.length && !sel.segments.length && !sel.constraints.length)) return;
    step(removeFromDraft(s.draft, sel)); select(NO_SELECTION); chain.current = null;
  }, [step]);
  const undo = useCallback(() => {
    const s = ref.current.session, prev = history.current.past.pop(); if (!s || !prev) return;
    history.current.future.push(s.draft); setSession({ ...s, draft: prev }); select(NO_SELECTION); chain.current = null;
  }, []);
  const redo = useCallback(() => {
    const s = ref.current.session, next = history.current.future.pop(); if (!s || !next) return;
    history.current.past.push(s.draft); setSession({ ...s, draft: next });
  }, []);

  /** Where the pointer puts a point: a snap, else the axis through the chain's last point, else the work plane through it (or the origin), on the grid. */
  const placeAt = (x: number, y: number, view: ToolView): { at: V3; snap: Snap | null } | null => {
    const { session: s, plane: pl, axis: ax, snapStep: grid } = ref.current; if (!s) return null;
    const snap = nearestSnap(x, y, view.project, s.draft.points, view.vertices());
    if (snap) return { at: snap.at, snap };
    const { origin, dir } = view.ray(x, y), last = chain.current !== null ? s.draft.points[chain.current] : null;
    if (ax && last) { const p = onAxisLine(origin, dir, last, ax); return p ? { at: snapAlong(p, last, ax, grid), snap: null } : null; }
    const p = onPlane(origin, dir, pl, last ?? [0, 0, 0]);
    return p ? { at: onGrid(p, grid, pl), snap: null } : null;
  };

  const tool = useMemo((): ViewportTool | null => {
    const skeletons = doc.nodes.flatMap((n, i) => n.kind === 'skeleton' && !n.suppressed ? [{ i, n }] : []);
    if (!session && !skeletons.length) return null;
    return {
      down(x, y, view, e) {
        const { session: s, mode: m } = ref.current; if (!s) return false;
        const snap = nearestSnap(x, y, view.project, s.draft.points, [], 9);
        if (m === 'select') {
          if (snap?.kind === 'point') {
            const additive = e.shiftKey || e.metaKey || e.ctrlKey;
            if (!(additive && ref.current.selection.points.includes(snap.index))) select(sel => additive ? { ...sel, points: [...sel.points, snap.index] } : { ...NO_SELECTION, points: [snap.index] });
            drag.current = { index: snap.index, from: s.draft.points[snap.index], x, y, moved: false, live: null };
            return true;
          }
          const seg = segmentAt(x, y, view.project, s.draft.points, s.draft.segments);
          const additive = e.shiftKey || e.metaKey || e.ctrlKey;
          if (seg !== null) select(sel => additive ? (sel.segments.includes(seg) ? { ...sel, segments: sel.segments.filter(k => k !== seg) } : { ...sel, segments: [...sel.segments, seg] }) : { ...NO_SELECTION, segments: [seg] });
          else if (!additive) select(NO_SELECTION);
          return true;
        }
        press.current = { x, y, snap: snap?.kind === 'point' ? snap : null };
        return true;
      },
      move(x, y, view, e) {
        const s = ref.current.session; if (!s) return false;
        const d = drag.current;
        if (d && e.buttons & 1) {
          if (!d.moved && Math.hypot(x - d.x, y - d.y) < 3) return true;
          d.moved = true;
          // (On the work plane through where the point was, or along the axis lock; snapped to the corners and the grid.)
          const { origin, dir } = view.ray(x, y), ax = ref.current.axis, others = s.draft.points.filter((_, i) => i !== d.index);
          const snap = nearestSnap(x, y, view.project, others, view.vertices());
          const raw = snap ? snap.at : ax ? onAxisLine(origin, dir, d.from, ax) : onPlane(origin, dir, ref.current.plane, d.from);
          if (!raw) return true;
          const target = snap ? raw : ax ? snapAlong(raw, d.from, ax, ref.current.snapStep) : onGrid(raw, ref.current.snapStep, ref.current.plane);
          const r = dragSolve(s.draft, d.index, target, ref.current.params);
          if (!('error' in r)) { d.live = r.points; setLastDrag({ index: d.index, reached: r.reached }); }
          hover.current = { at: target, snap };
          return true;
        }
        // (A press on a point while drawing that moves becomes its drag.)
        const p = press.current;
        if (p?.snap?.kind === 'point' && e.buttons & 1 && Math.hypot(x - p.x, y - p.y) > 4) {
          drag.current = { index: p.snap.index, from: p.snap.at, x: p.x, y: p.y, moved: false, live: null }; press.current = null;
          return this.move(x, y, view, e);
        }
        if (ref.current.mode !== 'draw') { hover.current = { at: null, snap: nearestSnap(x, y, view.project, s.draft.points, [], 9) }; return true; }
        hover.current = placeAt(x, y, view) ?? { at: null, snap: null };
        return true;
      },
      up(x, y, view) {
        const s = ref.current.session; if (!s) return;
        const d = drag.current; drag.current = null;
        if (d) { if (d.moved && d.live) step({ ...s.draft, points: d.live }); return; }
        const p = press.current; press.current = null; if (!p) return;
        const at = p.snap ? { at: p.snap.at, snap: p.snap as Snap } : placeAt(x, y, view);
        if (!at) return;
        let draft = s.draft, index: number;
        if (at.snap?.kind === 'point') index = at.snap.index;
        else { index = draft.points.length; draft = { ...draft, points: [...draft.points, [...at.at] as V3] }; }
        const a = chain.current;
        if (a !== null && a !== index && !draft.segments.some(([i, j]) => (i === a && j === index) || (i === index && j === a))) draft = { ...draft, segments: [...draft.segments, [a, index]] };
        // (Back on a point it already had: the chain ends there, a loop closed.)
        chain.current = at.snap?.kind === 'point' && a !== null ? null : index;
        if (draft !== s.draft) step(draft);
      },
      marks(view) {
        const s = ref.current.session;
        return <SkeletonMarks view={view} skeletons={s ? skeletons.filter(k => k.i !== s.node).map(k => k.n) : skeletons.map(k => k.n)}
          draft={s ? { ...s.draft, points: drag.current?.live ?? s.draft.points } : null} diagnosis={s ? (drag.current?.live ? diagnoseDraft({ ...s.draft, points: drag.current.live }, ref.current.params) : diagnosis) : null}
          selection={ref.current.selection} chainFrom={ref.current.mode === 'draw' ? chain.current : null} hover={s ? hover.current : null} dragging={drag.current?.moved ? drag.current.index : null} plane={ref.current.plane} axis={ref.current.axis}
          onPickConstraint={(k, additive) => select(sel => additive ? { ...sel, constraints: sel.constraints.includes(k) ? sel.constraints.filter(c => c !== k) : [...sel.constraints, k] } : { ...NO_SELECTION, constraints: [k] })} />;
      },
    };
  }, [doc.nodes, session, diagnosis, step]);

  const onKey = useCallback((e: KeyboardEvent): boolean => {
    const s = ref.current.session; if (!s) return false;
    const typing = (e.target as HTMLElement | null)?.closest?.('input, textarea, select');
    if (typing && e.key !== 'Escape') return false;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return true; }
    if (e.metaKey || e.ctrlKey || e.altKey) return false;
    switch (e.key) {
      case 'Escape':
        if (chain.current !== null) chain.current = null;
        else if (ref.current.axis) setAxis(null);
        else if (ref.current.selection !== NO_SELECTION && (ref.current.selection.points.length || ref.current.selection.segments.length || ref.current.selection.constraints.length)) select(NO_SELECTION);
        else end();
        hover.current = { at: null, snap: null }; redraw(t => t + 1);
        return true;
      case 'Enter': e.preventDefault(); apply(); return true;
      case 'Delete': case 'Backspace': removeSelected(); return true;
      case 'x': case 'y': case 'z': { const a = e.key as Axis3; setAxis(ax => ax === a ? null : a); return true; }
      case 'l': setMode('draw'); return true;
      case 's': setMode('select'); chain.current = null; return true;
      case 'Tab': e.preventDefault(); setPlane(p => p === 'xy' ? 'xz' : p === 'xz' ? 'yz' : 'xy'); return true;
      case '1': setPlane('xy'); return true;
      case '2': setPlane('xz'); return true;
      case '3': setPlane('yz'); return true;
      // (Other letters are not the App's commands while it is open; F still frames.)
      default: return e.key.length === 1 && e.key.toLowerCase() !== 'f';
    }
  }, [apply, end, removeSelected, undo, redo]);

  return { session, begin, tool, diagnosis, selection, select, mode, setMode, plane, setPlane, axis, setAxis, addConstraint, setValue, removeSelected, undo, redo, apply, cancel: end, onKey, lastDrag };
}

/** A point on an axis line through `from`, its distance along the axis on the grid. */
function snapAlong(p: V3, from: V3, axis: Axis3, step: number): V3 {
  if (!(step > 0)) return p;
  const k = axis === 'x' ? 0 : axis === 'y' ? 1 : 2, out = [...from] as V3;
  out[k] = from[k] + Math.round((p[k] - from[k]) / step) * step;
  return out;
}

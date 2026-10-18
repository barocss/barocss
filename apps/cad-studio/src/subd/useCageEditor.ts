// R8.2 (D81): the cage editor in the App — a session on one subd node: its overlay, picking, the gizmo (Shift held
// as a drag starts: extrude), the body shown (while dragged: the quick limit preview; after: the exact body, built
// once per step), the keys (1 2 3 modes, Tab Box/Smooth, ⌘Z the session's undo, Enter Done, Esc Cancel), and Done
// writing the node once (one step of the document's undo; the timeline keeps its one feature).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { StudioDoc, ModelNode } from '../engine/doc';
import type { BodyResult, EvalResult } from '../engine/evaluate';
import { triangleMesh, type Vec3 } from '../engine/mesh';
import { refOf } from '../app/bodyRef';
import type { TransformGizmo } from '../viewport/gizmo';
import type { CageOverlay } from '../viewport/Viewport';
import { commitDrag, dragged, fullCage, previewTriangles, redoSession, runOp, select, selectionCentre, startSession, undoSession, validationOf, type CageHit, type CageMode, type CageOp, type CageSession } from './cageEdit';
import { mirrorCage } from '@barocss/cad';

type SubdNode = Extract<ModelNode, { kind: 'subd' }>;
export interface CageEditor {
  readonly session: CageSession | null;
  begin(node: number): boolean;
  overlay: CageOverlay | null;
  onPick(hit: CageHit | null, additive: boolean, grow?: 'loop' | 'ring'): void;
  gizmo: TransformGizmo | null;
  /** The bodies to show: the edited node's body replaced by the preview or the exact body of the session's cage. */
  shown(bodies: BodyResult[]): BodyResult[];
  setMode(m: CageMode): void; toggleSmooth(): void; op(o: CageOp): void; undo(): void; redo(): void; done(): void; cancel(): void;
  /** A key while editing: handled (true) or not. */
  onKey(e: KeyboardEvent): boolean;
  /** Milliseconds the last preview took (drag frames), for the panel. */
  previewMs: number | null;
}

export function useCageEditor(doc: StudioDoc, preview: (d: StudioDoc) => Promise<EvalResult>, commit: (next: StudioDoc) => void, fail: (title: string, hint: string) => void): CageEditor {
  const [session, setSession] = useState<CageSession | null>(null);
  const [drag, setDrag] = useState<{ delta: Vec3; extrude: boolean } | null>(null);
  const [exact, setExact] = useState<{ of: CageSession; bodies: BodyResult[] } | null>(null);
  const [previewMs, setPreviewMs] = useState<number | null>(null);
  const shift = useRef(false);
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === 'Shift') shift.current = true; }, up = (e: KeyboardEvent) => { if (e.key === 'Shift') shift.current = false; };
    addEventListener('keydown', down); addEventListener('keyup', up);
    return () => { removeEventListener('keydown', down); removeEventListener('keyup', up); };
  }, []);
  const withCage = useCallback((s: CageSession): StudioDoc => ({ ...doc, nodes: doc.nodes.map((n, i) => i === s.node ? (() => { const node: Partial<SubdNode> = { ...(n as SubdNode) }; delete node.mirror; return { ...node, cage: s.cage, ...(s.mirror ? { mirror: s.mirror } : {}) } as ModelNode; })() : n) }), [doc]);
  // The exact body after each step (not while dragged): the kernel's build of the document with the session's cage.
  useEffect(() => {
    if (!session || drag) return;
    let live = true;
    void preview(withCage(session)).then(r => { if (live && r.ok) setExact({ of: session, bodies: r.bodies }); });
    return () => { live = false; };
  }, [session, drag, withCage, preview]);

  const begin = useCallback((node: number) => {
    const n = doc.nodes[node];
    if (n?.kind !== 'subd') return false;
    setSession(startSession(node, n.cage, n.mirror)); setDrag(null); setExact(null); return true;
  }, [doc.nodes]);
  const guard = useCallback((f: (s: CageSession) => CageSession) => setSession(s => {
    if (!s) return s;
    try { return f(s); } catch (e) { fail('Not done', e instanceof Error ? e.message.replace(/^SubD: /, '') : String(e)); return s; }
  }), [fail]);

  // (The session as it would be with the drag so far: one object per session and drag, so what derives from it is computed once.)
  const live = useMemo(() => session && drag ? (() => { try { return { ...session, ...dragged(session, drag.delta, drag.extrude) }; } catch { return session; } })() : session, [session, drag]);
  // (A move keeps the topology: the session's validation stands; an extrusion's is the dragged cage's.)
  const baseValidation = useMemo(() => session ? validationOf(session) : null, [session]);
  const overlay = useMemo((): CageOverlay | null => live ? { cage: live.cage, mode: live.mode, sel: live.sel, validation: drag?.extrude ? validationOf(live) : baseValidation!, mirrored: live.mirror ? (() => { const full = mirrorCage(live.cage, live.mirror); return { positions: [...full.positions], faces: full.faces.slice(live.cage.faces.length).map(f => [...f]) } as never; })() : null } : null, [live, drag, baseValidation]);

  // The body while dragged, or in Box mode: triangles straight from the cage (or its quick limit preview).
  const quick = useMemo(() => {
    if (!live || (!drag && live.smooth && exact?.of === session)) return null;
    const t0 = performance.now(), t = previewTriangles(fullCage(live), live.smooth), mesh = triangleMesh(t.positions, t.indices, t.normals, `n${live.node}.cage`);
    return { mesh, ms: performance.now() - t0 };
  }, [live, drag, exact, session]);
  useEffect(() => { if (quick) setPreviewMs(ms => ms !== null && Math.abs(ms - quick.ms) < 0.05 ? ms : quick.ms); }, [quick]);
  const shown = useCallback((bodies: BodyResult[]): BodyResult[] => {
    if (!session) return bodies;
    if (quick) return bodies.map(b => refOf(b).node === session.node ? { ...b, mesh: quick.mesh } : b);
    return exact?.of === session ? exact.bodies : bodies;
  }, [session, quick, exact]);

  const centre = live ? selectionCentre(session!) : null;
  const gizmo: TransformGizmo | null = session && centre ? {
    origin: [centre[0] + (drag?.delta[0] ?? 0), centre[1] + (drag?.delta[1] ?? 0), centre[2] + (drag?.delta[2] ?? 0)], move: [0, 1, 2],
    onMove: (delta, done) => {
      // (Shift held as the drag starts: the selection extruded, then moved.)
      const extrude = drag?.extrude ?? shift.current;
      if (!done) { setDrag({ delta, extrude }); return; }
      setDrag(null); guard(s => commitDrag(s, delta, extrude));
    },
  } : null;

  const done = useCallback(() => {
    if (!session) return;
    const v = validationOf(session);
    if (!v.valid) { fail('The cage is not a manifold', `${v.nonManifoldEdges.length} edges and ${v.nonManifoldVertices.length} vertices are marked red: undo, or weld or delete them.`); return; }
    if (session.undo.length) commit(withCage(session));
    setSession(null); setExact(null); setDrag(null);
  }, [session, commit, withCage, fail]);
  const cancel = useCallback(() => { setSession(null); setExact(null); setDrag(null); }, []);
  const onKey = useCallback((e: KeyboardEvent): boolean => {
    if (!session) return false;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return false;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); setSession(s => s && (e.shiftKey ? redoSession(s) : undoSession(s))); return true; }
    if (e.key === 'Enter') { e.preventDefault(); done(); return true; }
    if (e.key === 'Escape') { if (session.sel.vertices.length || session.sel.edges.length || session.sel.faces.length) setSession(s => s && { ...s, sel: { vertices: [], edges: [], faces: [] } }); else cancel(); return true; }
    if (e.key === 'Tab') { e.preventDefault(); setSession(s => s && { ...s, smooth: !s.smooth }); return true; }
    const mode = ({ '1': 'vertex', '2': 'edge', '3': 'face' } as const)[e.key as '1' | '2' | '3'];
    if (mode) { setSession(s => s && { ...s, mode, sel: { vertices: [], edges: [], faces: [] } }); return true; }
    const op = ({ e: 'extrude', l: 'insert-loop', b: 'bridge', f: 'fill', w: 'weld', c: 'crease', Delete: 'delete', Backspace: 'delete' } as Record<string, CageOp>)[e.key];
    if (op && !e.metaKey && !e.ctrlKey) { e.preventDefault(); guard(s => runOp(s, op)); return true; }
    return false;
  }, [session, done, cancel, guard]);

  return {
    session, begin, overlay, gizmo, shown, previewMs,
    onPick: (hit, additive, grow) => guard(s => select(s, hit, additive, grow)),
    setMode: m => setSession(s => s && { ...s, mode: m, sel: { vertices: [], edges: [], faces: [] } }),
    toggleSmooth: () => setSession(s => s && { ...s, smooth: !s.smooth }),
    op: o => guard(s => runOp(s, o)),
    undo: () => setSession(s => s && undoSession(s)), redo: () => setSession(s => s && redoSession(s)),
    done, cancel, onKey,
  };
}

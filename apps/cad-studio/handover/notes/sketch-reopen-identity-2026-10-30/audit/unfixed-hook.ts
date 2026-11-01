import { emptyDirect } from '/Users/user/github/barocss/barocss/.claude/worktrees/agent-af4bb57e31a4db612/apps/cad-studio/src/app/directGeometry';
import { SKETCH_INSETS, sketchRegion, detachSketchLink } from '/Users/user/github/barocss/barocss/.claude/worktrees/agent-af4bb57e31a4db612/apps/cad-studio/src/app/sketchControls';
import { emptySel } from '/Users/user/github/barocss/barocss/.claude/worktrees/agent-af4bb57e31a4db612/apps/cad-studio/src/app/studioConstants';
import { useCallback } from 'react';
import { resolveAssociativeSketch } from '@barocss/cad-model/engine/part';
import { dropStaleMade, prefixDoc, withNode, type ModelNode, type SketchNode } from '@barocss/cad-model/engine/doc';
import { featureId } from '@barocss/cad-model/engine/ids';
import { type SketchAnchor } from '/Users/user/github/barocss/barocss/.claude/worktrees/agent-af4bb57e31a4db612/apps/cad-studio/src/viewport/Viewport';
import { planeOf } from '@barocss/cad-model/app/profiles';
import { offsetShape } from '@barocss/cad-model/sketch/offset';
import { extendAt, joinOpen, splitAt, trimAt } from '@barocss/cad-model/sketch/trim';
import { sketchShapes } from '@barocss/cad-model/sketch/reopen';
import { renameToTagged } from '@barocss/cad-model/sketch/entityIds';
import { loadDirect } from '@barocss/cad-model/engine/directModule';
import { circleCurve, curvesSource, edgeCurve, outlineCurve } from '@barocss/cad-model/engine/curveSource';
import { isDefaultPlane, offsetPlane, standardPlane, tiltPlane, xyPlane, type SketchPlane } from '@barocss/cad-model/sketch/plane';
import { profileOf, shapeNode } from '@barocss/cad-model/sketch/loops';
import { startPicking } from '@barocss/cad-model/sketch/select';
import type { Dispatch, SetStateAction, RefObject } from 'react';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { FriendlyError } from '@barocss/cad-model/engine/errors';
import type { Selection } from '@barocss/cad-model/app/commands';
import type { DirectGeometry } from '@barocss/cad-model/engine/direct';
import type { ViewportHandle, SketchState } from '/Users/user/github/barocss/barocss/.claude/worktrees/agent-af4bb57e31a4db612/apps/cad-studio/src/viewport/Viewport';
import type { EngineClient } from '/Users/user/github/barocss/barocss/.claude/worktrees/agent-af4bb57e31a4db612/apps/cad-studio/src/engine/client';
interface SketchActionOptions {
  model: { doc: StudioDoc; bodies: BodyResult[]; selection: Selection; marker: number | null };
  editor: { sketch: SketchState | null; setSketch: Dispatch<SetStateAction<SketchState | null>>; sketchGeneration: RefObject<number> };
  owner: { docNow: RefObject<StudioDoc>; acceptanceScope: object };
  worker: { engine: EngineClient; nextRevision(): number };
  viewport: RefObject<ViewportHandle | null>;
  changes: { canChangeDocument(): boolean; commit(next: StudioDoc): boolean; commitDirect(next: DirectGeometry, select?: string[]): boolean; setSelection: Dispatch<SetStateAction<Selection>>; setEditNode(value: null): void; setActive(value: null): void; setPreviewBodies(value: null): void };
  onNotice(notice: FriendlyError): void;
}
/** Sketch placement, editing and Finish retain App's dispatch and linked-sketch generation owner. */
export function useSketchActions({ model, editor, owner, worker, viewport, changes, onNotice: setToast }: SketchActionOptions) {
  const { doc, bodies, selection, marker } = model;
  const { sketch, setSketch, sketchGeneration } = editor;
  const { docNow, acceptanceScope } = owner;
  const { engine, nextRevision } = worker;
  const { canChangeDocument, commit, commitDirect, setSelection, setEditNode, setActive, setPreviewBodies } = changes;
  /** Moves the sketch to another plane (its shapes keep their plane coordinates) and faces it. */
  const placeSketch = useCallback((kind: SketchAnchor['kind'], offset: number, angle = 0) => {
    if (!sketch) return;
    const face = sketch.anchor?.face, base = kind === 'face' ? face?.base ?? null : null;
    const plane = offsetPlane(tiltPlane(kind === 'face' && face ? face.plane : standardPlane(kind === 'face' ? 'xy' : kind), angle), offset);
    setSketch({ ...(JSON.stringify(sketch.plane) === JSON.stringify(plane) ? sketch : detachSketchLink(sketch)), plane, base, anchor: { ...(sketch.anchor ?? { offset: 0 }), kind, offset, angle } });
    const [min, max] = sketchRegion(bodies, plane);
    viewport.current?.frameSketch(min, max, plane, SKETCH_INSETS);
  }, [sketch, bodies, setSketch]);

  /** The sketch's shapes as curves of the direct geometry (one per shape, through the sketch plane); the sketch is left. */
  const sketchToCurves = async () => {
    if (!sketch) return;
    const shapes = [...(sketch.done ?? []), ...(sketch.shape ? [sketch.shape] : [])], P = sketch.plane;
    const curves = shapes.flatMap(s => s.kind === 'circle' ? [circleCurve(P, s.c, s.r)]
      : s.kind === 'rectangle' ? [outlineCurve(P, [s.a, [s.b[0], s.a[1]], s.b, [s.a[0], s.b[1]]], undefined, true)]
        : s.kind === 'slot' ? (() => { const l = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) || 1, n: [number, number] = [-(s.b[1] - s.a[1]) / l * s.r, (s.b[0] - s.a[0]) / l * s.r]; return [outlineCurve(P, [[s.a[0] - n[0], s.a[1] - n[1]], [s.b[0] - n[0], s.b[1] - n[1]], [s.b[0] + n[0], s.b[1] + n[1]], [s.a[0] + n[0], s.a[1] + n[1]]], [0, 1, 0, 1], true)]; })()
          : s.points.length >= 2 ? [outlineCurve(P, s.points, s.bulges, s.closed)] : []);
    if (!curves.length) { setToast({ title: 'Nothing to make curves of', hint: 'Draw lines, arcs or circles in the sketch first.', detail: '' }); return; }
    if (curves.length > 16) { setToast({ title: 'Too many shapes', hint: 'Make curves of at most 16 shapes at a time.', detail: '' }); return; }
    const { importSource } = await loadDirect();
    const made = (doc.direct?.objects ?? []).filter(o => o.name.startsWith('Sketch curve')).length, next = importSource(doc.direct ?? emptyDirect(), curvesSource('sketch', curves), `Sketch curve ${made + 1}`);
    if (!commitDirect(next, next.objects.slice(doc.direct?.objects.length ?? 0).map(o => o.id))) return;
    setSketch(null);
  };
  /** The picked edges as curves of the direct geometry. */
  const edgesToCurves = async () => {
    const curves = selection.edges.flatMap(e => { const c = bodies[e.body] ? edgeCurve(bodies[e.body].mesh, e.edge) : null; return c ? [c] : []; });
    if (!curves.length) return;
    const { importSource } = await loadDirect();
    const made = (doc.direct?.objects ?? []).filter(o => o.name.startsWith('Edge curve')).length, next = importSource(doc.direct ?? emptyDirect(), curvesSource('edges', curves.slice(0, 16)), `Edge curve ${made + 1}`);
    commitDirect(next, next.objects.slice(doc.direct?.objects.length ?? 0).map(o => o.id));
  };
  /** Offsets the newest closed shape of the sketch by `d` (out when positive) as a shape beside it. */
  const offsetSketch = (d: number) => {
    if (!sketch) return;
    const target = sketch.shape && shapeNode(sketch.shape) ? sketch.shape : [...(sketch.done ?? [])].reverse().find(x => !x.construction && shapeNode(x));
    if (!target) { setToast({ title: 'Nothing to offset', hint: 'Draw a closed shape first.', detail: '' }); return; }
    const r = offsetShape(target, d);
    if ('error' in r) { setToast({ title: 'Cannot offset', hint: r.error, detail: '' }); return; }
    setSketch(s => s && { ...detachSketchLink(s), shape: null, done: [...(s.done ?? []), ...(s.shape ? [s.shape] : []), r.shape] });
  };
  /** Trims, extends or splits the piece of the sketch at `at` (plane mm); open pieces meeting end to end join. */
  const trimSketch = (op: 'trim' | 'extend' | 'split', at: [number, number], tol: number) => {
    if (!sketch) return;
    const shapes = sketch.editNode !== undefined && sketch.shape ? [sketch.shape, ...(sketch.done ?? [])] : [...(sketch.done ?? []), ...(sketch.shape ? [sketch.shape] : [])];
    const r = (op === 'trim' ? trimAt : op === 'extend' ? extendAt : splitAt)(shapes.map(x => x.kind === 'polygon' ? { ...x, pending: false } : x), at, tol);
    if ('error' in r) { setToast({ title: op === 'trim' ? 'Nothing to trim there' : op === 'extend' ? 'Nothing to extend there' : 'Nothing to split there', hint: r.error, detail: '' }); return; }
    setSketch(s => s && { ...detachSketchLink(s), shape: null, done: r.shapes, picked: [] });
  };
  /** Reopens the sketch node `index` in the sketcher (Select tool, its kept constraints back); Finish writes it back in place. */
  const editSketch = (index: number) => {
    const stored = doc.nodes[index]; if (stored?.kind !== 'sketch') return;
    let node: SketchNode;
    try { node = stored.association !== undefined ? resolveAssociativeSketch(doc, index) : stored; }
    catch (error) { setToast({ title: 'Cannot open linked sketch', hint: error instanceof Error ? error.message : String(error), detail: '' }); return; }
    const { shape, done, positional } = sketchShapes(node), plane: SketchPlane = node.plane ? { origin: [...node.plane.origin], normal: [...node.plane.normal], xAxis: [...node.plane.xAxis] } : xyPlane();
    setEditNode(null); setActive(null); setPreviewBodies(null); setSelection(emptySel);
    setSketch(startPicking({ plane, tool: 'select', shape, done, base: node.association ? node.on ?? node.association.source : null, editNode: index, ...(node.association ? { association: node.association } : {}), ...(positional ? { positional } : {}) }, 'select'));
    const [min, max] = sketchRegion(bodies, plane); viewport.current?.frameSketch(min, max, plane, SKETCH_INSETS);
  };
  const linkSketchInset = (insetMM: number) => {
    const source = sketch?.anchor?.face?.linkSource;
    if (!sketch || !source) return;
    if (!Number.isFinite(insetMM) || insetMM <= 0) { setToast({ title: 'Cannot link face outline', hint: 'Enter a finite positive inset distance.', detail: '' }); return; }
    if (sketch.shape || sketch.done?.length) { setToast({ title: 'Cannot link face outline', hint: 'Start with an empty sketch. Existing shapes are preserved.', detail: '' }); return; }
    try {
      const association = { ...source, insetMM }, index = doc.nodes.length;
      const candidate = withNode(doc, { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [1, 1], association } as SketchNode);
      const node = resolveAssociativeSketch(candidate, index), { shape, done } = sketchShapes(node);
      const plane = planeOf(node);
      setSketch({ ...sketch, plane, shape, done, base: association.source, association, associationDetached: false });
    } catch (error) { setToast({ title: 'Cannot link face outline', hint: error instanceof Error ? error.message : String(error), detail: '' }); }
  };
  const finishSketch = useCallback(() => {
    if (!canChangeDocument()) return;
    if (!sketch || (!sketch.shape && !sketch.done?.length)) { setSketch(null); return; }
    const requestedGeneration = sketchGeneration.current;
    const linked = !!(sketch.association || sketch.associationDetached);
    const requestCurrent = () => docNow.current === doc && sketchGeneration.current === requestedGeneration;
    // A reopened sketch keeps its main profile first (the first outer shape is the main one).
    // (Open lines and arcs meeting end to end are one outline.)
    const shapes = joinOpen((sketch.editNode !== undefined && sketch.shape ? [sketch.shape, ...(sketch.done ?? [])] : [...(sketch.done ?? []), ...(sketch.shape ? [sketch.shape] : [])]).map(x => x.kind === 'polygon' && !x.closed ? { ...x, pending: false } : x));
    const profile = profileOf(shapes);
    if ('error' in profile) { setToast({ title: 'Finish the profile first', hint: profile.error, detail: '' }); return; }
    // Construction shapes are kept with the sketch (they come back when it is reopened).
    const refs = shapes.filter(x => x.construction), node = refs.length ? { ...profile.node, construction: refs } as SketchNode : profile.node;
    // The sketch keeps its plane; everything below is in the plane's own coordinates (Z along its normal).
    const placedNode: ModelNode = { ...node, ...(isDefaultPlane(sketch.plane) ? {} : { plane: { origin: [...sketch.plane.origin], normal: [...sketch.plane.normal], xAxis: [...sketch.plane.xAxis] } }), ...(sketch.association ? { association: sketch.association } : {}), ...((sketch.association || sketch.associationDetached) && sketch.base ? { on: sketch.base } : {}) } as SketchNode;
    if (sketch.editNode !== undefined) {
      const at = sketch.editNode;
      const replacement = doc.nodes[at].id !== undefined ? { ...placedNode, id: doc.nodes[at].id } : placedNode;
      const edited = { ...doc, nodes: dropStaleMade(doc.nodes, doc.nodes.map((n, k) => k === at ? replacement : n)) };
      // (A sketch from before R10a getting its side ids: the features on it keep their references, by the new names.)
      const tags = (placedNode as SketchNode).sideTags, next = sketch.positional && tags && !(doc.nodes[at] as SketchNode).sideTags ? renameToTagged(edited, at, sketch.positional, tags, featureId) : edited;
      engine.evaluate(sketch.association || sketch.associationDetached ? next : prefixDoc(next, marker ?? next.nodes.length), nextRevision()).then(r => { if (!r || (linked && !requestCurrent())) return; if (r.ok) { if (!commit(next)) return; setSketch(null); } else setToast(r.error); });
      return;
    }
    // A finished sketch is a feature of its own (it remembers the body it was drawn on): picked, ready
    // for Extrude, Revolve, Pipe or Loft.
    const base = sketch.base ?? null, next = withNode(doc, { ...placedNode, ...(base ? { on: base } : {}) } as SketchNode);
    if (sketch.association) {
      engine.evaluate(next, nextRevision()).then(r => { if (!r || !requestCurrent()) return; if (r.ok) { if (!commit(next)) return; setSketch(null); setSelection({ ...emptySel, sketches: [next.nodes.length - 1] }); } else setToast(r.error); });
      return;
    }
    if (!commit(next)) return; setSketch(null);
    setSelection({ ...emptySel, sketches: [next.nodes.length - 1] });
  }, [sketch, doc, marker, commit, engine, setSketch, acceptanceScope]);

  return { placeSketch, sketchToCurves, edgesToCurves, offsetSketch, trimSketch, editSketch, linkSketchInset, finishSketch };
}

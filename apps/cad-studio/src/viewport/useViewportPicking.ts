import { useCallback, type Dispatch, type SetStateAction, type RefObject } from 'react';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { FriendlyError } from '@barocss/cad-model/engine/errors';
import type { Vec3 } from '@barocss/cad-model/engine/mesh';
import { selectedBodies, type Selection, type Values } from '@barocss/cad-model/app/commands';
import { edgeChain } from '@barocss/cad-model/app/edgeChain';
import type { MeasurePick } from '@barocss/cad-model/app/measure';
import type { useAssembly } from '../assembly/useAssembly';
import type { ExtrudeEndHit } from '../app/extrudeEndFace';
import type { Active } from '../app/commandState';
import { emptySel } from '../app/studioConstants';
import type { createValueStore } from '../state/valueStore';
import { planeFromFace, type Section } from './sectionView';
import { bindMidpointPick } from '../app/midpointSketch';
import { bindMeasureFacePick } from '../app/pinnedFaceMeasure';
import { bindNativeVertexPick } from './vertexPick';
import type { ScenePickingActions } from './SceneViewport';

export interface ViewportMenu {
  at: { x: number; y: number };
  selection: Selection;
  title: string;
}

export function useViewportPicking({ doc, nativeVertexReady, nativePlanePickState, activeStore, setActive, measure, assembly, sectionRef, sectionFacePickRef, viewBodiesRef,
  sectionBoxRef, setSection, setSectionFacePick, setToast, activeRef, halvesShownRef, setPick, setInstanceSel, setSelection,
  setDirectSel, setMeasure, measureNativeReady, pickFilterRef, onFilletPick, onExtrudeTargetPick, scene }: {
  onExtrudeTargetPick(hit: ExtrudeEndHit, blocked: boolean): boolean;
  onFilletPick?(hit: { face: { body: number; face: number } | null; edge: { body: number; edge: number } | null; instance?: string }, additive: boolean): boolean;
  nativePlanePickState: RefObject<{ midpointReady: boolean; insetReady: boolean }>;
  doc: StudioDoc; nativeVertexReady: boolean; activeStore: ReturnType<typeof createValueStore<Active | null>>;
  setActive: Dispatch<SetStateAction<Active | null>>; measure: MeasurePick[] | null; assembly: ReturnType<typeof useAssembly>;
  sectionRef: RefObject<Section | null>; sectionFacePickRef: RefObject<number | null>; viewBodiesRef: RefObject<BodyResult[]>;
  sectionBoxRef: RefObject<{ min: Vec3; max: Vec3 }>; setSection: Dispatch<SetStateAction<Section | null>>;
  setSectionFacePick: Dispatch<SetStateAction<number | null>>; setToast(notice: FriendlyError): void;
  activeRef: RefObject<Active | null>; halvesShownRef: RefObject<boolean>; setPick: Dispatch<SetStateAction<Vec3 | null>>;
  setInstanceSel: Dispatch<SetStateAction<string[]>>; setSelection: Dispatch<SetStateAction<Selection>>;
  setDirectSel: Dispatch<SetStateAction<string[]>>; setMeasure: Dispatch<SetStateAction<MeasurePick[] | null>>;
  measureNativeReady: RefObject<boolean>;
  pickFilterRef: RefObject<'all' | 'face' | 'edge' | 'body'>;
  scene: {
    active: Active | null;
    section: Section | null;
    sketch: boolean;
    bodies: BodyResult[];
    selection: Selection;
    setMenu(menu: ViewportMenu): void;
  };
}) {
  const onPick = useCallback((hit: { face: { body: number; face: number } | null; edge: { body: number; edge: number } | null; point: Vec3 | null; direct?: string; instance?: string; instanceFace?: { body: number; face: number }; instanceCap?: { body: number }; vertex?: { body: number; at: Vec3 } }, additive: boolean) => {
    if (onExtrudeTargetPick(hit, !!sectionRef.current || halvesShownRef.current)) return;
    // Family attempts retire queued Apply even when an instance was removed or hidden.
    if (activeStore.get()?.fillet && onFilletPick?.(hit, additive)) return;
    // (The section view shows cut copies of the bodies: picks wait until it is closed.)
    // (G19: a face for a section plane — its plane, the material behind it kept.)
    if (sectionRef.current && sectionFacePickRef.current !== null && hit.face) {
      const i = sectionFacePickRef.current, f = viewBodiesRef.current[hit.face.body]?.mesh.faces[hit.face.face];
      if (f && f.kind === 'plane') { const q = planeFromFace(f, sectionBoxRef.current); setSection(sc => sc && { ...sc, planes: sc.planes.map((p, j) => j === i ? q : p) }); setSectionFacePick(null); }
      else setToast({ title: 'Not a flat face', hint: 'A section plane is taken from a flat face.', detail: '' });
      return;
    }
    const validInstance = !!hit.instance && !!doc.instances?.some(inst => inst.id === hit.instance && !inst.hidden);
    if (hit.instance && !validInstance) return;
    // Section copies still block base-body edits. A current visible instance keeps its own selection route.
    if (sectionRef.current && !activeRef.current && !validInstance) return;
    // (G6: while the mould's halves show, picks reach only them — none here.)
    if (halvesShownRef.current && !activeRef.current) return;
    const cur = activeStore.get();
    if (cur) {
      // A command that takes a pick (a revolve's axis edge) gets the click; others ignore it. (R1d: its values as they are
      // now, from the store.)
      if (!cur.cmd.onPick) return;
      const r = cur.cmd.onPick(cur.ctx, cur.values, { face: hit.face, edge: hit.edge });
      if (!r) return;
      if ('error' in r && typeof r.error === 'string' && Object.keys(r).length === 1) { setToast({ title: `${cur.cmd.label}: not that one`, hint: r.error, detail: '' }); return; }
      setActive(a => a && { ...a, values: r as Values, preview: 'busy' }); return;
    }
    if (validInstance && !hit.instanceFace) {
      setPick(null); setInstanceSel([hit.instance!]); setSelection(emptySel); setDirectSel([]);
      if (hit.instanceCap) setToast({ title: 'Instance selected', hint: 'The section cap selects this instance. Use an original face for face operations.', detail: '' });
      return; // A generated cap or unknown face never enters native mate-face picking.
    }
    if (assembly.pick(hit)) return;
    setPick(hit.point);
    if (hit.direct) {
      const id = hit.direct;
      setDirectSel(prev => additive ? (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]) : [id]);
      setSelection(emptySel); setInstanceSel([]); return;
    }
    if (hit.instance) { setInstanceSel([hit.instance]); setSelection(emptySel); setDirectSel([]); return; }
    if (!additive) { setDirectSel([]); setInstanceSel([]); }
    if (measure) {
      if (!hit.face && !hit.edge && !hit.vertex) return;
      const p: MeasurePick = hit.vertex ? { body: hit.vertex.body, vertex: hit.vertex.at } : hit.edge ? { body: hit.edge.body, edge: hit.edge.edge } : { body: hit.face!.body, face: hit.face!.face };
      if (p.face !== undefined && measureNativeReady.current) bindMeasureFacePick(p, doc, viewBodiesRef.current[p.body]);
      setMeasure(m => !m || m.length >= 2 ? [p] : [...m, p]); return;
    }
    // A corner: picked on its own (Shift adds or takes back another).
    if (hit.vertex) { const v = hit.vertex; if (nativeVertexReady) bindNativeVertexPick(v, doc); setPick(null); setSelection(prev => { const list = prev.vertices ?? [], same = (a: typeof v) => a.body === v.body && a.at.every((x, k) => Math.abs(x - v.at[k]) < 1e-9); return { ...emptySel, vertices: additive ? (list.some(same) ? list.filter(a => !same(a)) : [...list, v]) : [v] }; }); return; }
    if (hit.face && (nativePlanePickState.current.midpointReady || nativePlanePickState.current.insetReady)) bindMidpointPick(hit.face, doc, viewBodiesRef.current[hit.face.body]);
    setSelection(prev => {
      if (!hit.face && !hit.edge) return emptySel;
      // Bodies only: the body under the click (Shift adds or takes it back).
      if (pickFilterRef.current === 'body') { const b = hit.face?.body ?? hit.edge!.body, list = selectedBodies(prev); return { faces: [], edges: [], bodies: additive ? (list.includes(b) ? list.filter(x => x !== b) : [...list, b]) : [b] }; }
      if (additive) {
        // Shift-click adds (or takes back) another of what is selected: edges to round or chamfer, faces to
        // open in a shell; with bodies picked (or a mix), the clicked body (two for a Boolean).
        const toggle = <T,>(list: T[], x: T, same: (a: T, b: T) => boolean) => list.some(y => same(x, y)) ? list.filter(y => !same(x, y)) : [...list, x];
        const none = !prev.faces.length && !prev.edges.length && !prev.bodies.length;
        if (hit.edge && !prev.faces.length && !prev.bodies.length) return { ...emptySel, edges: toggle(prev.edges, hit.edge, (a, b) => a.body === b.body && a.edge === b.edge) };
        if (hit.face && !prev.edges.length && !prev.bodies.length && (none || prev.faces.length)) return { ...emptySel, faces: toggle(prev.faces, hit.face, (a, b) => a.body === b.body && a.face === b.face) };
        const b = hit.face?.body ?? hit.edge!.body; const list = selectedBodies(prev);
        return { faces: [], edges: [], bodies: list.includes(b) ? list.filter(x => x !== b) : [...list, b] };
      }
      return hit.edge ? { faces: [], edges: [hit.edge], bodies: [] } : { faces: [hit.face!], edges: [], bodies: [] };
    });
  }, [activeStore, measure, measureNativeReady, assembly, doc, nativeVertexReady, nativePlanePickState, viewBodiesRef, onFilletPick, onExtrudeTargetPick]);

  // The viewport, Browser and History use the same action for a finished sketch.
  const onPickProfile = useCallback((id: number | null, additive: boolean) => {
    if (id === null) return;
    setDirectSel([]);
    setInstanceSel([]);
    setSelection(prev => {
      const list = prev.sketches ?? [];
      return { ...emptySel, sketches: additive ? (list.includes(id) ? list.filter(x => x !== id) : [...list, id]) : [id] };
    });
  }, []);

  const picking = {
    onPick,
    onPickProfile,
    onPickBody(body) {
      if (scene.active || scene.section) return;
      setDirectSel([]);
      setInstanceSel([]);
      setSelection({ faces: [], edges: [], bodies: [body] });
    },
    onPickChain(body, edge) {
      if (scene.active || scene.section || !scene.bodies[body]) return;
      setDirectSel([]);
      setInstanceSel([]);
      setSelection({
        faces: [], edges: edgeChain(scene.bodies[body].mesh, edge).map(edge => ({ body, edge })), bodies: [],
      });
    },
    onBoxSelect(picked, additive) {
      if (scene.active) return;
      setSelection(prev => {
        const base = additive ? selectedBodies(prev) : [];
        return { faces: [], edges: [], bodies: [...new Set([...base, ...picked])] };
      });
    },
    onContextMenu(at, hit) {
      if (scene.active || scene.sketch) return;
      if (hit.face && !hit.edge && (nativePlanePickState.current.midpointReady || nativePlanePickState.current.insetReady)) bindMidpointPick(hit.face, doc, viewBodiesRef.current[hit.face.body]);
      const next: Selection = hit.edge ? { faces: [], edges: [hit.edge], bodies: [] }
        : hit.face ? { faces: [hit.face], edges: [], bodies: [] }
        : scene.selection;
      if (hit.edge || hit.face) setSelection(next);
      const count = hit.edge || hit.face ? 0 : selectedBodies(next).length;
      const title = hit.edge ? 'EDGE' : hit.face ? 'FACE' : count ? `${count} BOD${count > 1 ? 'IES' : 'Y'}` : 'VIEW';
      scene.setMenu({ at, selection: next, title });
    },
  } satisfies ScenePickingActions;

  return { onPick, picking };
}

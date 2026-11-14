import type { RevolveAxisHit } from '../app/revolveAxisPick';
import { useCallback, type Dispatch, type SetStateAction, type RefObject } from 'react';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { FriendlyError } from '@barocss/cad-model/engine/errors';
import type { Vec3 } from '@barocss/cad-model/engine/mesh';
import { selectedBodies, type Selection, type Values } from '@barocss/cad-model/app/commands';
import { sweepPath } from '@barocss/cad-model/app/profileCommands';
import { edgeChain } from '@barocss/cad-model/app/edgeChain';
import type { MeasurePick } from '@barocss/cad-model/app/measure';
import type { useAssembly } from '../assembly/useAssembly';
import type { ExtrudeEndHit } from '../app/extrudeEndFace';
import type { Active } from '../app/commandState';
import { emptySel } from '../app/studioConstants';
import type { createValueStore } from '../state/valueStore';
import { planeFromFace, type Section } from './sectionView';
import { bindMidpointPick } from '../app/midpointSketch';
import { captureMeasureTarget, capturePlacedMeasureFace, readMeasureTarget, sameMeasureOccurrence, type MeasureTarget, type PlacedMeasureSource } from '../app/measureTargets';
import { bindNativeVertexPick } from './vertexPick';
import type { EdgeRef, FaceRef } from './renderer';
import type { ScenePickingActions } from './SceneViewport';

export interface ViewportMenu {
  at: { x: number; y: number };
  selection: Selection;
  title: string;
  viewOnly?: true;
  measureSource?: { doc: StudioDoc; target: MeasureTarget };
}

export type SectionPick = (hit: { face: FaceRef | null; edge: EdgeRef | null }) => { face: FaceRef | null; edge: EdgeRef | null; cap: boolean };

export function useViewportPicking({ doc, modelUnavailable, nativeVertexReady, nativePlanePickState, sectionPickRef, activeStore, setActive, measure, assembly, sectionRef, sectionFacePickRef, viewBodiesRef,
  sectionBoxRef, setSection, setSectionFacePick, setToast, activeRef, halvesShownRef, setPick, setInstanceSel, setSelection,
  directSel, setDirectSel, setMeasure, measureNativeReady, measureInstances, placedMeasureContextReady, pickFilterRef, onFilletPick, onExtrudeTargetPick, onRevolveAxisPick, retargetSweep, scene }: {
  retargetSweep(input: { profile: number } | { path: string }): boolean;
  onExtrudeTargetPick(hit: ExtrudeEndHit, blocked: boolean): boolean;
  onRevolveAxisPick(hit: RevolveAxisHit, blocked: boolean): boolean;
  onFilletPick?(hit: { face: { body: number; face: number } | null; edge: { body: number; edge: number } | null; instance?: string }, additive: boolean): boolean;
  sectionPickRef: RefObject<SectionPick>;
  nativePlanePickState: RefObject<{ midpointReady: boolean; insetReady: boolean }>;
  doc: StudioDoc; modelUnavailable: boolean; nativeVertexReady: boolean; activeStore: ReturnType<typeof createValueStore<Active | null>>;
  setActive: Dispatch<SetStateAction<Active | null>>; measure: MeasureTarget[] | null; assembly: ReturnType<typeof useAssembly>;
  sectionRef: RefObject<Section | null>; sectionFacePickRef: RefObject<number | null>; viewBodiesRef: RefObject<BodyResult[]>;
  sectionBoxRef: RefObject<{ min: Vec3; max: Vec3 }>; setSection: Dispatch<SetStateAction<Section | null>>;
  setSectionFacePick: Dispatch<SetStateAction<number | null>>; setToast(notice: FriendlyError): void;
  activeRef: RefObject<Active | null>; halvesShownRef: RefObject<boolean>; setPick: Dispatch<SetStateAction<Vec3 | null>>;
  setInstanceSel: Dispatch<SetStateAction<string[]>>; setSelection: Dispatch<SetStateAction<Selection>>;
  directSel: readonly string[];
  setDirectSel: Dispatch<SetStateAction<string[]>>; setMeasure: Dispatch<SetStateAction<MeasureTarget[] | null>>;
  measureNativeReady: RefObject<boolean>;
  measureInstances: RefObject<ReadonlyMap<string, PlacedMeasureSource>>;
  placedMeasureContextReady(): boolean;
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
  const onPick = useCallback((hit: RevolveAxisHit & { face: { body: number; face: number } | null; edge: { body: number; edge: number } | null; point: Vec3 | null; direct?: string; instance?: string; instanceFace?: { body: number; face: number }; instanceCap?: { body: number }; vertex?: { body: number; at: Vec3 } }, additive: boolean) => {
    if (modelUnavailable) return;
    const blocked = !!sectionRef.current || halvesShownRef.current;
    if (!blocked && hit.direct && retargetSweep({ path: hit.direct })) return;
    if (onExtrudeTargetPick(hit, blocked) || onRevolveAxisPick(hit, blocked)) return;
    // Family attempts retire queued Apply even when an instance was removed or hidden.
    if (activeStore.get()?.fillet && onFilletPick?.(hit, additive)) return;
    // (The section view shows cut copies of the bodies: picks wait until it is closed.)
    // (G19: a face for a section plane — its plane, the material behind it kept.)
    if (sectionRef.current && sectionFacePickRef.current !== null && hit.face) {
      const i = sectionFacePickRef.current, target = sectionPickRef.current(hit);
      const f = target.face && scene.bodies[target.face.body]?.mesh.faces[target.face.face];
      if (f && f.kind === 'plane') { const q = planeFromFace(f, sectionBoxRef.current); setSection(sc => sc && { ...sc, planes: sc.planes.map((p, j) => j === i ? q : p) }); setSectionFacePick(null); }
      else setToast({ title: 'Not a flat face', hint: 'A section plane is taken from a flat face.', detail: '' });
      return;
    }
    const validInstance = !!hit.instance && !!doc.instances?.some(inst => inst.id === hit.instance && !inst.hidden);
    if (hit.instance && !validInstance) return;
    if (sectionRef.current && !validInstance) {
      if (activeRef.current || hit.direct) return;
      const target = sectionPickRef.current(hit);
      if (!target.face && !target.edge) {
        if (!additive) { setSelection(emptySel); setPick(null); setDirectSel([]); setInstanceSel([]); }
        return;
      }
      hit = { ...hit, face: target.face, edge: target.edge, vertex: undefined };
    }
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
    const addMeasurement = (target: MeasureTarget, root: readonly BodyResult[]) => {
      setMeasure(current => {
        if (!current?.length) return [target];
        const missing = current.findIndex(previous => {
          if (!previous.occurrence) return !readMeasureTarget(previous, doc, root);
          const part = measureInstances.current.get(previous.occurrence.id);
          return !part || !sameMeasureOccurrence(previous.occurrence, part.inst) || part.hidden.has(previous.body) || !readMeasureTarget(previous, doc, part.bodies);
        });
        if (missing >= 0) return current.map((previous, index) => index === missing ? target : previous);
        return current.length >= 2 ? [target] : [...current, target];
      });
    };
    if (measure && validInstance && !assembly.draft) {
      const target = hit.instanceFace && capturePlacedMeasureFace(hit.instanceFace, doc, measureInstances.current.get(hit.instance!));
      if (!target) {
        setToast({ title: 'Placed face unavailable', hint: 'Select a face on a visible part at its accepted placement.', detail: '' });
        return;
      }
      addMeasurement(target, scene.bodies);
      return;
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
      const keepProfile = !additive && typeof sweepPath(doc, [id]) !== 'string';
      setSelection(previous => keepProfile && previous.sketches?.length === 1 && !previous.profileRegions?.indices.length
        ? { ...emptySel, sketches: previous.sketches } : emptySel);
      setInstanceSel([]); return;
    }
    if (hit.instance) { setInstanceSel([hit.instance]); setSelection(emptySel); setDirectSel([]); return; }
    if (!additive) { setDirectSel([]); setInstanceSel([]); }
    if (measure) {
      if (!hit.face && !hit.edge && !hit.vertex) return;
      const p: MeasurePick = hit.vertex ? { body: hit.vertex.body, vertex: hit.vertex.at } : hit.edge ? { body: hit.edge.body, edge: hit.edge.edge } : { body: hit.face!.body, face: hit.face!.face };
      const source = sectionRef.current ? scene.bodies : viewBodiesRef.current;
      const target = captureMeasureTarget(p, doc, source[p.body], measureNativeReady.current);
      if (!target) return;
      addMeasurement(target, source);
      return;
    }
    // A corner: picked on its own (Shift adds or takes back another).
    if (hit.vertex) { const v = hit.vertex; if (nativeVertexReady) bindNativeVertexPick(v, doc); setPick(null); setSelection(prev => { const list = prev.vertices ?? [], same = (a: typeof v) => a.body === v.body && a.at.every((x, k) => Math.abs(x - v.at[k]) < 1e-9); return { ...emptySel, vertices: additive ? (list.some(same) ? list.filter(a => !same(a)) : [...list, v]) : [v] }; }); return; }
    if (!sectionRef.current && hit.face && (nativePlanePickState.current.midpointReady || nativePlanePickState.current.insetReady)) bindMidpointPick(hit.face, doc, viewBodiesRef.current[hit.face.body]);
    setSelection(prev => {
      if (!hit.face && !hit.edge) return emptySel;
      // Bodies only: the body under the click (Shift adds or takes it back).
      if (pickFilterRef.current === 'body') { const b = hit.face?.body ?? hit.edge!.body, list = selectedBodies(prev); return { faces: [], edges: [], bodies: additive ? (list.includes(b) ? list.filter(x => x !== b) : [...list, b]) : [b] }; }
      if (additive) {
        // Toggle the hit by type unless the selection already contains explicit bodies.
        const toggle = <T,>(list: T[], x: T, same: (a: T, b: T) => boolean) => list.some(y => same(x, y)) ? list.filter(y => !same(x, y)) : [...list, x];
        if (!prev.bodies.length) {
          if (hit.edge) return { ...emptySel, faces: prev.faces, edges: toggle(prev.edges, hit.edge, (a, b) => a.body === b.body && a.edge === b.edge) };
          return { ...emptySel, faces: toggle(prev.faces, hit.face!, (a, b) => a.body === b.body && a.face === b.face), edges: prev.edges };
        }
        const b = hit.face?.body ?? hit.edge!.body; const list = selectedBodies(prev);
        return { faces: [], edges: [], bodies: list.includes(b) ? list.filter(x => x !== b) : [...list, b] };
      }
      return hit.edge ? { faces: [], edges: [hit.edge], bodies: [] } : { faces: [hit.face!], edges: [], bodies: [] };
    });
  }, [activeStore, measure, measureNativeReady, measureInstances, assembly, doc, modelUnavailable, nativeVertexReady, nativePlanePickState, viewBodiesRef, sectionPickRef, scene.bodies, onFilletPick, onExtrudeTargetPick, onRevolveAxisPick, retargetSweep]);

  // The viewport, Browser and History use the same action for a finished sketch.
  const onPickProfile = useCallback((id: number | null, additive: boolean, region?: number) => {
    if (id === null || retargetSweep({ profile: id })) return;
    if (region !== undefined || typeof sweepPath(doc, directSel) === 'string') setDirectSel([]);
    setInstanceSel([]);
    setSelection(prev => {
      const list = prev.sketches ?? [];
      if (region !== undefined && (!additive || !list.length || (list.length === 1 && list[0] === id))) {
        const picked = additive && prev.profileRegions?.sketch === id ? prev.profileRegions.indices : [];
        const indices = picked.includes(region) ? picked.filter(i => i !== region) : [...picked, region];
        return indices.length ? { ...emptySel, sketches: [id], profileRegions: { sketch: id, indices } } : emptySel;
      }
      return { ...emptySel, sketches: additive ? (list.includes(id) ? list.filter(x => x !== id) : [...list, id]) : [id] };
    });
  }, [doc, directSel, retargetSweep]);

  const picking = {
    onPick,
    onPickProfile,
    onPickBody(body) {
      if (modelUnavailable || scene.active || scene.section) return;
      setDirectSel([]);
      setInstanceSel([]);
      setSelection({ faces: [], edges: [], bodies: [body] });
    },
    onPickChain(body, edge) {
      if (modelUnavailable || scene.active || scene.section || !scene.bodies[body]) return;
      setDirectSel([]);
      setInstanceSel([]);
      setSelection({
        faces: [], edges: edgeChain(scene.bodies[body].mesh, edge).map(edge => ({ body, edge })), bodies: [],
      });
    },
    onBoxSelect(picked, additive) {
      if (modelUnavailable || scene.active) return;
      setSelection(prev => {
        const base = additive ? selectedBodies(prev) : [];
        return { faces: [], edges: [], bodies: [...new Set([...base, ...picked])] };
      });
    },
    onContextMenu(at, hit) {
      if (modelUnavailable || scene.active || scene.sketch) return;
      if (hit.instance) {
        const placed = placedMeasureContextReady() ? measureInstances.current.get(hit.instance) : undefined;
        const target = hit.instanceFace && hit.instanceMesh && placed?.bodies[hit.instanceFace.body]?.mesh === hit.instanceMesh
          ? capturePlacedMeasureFace(hit.instanceFace, doc, placed) : null;
        scene.setMenu({ at, selection: emptySel, title: target ? 'PLACED FACE' : hit.instanceCap ? 'SECTION CAP' : 'VIEW', viewOnly: true,
          ...(target ? { measureSource: { doc, target } } : {}) });
        return;
      }
      if (scene.section) {
        const target = sectionPickRef.current(hit);
        if (!target.face && !target.edge) {
          setSelection(emptySel);
          scene.setMenu({ at, selection: emptySel, title: target.cap ? 'SECTION CAP' : 'SECTION VIEW', viewOnly: true });
          return;
        }
        hit = { face: target.face, edge: target.edge, point: null };
      }
      if (hit.face && !hit.edge && !scene.section && (nativePlanePickState.current.midpointReady || nativePlanePickState.current.insetReady)) bindMidpointPick(hit.face, doc, viewBodiesRef.current[hit.face.body]);
      const next: Selection = hit.edge ? { faces: [], edges: [hit.edge], bodies: [] }
        : hit.face ? { faces: [hit.face], edges: [], bodies: [] }
        : scene.selection;
      if (hit.edge || hit.face) {
        setSelection(next);
        setPick(hit.point);
        if (scene.section) { setDirectSel([]); setInstanceSel([]); }
      }
      const count = hit.edge || hit.face ? 0 : selectedBodies(next).length;
      const title = hit.edge ? 'EDGE' : hit.face ? 'FACE' : count ? `${count} BOD${count > 1 ? 'IES' : 'Y'}` : 'VIEW';
      const measurePick = hit.edge ?? hit.face;
      const source = scene.section ? scene.bodies : viewBodiesRef.current;
      const target = measurePick && captureMeasureTarget(measurePick, doc, source[measurePick.body], !scene.section && measureNativeReady.current);
      scene.setMenu({ at, selection: next, title, ...(target ? { measureSource: { doc, target } } : {}) });
    },
  } satisfies ScenePickingActions;

  return { onPick, picking };
}

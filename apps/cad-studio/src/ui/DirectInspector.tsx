import { lazy, Suspense, type Dispatch, type SetStateAction } from 'react';
import { withNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import type { DirectGeometry } from '@barocss/cad-model/engine/direct';
import type { directNow } from '@barocss/cad-model/engine/directModule';
import type { FriendlyError } from '@barocss/cad-model/engine/errors';
const DirectPanel = lazy(() => import('./DirectPanel').then(m => ({ default: m.DirectPanel })));
interface DirectInspectorProps {
  doc: StudioDoc;
  evaluated: StudioDoc;
  directSel: string[];
  D: ReturnType<typeof directNow>;
  changes: { commit(next: StudioDoc): boolean; commitDirect(next: DirectGeometry, selection?: string[]): boolean; setDirectSel: Dispatch<SetStateAction<string[]>> };
  onThicken(id: string, thickness: number, side: 'normal' | 'reverse' | 'both'): void;
  onNotice(notice: FriendlyError): void;
}
/** Direct surface actions keep the existing geometry checks and central commit. */
export function DirectInspector({ doc, evaluated, directSel, D, changes, onThicken, onNotice: setToast }: DirectInspectorProps) {
  const { commit, commitDirect, setDirectSel } = changes;
  if (!doc.direct) return null;
  return <Suspense fallback={null}><DirectPanel direct={doc.direct} selected={directSel}
        onChange={commitDirect} onError={m => setToast({ title: 'The operation was refused', hint: m, detail: '' })}
        onHide={ids => { commitDirect({ ...doc.direct!, objects: doc.direct!.objects.map(o => ids.includes(o.id) ? { ...o, hidden: true } : o) }, []); }}
        onThicken={onThicken}
        onSew={(ids, tolerance) => {
          const objs = ids.map(id => doc.direct!.objects.find(x => x.id === id)!), gs = objs.map(o => D!.geometryOf(doc.direct!, o));
          const surfaces = gs.flatMap(g => g.kind === 'surface' ? [{ degreeU: g.degreeU, degreeV: g.degreeV, knotsU: [...g.knotsU], knotsV: [...g.knotsV], controlPoints: g.controlPoints.map(r => r.map(p => [p[0], p[1], p[2]] as [number, number, number])), weights: g.weights.map(r => [...r]) }] : []);
          if (surfaces.length !== ids.length) return;
          if (objs.some(o => o.trims?.length)) { setToast({ title: 'Untrim them first', hint: 'Sewing joins surfaces along their own edges; trimmed ones do not sew yet.', detail: '' }); return; }
          // (The surfaces hidden as they become the body's faces, in the same undoable step.)
          const direct = { ...doc.direct!, objects: doc.direct!.objects.map(o => ids.includes(o.id) ? { ...o, hidden: true } : o) };
          setDirectSel([]); commit({ ...withNode(evaluated, { kind: 'sew', names: objs.map(o => o.name), surfaces, ...(tolerance > 0 ? { tolerance: Math.min(1, tolerance) } : {}) }), direct });
        }} /></Suspense>;
}

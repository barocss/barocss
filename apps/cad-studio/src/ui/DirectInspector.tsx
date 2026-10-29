import { lazy, Suspense } from 'react';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { DirectGeometry } from '@barocss/cad-model/engine/direct';
import type { FriendlyError } from '@barocss/cad-model/engine/errors';
const DirectPanel = lazy(() => import('./DirectPanel').then(m => ({ default: m.DirectPanel })));
interface DirectInspectorProps {
  doc: StudioDoc;
  directSel: string[];
  changes: { commitDirect(next: DirectGeometry, selection?: string[]): boolean };
  onSew(ids: string[], tolerance: number): void;
  onThicken(id: string, thickness: number, side: 'normal' | 'reverse' | 'both'): void;
  onNotice(notice: FriendlyError): void;
}
/** Direct surface actions keep the existing geometry checks and central commit. */
export function DirectInspector({ doc, directSel, changes, onThicken, onSew, onNotice: setToast }: DirectInspectorProps) {
  const { commitDirect } = changes;
  if (!doc.direct) return null;
  return <Suspense fallback={null}><DirectPanel direct={doc.direct} selected={directSel}
        onChange={commitDirect} onError={m => setToast({ title: 'The operation was refused', hint: m, detail: '' })}
        onHide={ids => { commitDirect({ ...doc.direct!, objects: doc.direct!.objects.map(o => ids.includes(o.id) ? { ...o, hidden: true } : o) }, []); }}
        onThicken={onThicken}
        onSew={onSew} /></Suspense>;
}

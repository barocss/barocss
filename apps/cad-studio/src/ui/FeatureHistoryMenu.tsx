import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { featureLabel } from '@barocss/cad-model/engine/doc';
import type { Ctx, Selection } from '@barocss/cad-model/app/commands';
import { emptySel } from '../app/studioConstants';
import { ContextMenu } from './ContextMenu';
import type { HistoryMenuTarget } from './FeatureHistoryBar';
interface FeatureHistoryMenuProps {
  doc: StudioDoc;
  ctx: Ctx;
  marker: number | null;
  historyMenu: HistoryMenuTarget | null;
  close(): void;
  editors: { setEditNode(index: number | null): void; setInstanceSel(ids: string[]): void; setDirectSel(ids: string[]): void; editSketch(index: number): void; exportSketchDxf(index: number): void; cancel(): void; beginSkeleton(index: number): void; setSelection(selection: Selection): void };
  history: { toggleSuppress(index: number): void; reorder(index: number, direction: -1 | 1): void; setMarker(marker: number | null): void; deleteNode(index: number): void };
}
export function FeatureHistoryMenu({ doc, ctx, marker, historyMenu, close, editors, history }: FeatureHistoryMenuProps) {
  const { setEditNode, setInstanceSel, setDirectSel, editSketch, exportSketchDxf, cancel, beginSkeleton, setSelection } = editors;
  const { toggleSuppress, reorder, setMarker, deleteNode } = history;
  const totalNodes = doc.nodes.length;
  return <>      {historyMenu && doc.nodes[historyMenu.index] && (() => {
        const i = historyMenu.index, n = doc.nodes[i], sk = n.kind === 'sketch' ? i : 'sketch' in n && typeof n.sketch === 'number' && doc.nodes[n.sketch]?.kind === 'sketch' ? n.sketch : null;
        return <ContextMenu at={historyMenu.at} title={featureLabel(n, i, doc.nodes).toUpperCase()} ctx={ctx} commands={false} onClose={() => close()} onRun={() => {}}
          actions={[
            { label: 'Edit', icon: 'edit', run: () => { setEditNode(i); setInstanceSel([]); setDirectSel([]); } },
            ...(sk !== null ? [{ label: 'Edit sketch', icon: 'cad-sketch', run: () => editSketch(sk) }, { label: 'Export sketch DXF', icon: 'download', run: () => exportSketchDxf(sk) }] : []),
            ...(n.kind === 'skeleton' ? [{ label: 'Edit in 3D sketch', icon: 'polyline', run: () => { cancel(); beginSkeleton(i); setSelection(emptySel); setEditNode(null); } }] : []),
            // (A split's halves are separate bodies the model refers to: it stays.)
            ...(n.kind !== 'sketch' && n.kind !== 'split' && n.kind !== 'separate' ? [{ label: n.suppressed ? 'Unsuppress' : 'Suppress', icon: n.suppressed ? 'visibility' : 'visibility_off', run: () => toggleSuppress(i) }] : []),
            { label: 'Move earlier', icon: 'arrow_back', run: () => reorder(i, -1) },
            { label: 'Move later', icon: 'arrow_forward', run: () => reorder(i, 1) },
            { label: 'Roll back to here', icon: 'undo', run: () => setMarker(i + 1 >= totalNodes ? null : i + 1) },
            ...(marker !== null ? [{ label: 'Roll to the end', icon: 'redo', run: () => setMarker(null) }] : []),
            { label: 'Delete', icon: 'delete', shortcut: 'Del', run: () => deleteNode(i) },
          ]} />;
      })()}
</>;
}

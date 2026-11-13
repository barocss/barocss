import type { Dispatch, SetStateAction, RefObject } from 'react';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import { selectedBodies, type Command, type Ctx, type Selection } from '@barocss/cad-model/app/commands';
import { readMeasureTarget, sameMeasureOccurrence, type MeasureTarget, type PlacedMeasureSource } from '../app/measureTargets';
import { lookOf, withLook } from '@barocss/cad-model/app/bodies';
import { emptySel } from '../app/studioConstants';
import type { ViewportMenu } from '../viewport/useViewportPicking';
import type { ViewportHandle } from '../viewport/Viewport';
import { ContextMenu } from './ContextMenu';
interface ViewContextMenuProps {
  model: { doc: StudioDoc; bodies: BodyResult[]; ctx: Ctx; placed?: ReadonlyMap<string, PlacedMeasureSource>; placedMeasureContextReady(): boolean };
  menu: ViewportMenu | null;
  setMenu(value: null): void;
  viewport: RefObject<ViewportHandle | null>;
  changes: { commit(next: StudioDoc): boolean; start(command: Command): void; deleteSelection(): void; setSelection: Dispatch<SetStateAction<Selection>>; setMeasure: Dispatch<SetStateAction<MeasureTarget[] | null>>; setEditNode(value: null): void };
}
export function ViewContextMenu({ model, menu, setMenu, viewport, changes }: ViewContextMenuProps) {
  const { doc, bodies, ctx, placed } = model;
  const { commit, start, deleteSelection, setSelection, setMeasure, setEditNode } = changes;
  const source = menu?.measureSource;
  const picked = source?.doc === doc ? source.target : null;
  const occurrence = picked?.occurrence;
  const part = occurrence && placed?.get(occurrence.id);
  const measureBodies = occurrence ? part?.bodies : bodies;
  const target = picked && measureBodies && (!occurrence || (part && sameMeasureOccurrence(occurrence, part.inst) && !part.hidden.has(picked.body)))
    && measureBodies[picked.pick.body]?.mesh === picked.mesh && readMeasureTarget(picked, doc, measureBodies) ? picked : null;
  const startMeasure = (target: MeasureTarget) => {
    if (target.occurrence && !model.placedMeasureContextReady()) return;
    setMeasure([target]);
    setSelection(emptySel);
    setEditNode(null);
  };
  return <>      {menu && <ContextMenu at={menu.at} title={menu.title} commands={!menu.viewOnly} ctx={{ ...ctx, selection: menu.selection }} onClose={() => setMenu(null)}
        onRun={c => { setMenu(null); start(c); }}
        actions={[
          { label: 'Frame all', icon: 'fit_screen', shortcut: 'F', run: () => viewport.current?.fit() },
          { label: 'Isometric view', icon: 'view_in_ar', run: () => viewport.current?.setView('iso') },
          { label: 'Top view', icon: 'crop_square', run: () => viewport.current?.setView('top') },
          ...(target ? [{ label: 'Measure from here', icon: 'cad-measure', shortcut: '⇧M', run: () => startMeasure(target) }] : []),
          ...(!menu.viewOnly ? (() => {
            // On a body: hide it, show it alone, delete it; with something hidden: show everything again.
            const picked = selectedBodies(menu.selection).filter(i => bodies[i]), anyHidden = bodies.some(b => lookOf(doc, b).hidden);
            const hideAll = (keep: (i: number) => boolean) => commit(bodies.reduce((d, b, i) => withLook(d, b, { hidden: !keep(i) }), doc));
            return [
              ...(picked.length ? [{ label: picked.length > 1 ? 'Hide bodies' : 'Hide body', icon: 'visibility_off', run: () => { hideAll(i => !picked.includes(i) && !lookOf(doc, bodies[i]).hidden); setSelection(emptySel); } },
                { label: 'Show only this', icon: 'filter_center_focus', run: () => hideAll(i => picked.includes(i)) },
                { label: 'Delete', icon: 'delete', shortcut: 'Del', run: () => deleteSelection() }] : []),
              ...(anyHidden ? [{ label: 'Show all bodies', icon: 'visibility', run: () => hideAll(() => true) }] : []),
            ];
          })() : []),
          { label: 'Clear selection', icon: 'deselect', shortcut: 'Esc', run: () => setSelection(emptySel) },
        ]} />}</>;
}

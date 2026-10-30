import type { Dispatch, SetStateAction, RefObject } from 'react';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import { selectedBodies, type Command, type Ctx, type Selection } from '@barocss/cad-model/app/commands';
import type { MeasurePick } from '@barocss/cad-model/app/measure';
import { lookOf, withLook } from '@barocss/cad-model/app/bodies';
import { emptySel } from '../app/studioConstants';
import type { ViewportHandle } from '../viewport/Viewport';
import { ContextMenu } from './ContextMenu';
interface ViewContextMenuProps {
  model: { doc: StudioDoc; bodies: BodyResult[]; ctx: Ctx };
  menu: { at: { x: number; y: number }; selection: Selection; title: string } | null;
  setMenu(value: null): void;
  viewport: RefObject<ViewportHandle | null>;
  changes: { commit(next: StudioDoc): boolean; start(command: Command): void; deleteSelection(): void; setSelection: Dispatch<SetStateAction<Selection>>; setMeasure: Dispatch<SetStateAction<MeasurePick[] | null>>; setEditNode(value: null): void };
}
export function ViewContextMenu({ model, menu, setMenu, viewport, changes }: ViewContextMenuProps) {
  const { doc, bodies, ctx } = model;
  const { commit, start, deleteSelection, setSelection, setMeasure, setEditNode } = changes;
  return <>      {menu && <ContextMenu at={menu.at} title={menu.title} ctx={{ ...ctx, selection: menu.selection }} onClose={() => setMenu(null)}
        onRun={c => { setMenu(null); start(c); }}
        actions={[
          { label: 'Frame all', icon: 'fit_screen', shortcut: 'F', run: () => viewport.current?.fit() },
          { label: 'Isometric view', icon: 'view_in_ar', run: () => viewport.current?.setView('iso') },
          { label: 'Top view', icon: 'crop_square', run: () => viewport.current?.setView('top') },
          ...(() => {
            // On a body: hide it, show it alone, delete it; with something hidden: show everything again.
            const picked = selectedBodies(menu.selection).filter(i => bodies[i]), anyHidden = bodies.some(b => lookOf(doc, b).hidden);
            const hideAll = (keep: (i: number) => boolean) => commit(bodies.reduce((d, b, i) => withLook(d, b, { hidden: !keep(i) }), doc));
            const at = menu.selection.faces[0] ? { body: menu.selection.faces[0].body, face: menu.selection.faces[0].face } : menu.selection.edges[0] ? { body: menu.selection.edges[0].body, edge: menu.selection.edges[0].edge } : null;
            return [
              ...(at ? [{ label: 'Measure from here', icon: 'cad-measure', shortcut: '⇧M', run: () => { setMeasure([at]); setSelection(emptySel); setEditNode(null); } }] : []),
              ...(picked.length ? [{ label: picked.length > 1 ? 'Hide bodies' : 'Hide body', icon: 'visibility_off', run: () => { hideAll(i => !picked.includes(i) && !lookOf(doc, bodies[i]).hidden); setSelection(emptySel); } },
                { label: 'Show only this', icon: 'filter_center_focus', run: () => hideAll(i => picked.includes(i)) },
                { label: 'Delete', icon: 'delete', shortcut: 'Del', run: () => deleteSelection() }] : []),
              ...(anyHidden ? [{ label: 'Show all bodies', icon: 'visibility', run: () => hideAll(() => true) }] : []),
            ];
          })(),
          { label: 'Clear selection', icon: 'deselect', shortcut: 'Esc', run: () => setSelection(emptySel) },
        ]} />}</>;
}

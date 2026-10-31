import { memo } from 'react';
import type { AssemblyCut, PartInstance } from '@barocss/cad-model/engine/doc';
import { cutLabel } from '../app/assemblyCutDraft';
import { Icon } from './atoms';

// Roadmap 10 ⑤: the assembly's cuts in the Browser, a row each: pick to edit, the bin to delete (both one undo step).
export const OutlinerCuts = memo(function OutlinerCuts({ cuts, instances, editing, locked, onEdit, onDelete }: {
  cuts: readonly AssemblyCut[]; instances: readonly PartInstance[]; editing: string | null; locked: boolean; onEdit(id: string): void; onDelete(id: string): void;
}) {
  const nameOf = (id: string) => instances.find(i => i.id === id)?.name ?? id;
  return <>{cuts.map(cut => <div key={cut.id} className={'ol-row' + (editing === cut.id ? ' sel' : '')} data-cut={cut.id}>
    <button className={'ol cut' + (editing === cut.id ? ' sel' : '')} disabled={locked} aria-label={`Edit cut ${cut.name || cut.id}`} title={cutLabel(cut, nameOf)} onClick={() => onEdit(cut.id)}>
      <Icon name="cad-hole" small />{cutLabel(cut, nameOf)}</button>
    <button className="ol-caret" disabled={locked} aria-label={`Delete cut ${cut.name || cut.id}`} title="Delete this cut: the parts are whole again" onClick={() => onDelete(cut.id)}><Icon name="close" small /></button>
  </div>)}</>;
});

import { memo } from 'react';
import { featureLabel, type ModelNode, type PartInstance } from '@barocss/cad-model/engine/doc';
import { Icon } from './atoms';

// The outliner's placed parts (R1c): the list and each row memoised, so a selection change renders the rows whose look
// it changes — the App's render on a pick went through all of them (63 ms over 120 rows, G8).

interface RowProps {
  inst: PartInstance;
  selected: boolean;
  /** The only part selected: its bearings listed under it, to edit. */
  only: boolean;
  /** The bearing being edited in it, or null. */
  editIndex: number | null;
  /** A tool, sketch, render or drawing is open: the bearings cannot be edited. */
  locked: boolean;
  onPick(id: string): void;
  onEdit(id: string, index: number): void;
  iconFor(node: ModelNode): string;
}

const InstanceRow = memo(function InstanceRow({ inst, selected, only, editIndex, locked, onPick, onEdit, iconFor }: RowProps) {
  return <>
    <button className={'ol instance' + (selected ? ' sel' : '') + (inst.hidden ? ' hidden-obj' : '')} onClick={() => onPick(inst.id)}>
      <Icon name={inst.hidden ? 'visibility_off' : 'widgets'} small />{inst.name}</button>
    {only && inst.doc.nodes.map((node, index) => node.kind === 'bearing' && <button key={index} className={'ol ol-step' + (editIndex === index ? ' sel' : '')}
      aria-label={`Edit ${inst.name}: ${featureLabel(node, index, inst.doc.nodes)}`} disabled={locked} onClick={() => onEdit(inst.id, index)}>
      <Icon name={iconFor(node)} small />{featureLabel(node, index, inst.doc.nodes)}</button>)}
  </>;
});

export const OutlinerInstances = memo(function OutlinerInstances({ instances, selection, edit, locked, onPick, onEdit, iconFor }: {
  instances: readonly PartInstance[];
  selection: readonly string[];
  edit: { owner: string; index: number } | null;
  locked: boolean;
  onPick(id: string): void;
  onEdit(id: string, index: number): void;
  iconFor(node: ModelNode): string;
}) {
  return <>{instances.map(inst => <InstanceRow key={inst.id} inst={inst} selected={selection.includes(inst.id)} only={selection.length === 1 && selection[0] === inst.id}
    editIndex={edit?.owner === inst.id ? edit.index : null} locked={locked} onPick={onPick} onEdit={onEdit} iconFor={iconFor} />)}</>;
});

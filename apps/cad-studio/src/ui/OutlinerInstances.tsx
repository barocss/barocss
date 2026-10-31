import { memo, useCallback, useState } from 'react';
import { featureLabel, type ModelNode, type PartInstance } from '@barocss/cad-model/engine/doc';
import { Icon } from './atoms';
import { hasNestedParts, nestedRows } from '../assembly/nestedSelection';

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
  /** Roadmap 10 ②c: the sub-assembly's parts open (by full path), and the nested part selected in it, if any. */
  open: ReadonlySet<string>;
  nestedSel: string | null;
  onToggle(path: string): void;
  onPick(id: string): void;
  onEdit(id: string, index: number): void;
  iconFor(node: ModelNode): string;
}

const InstanceRow = memo(function InstanceRow({ inst, selected, only, editIndex, locked, open, nestedSel, onToggle, onPick, onEdit, iconFor }: RowProps) {
  const button = <button className={'ol instance' + (selected ? ' sel' : '') + (inst.hidden ? ' hidden-obj' : '')} onClick={() => onPick(inst.id)}>
    <Icon name={inst.hidden ? 'visibility_off' : 'widgets'} small />{inst.name}</button>;
  const expandable = hasNestedParts(inst), isOpen = expandable && open.has(inst.id);
  return <>
    {expandable ? <div className={'ol-row' + (selected ? ' sel' : '')}>
      <button className="ol-caret" aria-expanded={isOpen} aria-label={`${isOpen ? 'Hide' : 'Show'} the parts of ${inst.name}`} onClick={() => onToggle(inst.id)}><Icon name={isOpen ? 'expand_more' : 'chevron_right'} small /></button>
      {button}</div> : button}
    {isOpen && nestedRows(inst, open).map(row => <div key={row.path} className={'ol-row nested' + (nestedSel === row.path ? ' sel' : '')} data-path={row.path} style={{ marginLeft: 12 * row.depth }}>
      <button className="ol-caret" disabled={!row.expandable} aria-expanded={row.expandable ? row.open : undefined} aria-label={`${row.open ? 'Hide' : 'Show'} the parts of ${row.name}`} onClick={() => onToggle(row.path)}>
        <Icon name={row.open ? 'expand_more' : 'chevron_right'} small /></button>
      <button className={'ol instance nested' + (nestedSel === row.path ? ' sel' : '')} aria-label={row.label} data-path={row.path} title={row.path} onClick={() => onPick(row.path)}>
        <Icon name="widgets" small />{row.name}</button></div>)}
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
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const toggle = useCallback((path: string) => setOpen(was => { const next = new Set(was); if (!next.delete(path)) next.add(path); return next; }), []);
  // (The nested part selected, as its host's row takes it: a path is only ever under its first id.)
  const nested = selection.length === 1 && selection[0].includes('/') ? selection[0] : null;
  return <>{instances.map(inst => <InstanceRow key={inst.id} inst={inst} selected={selection.includes(inst.id)} only={selection.length === 1 && selection[0] === inst.id}
    editIndex={edit?.owner === inst.id ? edit.index : null} locked={locked} open={open} nestedSel={nested && nested.startsWith(inst.id + '/') ? nested : null}
    onToggle={toggle} onPick={onPick} onEdit={onEdit} iconFor={iconFor} />)}</>;
});

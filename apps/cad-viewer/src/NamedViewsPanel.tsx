import { useLayoutEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { ViewerIcon } from './components/ViewerIcon';

type FocusKind = 'rename' | 'delete' | 'edit-input' | 'edit-save' | 'new-name';
type FocusRequest = { name?: string; kind: FocusKind; origin: Element | null };

function SavedViewRow({ name, disabled, onRestore, onRename, onDelete, register, requestFocus }: {
  name: string; disabled: boolean;
  onRestore: () => void; onRename: (nextName: string) => Promise<boolean>; onDelete: () => void;
  register: (name: string, row: HTMLLIElement | null) => void;
  requestFocus: (request: FocusRequest) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  async function rename(event: FormEvent) {
    event.preventDefault();
    const origin = document.activeElement;
    const kind: FocusKind = origin instanceof HTMLInputElement ? 'edit-input' : 'edit-save';
    const nextName = draft.trim();
    if (await onRename(nextName)) {
      setEditing(false);
      requestFocus({ name: nextName, kind: 'rename', origin });
    } else requestFocus({ name, kind, origin });
  }
  return <li ref={row => register(name, row)} className="named-view-row" data-named-view={name}>
    {editing ? <form className="named-view-rename" onSubmit={event => void rename(event)}>
      <Input data-focus="edit-input" value={draft} maxLength={64} aria-label={`New name for ${name}`} disabled={disabled}
        onChange={event => setDraft(event.target.value)} autoFocus />
      <div><Button data-focus="edit-save" type="submit" className="inspector-icon h-[30px] w-[30px] p-0 [&_svg]:size-[16px]" variant="outline" size="sm" disabled={disabled}
        aria-label={`Save name for ${name}`} title={`Save name for ${name}`}><ViewerIcon name="check" /></Button>
        <Button type="button" className="inspector-icon h-[30px] w-[30px] p-0 [&_svg]:size-[16px]" variant="ghost" size="sm" disabled={disabled}
          aria-label={`Cancel renaming ${name}`} title={`Cancel renaming ${name}`}
          onClick={event => { const origin = event.currentTarget; setDraft(name); setEditing(false);
            requestFocus({ name, kind: 'rename', origin }); }}><ViewerIcon name="close" /></Button></div>
    </form> : <>
      <span className="named-view-name" title={name}>{name}</span>
      <div className="named-view-actions">
        <Button type="button" className="inspector-icon h-[30px] w-[30px] p-0 [&_svg]:size-[16px]" variant="outline" size="sm" disabled={disabled}
          aria-label={`Restore ${name}`} title={`Restore ${name}`} onClick={onRestore}><ViewerIcon name="restore" /></Button>
        <Button data-focus="rename" type="button" className="inspector-icon h-[30px] w-[30px] p-0 [&_svg]:size-[16px]" variant="ghost" size="sm" disabled={disabled}
          aria-label={`Rename ${name}`} title={`Rename ${name}`}
          onClick={() => setEditing(true)}><ViewerIcon name="edit" /></Button>
        <Button data-focus="delete" type="button" className="inspector-icon h-[30px] w-[30px] p-0 [&_svg]:size-[16px]" variant="ghost" size="sm" disabled={disabled}
          aria-label={`Delete ${name}`} title={`Delete ${name}`} onClick={onDelete}><ViewerIcon name="trash" /></Button>
      </div>
    </>}
  </li>;
}

export function NamedViewsPanel({ names, disabled, measurementActive, error, onSave, onRestore, onRename, onDelete }: {
  names: string[]; disabled: boolean; measurementActive: boolean; error: string;
  onSave: (name: string) => Promise<boolean>; onRestore: (name: string) => void;
  onRename: (name: string, nextName: string) => Promise<boolean>; onDelete: (name: string) => Promise<boolean>;
}) {
  const [name, setName] = useState('');
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const rows = useRef(new Map<string, HTMLLIElement>());
  const newName = useRef<HTMLInputElement>(null);
  function register(rowName: string, row: HTMLLIElement | null) {
    if (row) rows.current.set(rowName, row); else rows.current.delete(rowName);
  }
  useLayoutEffect(() => {
    if (!focusRequest || disabled) return;
    const active = document.activeElement;
    // Do not move focus away if the user chose another control during an async operation.
    if (active && active !== document.body && active !== document.documentElement
      && active !== focusRequest.origin && active.isConnected && !active.matches(':disabled')) {
      setFocusRequest(null); return;
    }
    const target = focusRequest.kind === 'new-name' ? (newName.current?.disabled
      ? document.querySelector<HTMLElement>('#measure-tool:not(:disabled)') : newName.current)
      : rows.current.get(focusRequest.name ?? '')?.querySelector<HTMLElement>(`[data-focus="${focusRequest.kind}"]`);
    if (!target || target.matches(':disabled')) return;
    target.focus({ preventScroll: true });
    setFocusRequest(null);
  }, [focusRequest, disabled, names]);
  async function remove(rowName: string) {
    const origin = document.activeElement;
    const index = names.indexOf(rowName);
    const neighbor = names[index + 1] ?? names[index - 1];
    if (await onDelete(rowName))
      setFocusRequest(neighbor ? { name: neighbor, kind: 'rename', origin } : { kind: 'new-name', origin });
    else setFocusRequest({ name: rowName, kind: 'delete', origin });
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (await onSave(name.trim())) setName('');
  }
  return <section className="inspector-section named-views-section" aria-labelledby="named-views-heading"
    title="Review files include saved views. Loading a source or another body selection clears this list.">
    <div className="section-heading"><h3 id="named-views-heading">Saved views</h3><span id="named-view-count" className="lighting-mode">{names.length} / 8</span></div>
    <form className="named-view-create" onSubmit={event => void save(event)}>
      <Input ref={newName} id="named-view-name" value={name} maxLength={64} aria-label="Saved view name" placeholder="View name"
        disabled={disabled || names.length >= 8 || measurementActive} onChange={event => setName(event.target.value)} />
      <Button id="save-named-view" type="submit" className="inspector-icon h-[30px] w-[30px] p-0 [&_svg]:size-[16px]" variant="outline" size="sm" aria-label="Save view"
        title={measurementActive ? 'Finish or cancel point selection before saving a view.'
          : names.length >= 8 ? 'The saved view limit is 8.' : 'Save view'}
        disabled={disabled || names.length >= 8 || measurementActive}><ViewerIcon name="plus" /></Button>
    </form>
    {names.length > 0 && <ul className="named-view-list">{names.map(value => <SavedViewRow key={value} name={value} disabled={disabled}
      register={register} requestFocus={setFocusRequest}
      onRestore={() => onRestore(value)} onRename={next => onRename(value, next)} onDelete={() => { void remove(value); }} />)}</ul>}
    {error && <p id="named-view-error" className="lighting-error" role="alert">{error}</p>}
  </section>;
}

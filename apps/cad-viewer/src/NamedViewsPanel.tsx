import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';

function SavedViewRow({ name, disabled, onRestore, onRename, onDelete }: {
  name: string; disabled: boolean;
  onRestore: () => void; onRename: (nextName: string) => Promise<boolean>; onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  async function rename(event: FormEvent) {
    event.preventDefault();
    if (await onRename(draft.trim())) setEditing(false);
  }
  return <li className="named-view-row" data-named-view={name}>
    {editing ? <form className="named-view-rename" onSubmit={event => void rename(event)}>
      <Input value={draft} maxLength={64} aria-label={`New name for ${name}`} disabled={disabled}
        onChange={event => setDraft(event.target.value)} autoFocus />
      <div><Button type="submit" variant="outline" size="sm" disabled={disabled}>Save name</Button>
        <Button type="button" variant="ghost" size="sm" disabled={disabled}
          onClick={() => { setDraft(name); setEditing(false); }}>Cancel</Button></div>
    </form> : <>
      <span className="named-view-name" title={name}>{name}</span>
      <div className="named-view-actions">
        <Button type="button" variant="outline" size="sm" disabled={disabled} aria-label={`Restore ${name}`} onClick={onRestore}>Restore</Button>
        <Button type="button" variant="ghost" size="sm" disabled={disabled} aria-label={`Rename ${name}`}
          onClick={() => setEditing(true)}>Rename</Button>
        <Button type="button" variant="ghost" size="sm" disabled={disabled} aria-label={`Delete ${name}`} onClick={onDelete}>Delete</Button>
      </div>
    </>}
  </li>;
}

export function NamedViewsPanel({ names, disabled, measurementActive, error, onSave, onRestore, onRename, onDelete }: {
  names: string[]; disabled: boolean; measurementActive: boolean; error: string;
  onSave: (name: string) => Promise<boolean>; onRestore: (name: string) => void;
  onRename: (name: string, nextName: string) => Promise<boolean>; onDelete: (name: string) => void;
}) {
  const [name, setName] = useState('');
  async function save(event: FormEvent) {
    event.preventDefault();
    if (await onSave(name.trim())) setName('');
  }
  return <section className="inspector-section named-views-section" aria-labelledby="named-views-heading">
    <div className="section-heading"><h3 id="named-views-heading">Saved views</h3><span id="named-view-count" className="lighting-mode">{names.length} / 8</span></div>
    <form className="named-view-create" onSubmit={event => void save(event)}>
      <Input id="named-view-name" value={name} maxLength={64} aria-label="Saved view name" placeholder="View name"
        disabled={disabled || names.length >= 8 || measurementActive} onChange={event => setName(event.target.value)} />
      <Button id="save-named-view" type="submit" variant="outline" size="sm"
        disabled={disabled || names.length >= 8 || measurementActive}>Save view</Button>
    </form>
    {measurementActive && <p className="scope-note">Finish or cancel point selection before saving a view.</p>}
    {names.length === 0 ? <p className="named-view-empty">No saved views for this source.</p>
      : <ul className="named-view-list">{names.map(value => <SavedViewRow key={value} name={value} disabled={disabled}
        onRestore={() => onRestore(value)} onRename={next => onRename(value, next)} onDelete={() => onDelete(value)} />)}</ul>}
    {error && <p id="named-view-error" className="lighting-error" role="alert">{error}</p>}
    <p className="scope-note">Review files include these views. Loading a source or another body selection clears this list.</p>
  </section>;
}

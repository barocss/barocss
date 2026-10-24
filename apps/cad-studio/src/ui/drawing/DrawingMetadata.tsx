// DR-5: title-block fields and explicit, person-entered revision records.
import { useState } from 'react';
import { TITLE_FIELDS, checkDrawingMetadata, type DrawingTitleBlock } from '@barocss/cad-model/drawing/metadata';
import type { DrawingSettings } from '@barocss/cad-model/drawing/types';
import { today } from '../useDrawingSheet';
import { CONTROL, FIELD, TICK, withTable } from './sheetShared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';

function MetadataField({ label, value, set }: { label: string; value: string; set(value: string): void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return <label className={FIELD}><span>{label}</span><Input className={CONTROL} aria-label={label} maxLength={120} value={draft ?? value}
    onChange={e => setDraft(e.target.value)} onBlur={() => { if (draft !== null) set(draft.trim()); setDraft(null); }}
    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} /></label>;
}

export function DrawingMetadata({ settings, onChange, onRefused }: { settings: DrawingSettings; onChange(next: DrawingSettings): void; onRefused(message: string): void }) {
  const block = settings.titleBlock ?? { template: 'basic' }, rows = settings.revisions ?? [];
  const [date, setDate] = useState(today), [description, setDescription] = useState(''), [by, setBy] = useState('');
  const setBlock = (titleBlock: DrawingTitleBlock) => {
    const why = checkDrawingMetadata({ titleBlock })[0];
    if (why) onRefused(why.message); else onChange({ ...settings, titleBlock });
  };
  const record = () => {
    const revisions = [...rows, { revision: settings.revision ?? '', date, description: description.trim(), ...(by.trim() ? { by: by.trim() } : {}) }];
    const why = checkDrawingMetadata({ revisions })[0];
    if (why) { onRefused(why.message); return; }
    const next = { ...settings, revisions };
    onChange(settings.tables?.some(t => t.from === 'revisions') ? next : withTable(next, 'revisions', true)); setDescription('');
  };
  return <>
    <label className={FIELD}><span>Title block</span><NativeSelect className={CONTROL} aria-label="Title block template" value={block.template} onChange={e => setBlock({ ...block, template: e.target.value as DrawingTitleBlock['template'] })}>
      <option value="basic">Basic</option><option value="extended">Extended</option>
    </NativeSelect></label>
    {block.template === 'extended' && <details aria-label="Title block fields"><summary>Title block fields</summary>
      {TITLE_FIELDS.map(([key, label]) => <MetadataField key={key} label={label} value={block[key] ?? ''} set={value => { const next = { ...block }; delete next[key]; setBlock(value ? { ...next, [key]: value } : next); }} />)}
    </details>}
    <details aria-label="Revision history"><summary>Revision history ({rows.length})</summary>
      <label className={FIELD}><span>Revision table</span><input className={TICK} type="checkbox" aria-label="Revision table" checked={!!settings.tables?.some(t => t.from === 'revisions')} onChange={e => onChange(withTable(settings, 'revisions', e.target.checked))} /></label>
      {rows.map(r => <div className={FIELD} key={r.revision} aria-label={`Revision record ${r.revision}`}>
        <span className="min-w-0 break-words">{r.revision} · {r.date} · {r.description}{r.by ? ` · ${r.by}` : ''}</span>
        <Button variant="ghost" size="xs" aria-label={`Remove revision record ${r.revision}`} onClick={() => { const { revisions: _r, ...rest } = settings; void _r; const keep = rows.filter(x => x !== r); onChange(keep.length ? { ...rest, revisions: keep } : rest); }}>Remove</Button>
      </div>)}
      <div className="empty">Record the current revision: {settings.revision || 'set Revision first'}.</div>
      <label className={FIELD}><span>Date</span><Input className={CONTROL} type="date" aria-label="Revision date" value={date} onChange={e => setDate(e.target.value)} /></label>
      <label className={FIELD}><span>Change</span><Input className={CONTROL} aria-label="Revision description" maxLength={120} value={description} onChange={e => setDescription(e.target.value)} /></label>
      <label className={FIELD}><span>By</span><Input className={CONTROL} aria-label="Revision by" maxLength={60} value={by} onChange={e => setBy(e.target.value)} /></label>
      <Button variant="ghost" aria-label="Record revision" disabled={!settings.revision || !description.trim() || !date || rows.some(r => r.revision === settings.revision) || rows.length >= 50} onClick={record}>Record revision</Button>
    </details>
  </>;
}

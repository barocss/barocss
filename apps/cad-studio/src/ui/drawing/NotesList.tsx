// The drawing's NOTES (O16: split from DrawingWorkspace, on shadcn's components): each note's first line and leader; the selected one's text.
import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { DrawingNote, DrawingSettings } from '@barocss/cad-model/drawing/types';
import { Icon, Kbd } from '../atoms';
import { Button } from '@/components/ui/button';

export function NotesList({ settings, selected, selNote, noteDraft, setNoteDraft, noteBox, onSelect, remove, onRemoveLeader, onDuplicate, onChange }: {
  settings: DrawingSettings; selected: string | null; selNote: DrawingNote | undefined; noteDraft: string | null; setNoteDraft: Dispatch<SetStateAction<string | null>>;
  noteBox: RefObject<HTMLTextAreaElement | null>; onSelect(note: DrawingNote): void; remove(id: string): void; onRemoveLeader(note: DrawingNote): void; onDuplicate(note: DrawingNote): void;
  onChange(next: DrawingSettings): void;
}) {
  return <>
        <div className="card-title" style={{ marginTop: 8 }}>NOTES <span className="muted">{settings.notes?.length ?? 0}</span></div>
        <div className="dw-dims">
          {(settings.notes ?? []).map(n => <div key={n.id} className={'dw-dim' + (selected === n.id ? ' sel' : '')}>
            <button type="button" className="dw-annotation-select" aria-pressed={selected === n.id} onClick={() => onSelect(n)}>
              <b className="dw-note-text">{n.text.split('\n')[0]}</b><span>{n.leader ? `→ ${n.leader.view}` : ''}</span>
            </button>
            <Button variant="ghost" size="xs" aria-label={`Remove note ${n.id}`} onClick={e => { e.stopPropagation(); remove(n.id); }}><Icon name="close" small /></Button>
          </div>)}
          {!settings.notes?.length && <div className="empty"><Kbd>N</Kbd> adds a note: click the paper, or a view for a leader first.</div>}
          {selNote && <>
            <textarea ref={noteBox} className="dw-note-edit" aria-label="Note text" rows={3} value={noteDraft ?? selNote.text}
              onChange={e => setNoteDraft(e.target.value)}
              onBlur={() => { const t = (noteDraft ?? selNote.text).replace(/\s+$/, ''); if (t && t !== selNote.text) onChange({ ...settings, notes: settings.notes!.map(n => n.id === selNote.id ? { ...n, text: t } : n) }); setNoteDraft(null); }}
              onKeyDown={e => { if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) (e.target as HTMLTextAreaElement).blur(); }} />
            <div className="dw-actions">
              <Button variant="ghost" onClick={() => onDuplicate(selNote)}>Duplicate note</Button>
              {selNote.leader && <Button variant="ghost" onClick={() => onRemoveLeader(selNote)}>Remove leader</Button>}
            </div>
          </>}
        </div>
  </>;
}

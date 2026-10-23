// The drawing's NOTES (O16, split from DrawingWorkspace): each note's first line and leader; the selected one's text.
import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { DrawingNote, DrawingSettings } from '@barocss/cad-model/drawing/types';
import { Icon, Kbd } from '../atoms';

export function NotesList({ settings, selected, selNote, noteDraft, setNoteDraft, noteBox, onSelect, remove, onChange }: {
  settings: DrawingSettings; selected: string | null; selNote: DrawingNote | undefined; noteDraft: string | null; setNoteDraft: Dispatch<SetStateAction<string | null>>;
  noteBox: RefObject<HTMLTextAreaElement | null>; onSelect(note: DrawingNote): void; remove(id: string): void; onChange(next: DrawingSettings): void;
}) {
  return <>
        <div className="card-title" style={{ marginTop: 8 }}>NOTES <span className="muted">{settings.notes?.length ?? 0}</span></div>
        <div className="dw-dims">
          {(settings.notes ?? []).map(n => <div key={n.id} role="button" tabIndex={0} className={'dw-dim' + (selected === n.id ? ' sel' : '')} onClick={() => onSelect(n)}>
            <b className="dw-note-text">{n.text.split('\n')[0]}</b><span>{n.leader ? `→ ${n.leader.view}` : ''}</span><span className="muted" />
            <button className="tool tiny" aria-label={`Remove note ${n.id}`} onClick={e => { e.stopPropagation(); remove(n.id); }}><Icon name="close" small /></button>
          </div>)}
          {!settings.notes?.length && <div className="empty"><Kbd>N</Kbd> adds a note: click the paper, or a view for a leader first.</div>}
          {selNote && <>
            <textarea ref={noteBox} className="dw-note-edit" aria-label="Note text" rows={3} value={noteDraft ?? selNote.text}
              onChange={e => setNoteDraft(e.target.value)}
              onBlur={() => { const t = (noteDraft ?? selNote.text).replace(/\s+$/, ''); if (t && t !== selNote.text) onChange({ ...settings, notes: settings.notes!.map(n => n.id === selNote.id ? { ...n, text: t } : n) }); setNoteDraft(null); }}
              onKeyDown={e => { if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) (e.target as HTMLTextAreaElement).blur(); }} />
            {selNote.leader && <button className="ghost" onClick={() => onChange({ ...settings, notes: settings.notes!.map(n => n.id === selNote.id ? { id: n.id, text: n.text, at: n.at } : n) })}>Remove leader</button>}
          </>}
        </div>
  </>;
}

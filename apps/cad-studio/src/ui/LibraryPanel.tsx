// The part libraries (LIB4, D64): built-in, team and user, each with its licence (or "unlicensed — private use only"),
// how many of its values are estimates, and whether an agent wrote it (confirmed or not). A part is inserted into the
// part, or as a new placed part; a user library is added from a file, and shared with the team only when it is
// licensed, confirmed if an agent wrote it, and passes its check (run again by the server).
import { useEffect, useState } from 'react';
import type { StudioDoc } from '../engine/doc';
import { confirmDocLibrary, insertLibraryPart, libraries, libraryEntry, libraryInstance, registerDocLibraries, registerLibrary, shareRefusal, type LibraryEntry, type LibrarySource } from '../library/libraries';
import { UNLICENSED } from '../library/sharing';
import { Icon } from './atoms';

const SOURCES: { source: LibrarySource; title: string }[] = [{ source: 'built-in', title: 'BUILT-IN' }, { source: 'team', title: 'TEAM' }, { source: 'user', title: 'YOURS' }];

export function LibraryPanel({ doc, onCommit, onError, onClose }: { doc: StudioDoc; onCommit(next: StudioDoc): void; onError(title: string, message: string): void; onClose(): void }) {
  const [, setTick] = useState(0), refresh = () => setTick(t => t + 1);
  const [variant, setVariant] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  // The document's own libraries, and the team's from the chat server's folder when it has one.
  useEffect(() => { registerDocLibraries(doc); refresh(); }, [doc.libraries]);
  useEffect(() => {
    let live = true;
    fetch('/api/chat/libraries').then(r => r.ok ? r.json() : null).then((j: { libraries?: { library: unknown; check?: unknown }[] } | null) => {
      if (!live || !j?.libraries) return;
      for (const t of j.libraries) { try { registerLibrary(t.library, 'team'); } catch { /* a team file that does not load is not listed */ } }
      refresh();
    }).catch(() => { /* no chat server: no team libraries */ });
    return () => { live = false; };
  }, []);
  const insert = (e: LibraryEntry, part: string, asInstance: boolean) => {
    const v = variant[`${e.library.manifest.id}/${part}`] ?? e.library.parts.get(part)?.part.variants?.[0]?.id;
    try {
      onCommit(asInstance ? libraryInstance(doc, e.library.manifest.id, part, v ? { variant: v } : {}).doc : insertLibraryPart(doc, e.library.manifest.id, part, v ? { variant: v } : {}));
    } catch (cause) { onError('Could not insert the part', cause instanceof Error ? cause.message.replace(/^library: /, '') : String(cause)); }
  };
  const addFile = async (file: File) => {
    try { registerLibrary(JSON.parse(await file.text()), 'user'); refresh(); }
    catch (cause) { onError('Could not add the library', cause instanceof Error ? cause.message.replace(/^library: /, '') : String(cause)); }
  };
  const share = async (id: string) => {
    const why = shareRefusal(id); refresh();
    if (why) { onError('Not shared', why); return; }
    const e = libraryEntry(id)!; setBusy(id);
    try {
      const r = await fetch('/api/chat/libraries', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ library: e.library.manifest, authoredBy: e.authoredBy, confirmed: e.confirmed }) });
      const j = await r.json() as { error?: string };
      if (!r.ok) onError('Not shared', j.error ?? `the team folder answered ${r.status}`); else { registerLibrary(e.library.manifest, 'team', { authoredBy: e.authoredBy, confirmed: e.confirmed }); refresh(); }
    } catch { onError('Not shared', 'The chat server (and its team folder) is not running.'); }
    finally { setBusy(null); }
  };
  const all = libraries();
  return <aside className="card props library-panel" aria-label="Library panel">
    <div className="card-title">LIBRARY <button className="tool tiny" aria-label="Close library" onClick={onClose}><Icon name="close" small /></button></div>
    {SOURCES.map(({ source, title }) => {
      const list = all.filter(e => e.source === source);
      return <section key={source} aria-label={`${title} libraries`}>
        <div className="card-title" style={{ marginTop: 8 }}>{title}</div>
        {!list.length && <div className="empty">{source === 'team' ? 'No team libraries (the chat server shares its team folder).' : source === 'user' ? 'Add a library file (JSON) of your own.' : ''}</div>}
        {list.map(e => {
          const m = e.library.manifest, agent = e.authoredBy === 'agent';
          return <div key={m.id} className="library" aria-label={`Library ${m.id}`}>
            <div className="param-row"><b>{m.name}</b><span className="muted small">{m.libraryVersion}</span></div>
            <div className="muted small" aria-label={`Licence of ${m.id}`}>{e.license ?? UNLICENSED} · {e.estimates} estimate{e.estimates === 1 ? '' : 's'}</div>
            {agent && <div className="param-row small"><span className={e.confirmed ? 'muted' : 'warn'}>{e.confirmed ? 'Written by an agent, confirmed' : 'Written by an agent: not confirmed'}</span>
              {!e.confirmed && <button className="ghost small" aria-label={`Confirm ${m.id}`} onClick={() => { onCommit(confirmDocLibrary(doc, m.id)); refresh(); }}>Confirm</button>}</div>}
            {m.parts.map(p => <div key={p.id} className="param-row" aria-label={`Part ${p.id}`}>
              <span title={p.description ?? ''}>{p.name}</span>
              {!!p.variants?.length && <select aria-label={`Variant of ${p.id}`} value={variant[`${m.id}/${p.id}`] ?? p.variants[0].id} onChange={ev => setVariant(v => ({ ...v, [`${m.id}/${p.id}`]: ev.target.value }))}>
                {p.variants.map(v => <option key={v.id} value={v.id}>{v.name ?? v.id}</option>)}</select>}
              <button className="ghost small" aria-label={`Insert ${p.id}`} data-tip="Insert" data-tip-desc="Into this part" onClick={() => insert(e, p.id, false)}>Insert</button>
              <button className="ghost small" aria-label={`Place ${p.id}`} data-tip="Place" data-tip-desc="As a new placed part (snap it by its interfaces)" onClick={() => insert(e, p.id, true)}>Place</button>
            </div>)}
            {source === 'user' && <button className="ghost small" aria-label={`Share ${m.id}`} disabled={busy === m.id} onClick={() => void share(m.id)}>Share with the team</button>}
          </div>;
        })}
      </section>;
    })}
    <label className="ghost small file-button">Add a library file…<input type="file" accept="application/json,.json" aria-label="Library file" hidden onChange={ev => { const f = ev.currentTarget.files?.[0]; if (f) void addFile(f); ev.currentTarget.value = ''; }} /></label>
  </aside>;
}

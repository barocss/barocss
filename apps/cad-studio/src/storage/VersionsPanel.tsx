// CG6 S2/S3 (DA-5): the Project & versions card — the project open (a folder on disk, or one kept in this browser), its
// documents, the open document's versions (make, restore, compare with the working document) and branches (make,
// switch, merge with the conflicts answered one by one). Compare lists what changed (versions/compare.ts) and asks the
// App to show the geometry's difference in the viewport (the proposal overlay, G12).
import { useMemo, useState } from 'react';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { changesOf, type DocChanges } from '@barocss/cad-model/versions/compare';
import { versionsOf, headOf } from '@barocss/cad-model/versions/log';
import type { Conflict, Resolutions, Side } from '@barocss/cad-model/versions/merge';
import { canKeepInBrowser, canPickFolder } from './access';
import type { ProjectActions } from './useProject';
import { DockSection } from '../layout/DockSection';
import { ROW } from '../ui/panelStyles';
import { Button } from '@/components/ui/button';
import { Input as TextInput } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';

const KIND = { folder: 'folder', browser: 'in this browser', memory: 'in memory', cloud: 'cloud' } as const;
const when = (at: string) => new Date(at).toLocaleString();
const stop = (e: { stopPropagation(): void }) => e.stopPropagation();
/** A conflict side's value, when it is one short value (a parameter's number, a name). */
const shown = (v: unknown) => v === undefined ? ' (deleted)' : typeof v === 'number' || typeof v === 'boolean' || (typeof v === 'string' && v.length <= 24) ? ` (${String(v)})` : '';

/** One line per change, as a person reads it. */
export function changeLines(c: DocChanges): string[] {
  const out: string[] = [];
  for (const f of c.features) out.push(`${f.kind} ${f.feature} ${f.id}${f.fields?.length ? `: ${f.fields.map(x => x.path).join(', ')}` : ''}`);
  for (const p of c.parameters) out.push(`parameter ${p.name} ${p.kind}${p.kind === 'edited' ? ` ${String(p.from)} → ${String(p.to)}` : ''}`);
  for (const p of c.configurations) out.push(`configuration ${p.name} ${p.kind}`);
  for (const m of c.mates) out.push(`mate ${m.id} ${m.kind}`);
  for (const i of c.instances) out.push(`placed part ${i.id} ${i.kind}${i.fields?.length ? `: ${i.fields.map(x => x.path).join(', ')}` : ''}`);
  for (const f of c.fields) out.push(`${f} changed`);
  return out;
}

export function VersionsPanel({ project, doc, fileName, onOpen, onCompare, comparing }: {
  project: ProjectActions; doc: StudioDoc; fileName: string;
  /** A document to work on: restored, switched to or merged. */
  onOpen(next: StudioDoc): void;
  /** Compare the working document with a version's (its id and document), or stop (null). */
  onCompare(base: { id: string; doc: StudioDoc } | null): void;
  comparing: string | null;
}) {
  const { view } = project, log = view.log;
  const [browserName, setBrowserName] = useState('My project');
  const [versionName, setVersionName] = useState('');
  const [branchName, setBranchName] = useState('');
  const [mergeFrom, setMergeFrom] = useState('');
  const [conflicts, setConflicts] = useState<Conflict[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, Side>>({});
  const list = useMemo(() => log ? versionsOf(log) : [], [log]);
  const head = log ? headOf(log).id : null;
  const compared = useMemo(() => { if (!log || !comparing) return null; const v = log.versions.find(x => x.id === comparing); return v ? changesOf(log.snapshots[v.snapshot], doc) : null; }, [log, comparing, doc]);
  const others = log ? log.branches.filter(b => b.name !== log.current) : [];

  const merge = async (resolve?: Resolutions) => {
    const r = await project.merge(mergeFrom || others[0]?.name, doc, resolve);
    if (!r) return;
    if ('conflicts' in r) { setConflicts(r.conflicts); return; }
    setConflicts(null); setAnswers({}); onOpen(r.doc);
  };

  if (!view.store) return <aside className="card props" aria-label="Versions panel"><DockSection id="versions" title="Project & versions" summary="no project">
    <div className="empty" role="status">Open a project to save into it and keep versions. A project is a folder of .bcad files; its versions are kept beside them in .barocss.</div>
    <div className="flex flex-wrap gap-1 py-1">
      {canPickFolder() && <Button variant="default" aria-label="Open folder" onClick={() => void project.openFolder()}>Open folder…</Button>}
      {canPickFolder() && project.recent && <Button variant="ghost" aria-label={`Reopen ${project.recent}`} onClick={() => void project.reopen()}>Reopen {project.recent}</Button>}
    </div>
    {canKeepInBrowser() && <form className={ROW} onSubmit={e => { e.preventDefault(); if (browserName.trim()) void project.openInBrowser(browserName.trim()); }}>
      <TextInput aria-label="Browser project name" value={browserName} onChange={e => setBrowserName(e.target.value)} onKeyDown={stop} />
      <Button type="submit" variant="ghost" aria-label="Project in this browser">Keep in this browser</Button>
    </form>}
  </DockSection></aside>;

  return <aside className="card props" aria-label="Versions panel"><DockSection id="versions" title="Project & versions" summary={log ? log.current : view.store.name}>
    <div className={ROW} aria-label="Project">
      <span title={view.store.name}><b>{view.store.name}</b> <span className="text-muted-foreground">· {KIND[view.store.kind]}</span></span>
      <Button variant="ghost" size="xs" aria-label="Close project" onClick={() => project.close()}>Close</Button>
    </div>
    <div className="card-title" style={{ marginTop: 6 }}>DOCUMENTS · {view.parts.length}</div>
    <ul className="m-0 list-none p-0" aria-label="Project documents">{view.parts.map(p => <li key={p.path} className={ROW} data-active={p.path === view.part || undefined}>
      <span className={p.path === view.part ? 'font-semibold' : ''}>{p.path}</span>
      {p.path !== view.part && <Button variant="ghost" size="xs" aria-label={`Open ${p.path}`} onClick={() => void project.openPart(p.path)}>Open</Button>}
    </li>)}</ul>
    {view.offered && <div className="mt-1 rounded-md border px-2 py-1.5 text-[11px]" role="status" aria-label="Autosaved work">
      Work on {view.part} since its last save was kept.{' '}
      <Button variant="ghost" size="xs" aria-label="Restore autosaved work" onClick={async () => { const d = await project.settleOffered(true); if (d) onOpen(d); }}>Restore</Button>
      <Button variant="ghost" size="xs" aria-label="Discard autosaved work" onClick={() => void project.settleOffered(false)}>Discard</Button>
    </div>}

    <div className="card-title" style={{ marginTop: 8 }}>VERSIONS{log ? ` · ${log.current}` : ''}</div>
    <form className={ROW} onSubmit={async e => { e.preventDefault(); if (await project.makeVersion(doc, fileName, { versionName: versionName.trim() || undefined })) setVersionName(''); }}>
      <TextInput aria-label="Version name" placeholder="Name (optional)" value={versionName} onChange={e => setVersionName(e.target.value)} onKeyDown={stop} />
      <Button type="submit" variant="default" aria-label="Make version">Make version</Button>
    </form>
    {!log && <div className="py-0.5 text-[11px] text-muted-foreground" role="status">No versions yet: Make version saves the document and keeps this state.</div>}
    <ul className="m-0 list-none p-0" aria-label="Versions">{list.map(v => <li key={v.id} className={ROW} aria-label={`Version ${v.name ?? v.id}`}>
      <span title={`${v.id} · ${when(v.at)}${v.note ? ` · ${v.note}` : ''}`}>{v.name ?? <span className="text-muted-foreground">{v.parents.length > 1 ? v.note ?? 'merge' : when(v.at)}</span>}{v.name && v.parents.length > 1 && <span className="text-muted-foreground"> · merge</span>}</span>
      {v.id === head && <span className="shrink-0 rounded-full border border-[var(--accent)] px-1.5 text-[10px] leading-4 text-[var(--accent)]">latest</span>}
      <Button variant="ghost" size="xs" aria-label={`Compare ${v.name ?? v.id}`} onClick={() => onCompare(comparing === v.id ? null : { id: v.id, doc: log!.snapshots[v.snapshot] })}>{comparing === v.id ? 'Hide' : 'Compare'}</Button>
      <Button variant="ghost" size="xs" aria-label={`Restore ${v.name ?? v.id}`} onClick={() => { const d = project.restore(v.id); if (d) onOpen(d); }}>Restore</Button>
    </li>)}</ul>
    {compared && <div className="mt-1 text-[11px]" role="status" aria-label="Compared changes">
      <div className="text-muted-foreground">From the version to the working document{compared.same ? ': the same' : ''}</div>
      <ul className="m-0 list-disc pl-4">{changeLines(compared).map((l, k) => <li key={k}>{l}</li>)}</ul>
    </div>}

    {log && <>
      <div className="card-title" style={{ marginTop: 8 }}>BRANCHES · {log.branches.length}</div>
      <label className={ROW}><span>Working on</span>
        <NativeSelect aria-label="Branch" value={log.current} onChange={async e => { const d = await project.switchBranch(e.target.value, doc); if (d) onOpen(d); }}>
          {log.branches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}</NativeSelect></label>
      <form className={ROW} onSubmit={async e => { e.preventDefault(); if (branchName.trim() && await project.makeBranch(branchName.trim())) setBranchName(''); }}>
        <TextInput aria-label="Branch name" placeholder="New branch from the latest" value={branchName} onChange={e => setBranchName(e.target.value)} onKeyDown={stop} />
        <Button type="submit" variant="ghost" aria-label="Make branch" disabled={!branchName.trim()}>Branch</Button>
      </form>
      {!!others.length && <div className={ROW}>
        <NativeSelect aria-label="Merge from" value={mergeFrom || others[0].name} onChange={e => { setMergeFrom(e.target.value); setConflicts(null); }}>
          {others.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}</NativeSelect>
        <Button variant="ghost" aria-label="Merge" onClick={() => void merge()}>Merge into {log.current}</Button>
      </div>}
      {conflicts && <div className="mt-1 text-[11px]" role="alert" aria-label="Merge conflicts">
        <div className="warn">{conflicts.length} conflict{conflicts.length === 1 ? '' : 's'}: choose a side for each.</div>
        {conflicts.map(c => <div key={c.where} className="py-0.5" aria-label={`Conflict ${c.where}`}>
          <div title={c.message}>{c.message.replace(/^\[[A-Z_]+\] /, '')}</div>
          {(['ours', 'theirs'] as const).map(side => <label key={side} className="mr-2 inline-flex items-center gap-1">
            <input type="radio" name={c.where} aria-label={`${c.where} ${side}`} checked={answers[c.where] === side} onChange={() => setAnswers({ ...answers, [c.where]: side })} />
            {side === 'ours' ? log.current : (mergeFrom || others[0]?.name)}{shown(c[side])}</label>)}
        </div>)}
        <Button variant="default" aria-label="Merge with these answers" disabled={conflicts.some(c => !answers[c.where])} onClick={() => void merge({ ...answers })}>Merge with these answers</Button>
      </div>}
    </>}
  </DockSection></aside>;
}

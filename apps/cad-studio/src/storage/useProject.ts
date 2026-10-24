// CG6 S1b (DA-5): the open project in the studio — which store, which document of it is open (its path and the tag it
// was read or saved with), its version log, and the actions on them. The App keeps the document; this keeps the files.
// Every write expects the tag it read, so a file changed meanwhile (another tab, another program) is said, never
// written over. Version actions are versions/*.ts's, each written back to the project at once.
import { useMemo, useRef, useState } from 'react';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { applyBranch, makeBranch, makeVersion, makeVersions, readVersion, type VersionLog } from '@barocss/cad-model/versions/log';
import { applyMerge, type MergeResult, type Resolutions } from '@barocss/cad-model/versions/merge';
import { BarocssError } from '@barocss/cad/api';
import { browserProject, pickFolder, recentFolder, reopenFolder } from './access';
import { clearAutosave, partsOf, readAutosave, readPart, readVersions, writeAutosave, writePart, writeVersions } from './project';
import type { ProjectStore, StoreEntry } from './store';
import type { DirHandle } from './handleStore';

export interface ProjectView {
  store: ProjectStore | null;
  /** The open document's path in the project (null: not saved into it yet). */
  part: string | null;
  parts: StoreEntry[];
  log: VersionLog | null;
  /** Autosaved work found for the open document, offered back. */
  offered: StudioDoc | null;
}
export interface ProjectCallbacks {
  /** A document of the project opened (as Open opens a file): the App replaces its document. */
  onOpened(doc: StudioDoc, path: string, notes: string[]): void;
  onError(title: string, hint: string): void;
}
const EMPTY: ProjectView = { store: null, part: null, parts: [], log: null, offered: null };
/** A file name as a project path: `<name>.bcad`. */
export const partPathOf = (name: string) => /\.bcad$/i.test(name) ? name : `${name}.bcad`;
const now = () => new Date().toISOString();
const say = (e: unknown) => e instanceof BarocssError ? e.message : e instanceof Error ? e.message : String(e);

export function useProject(cb: ProjectCallbacks) {
  const [view, setView] = useState<ProjectView>(EMPTY);
  const [recent, setRecent] = useState<DirHandle | null>(null);
  // (The tags read with — not shown, so not state — and the view as the async actions see it.)
  const tags = useRef<{ part: string | null; log: string | null }>({ part: null, log: null });
  const live = useRef(view); live.current = view;
  const call = useRef(cb); call.current = cb;

  const actions = useMemo(() => {
    const set = (next: Partial<ProjectView>) => { live.current = { ...live.current, ...next }; setView(live.current); };
    const fail = (title: string, e: unknown) => { call.current.onError(title, say(e)); return false; };
    const refresh = async (store: ProjectStore) => set({ parts: await partsOf(store) });
    const loadLog = async (store: ProjectStore, part: string) => {
      const r = await readVersions(store, part);
      if (r && 'error' in r) { call.current.onError('The versions could not be read', `${r.error} The document itself is unchanged.`); tags.current.log = null; set({ log: null }); return; }
      tags.current.log = r?.tag ?? null; set({ log: r?.log ?? null });
    };
    const use = async (store: ProjectStore | null) => {
      if (!store) return;
      tags.current = { part: null, log: null };
      set({ ...EMPTY, store });
      await refresh(store).catch(e => fail('The project could not be read', e));
    };
    /** The log written back; on a change meanwhile, read again and said. */
    const keepLog = async (store: ProjectStore, part: string, log: VersionLog) => {
      try { tags.current.log = (await writeVersions(store, part, log, { expect: tags.current.log })).tag; set({ log }); return true; }
      catch (e) {
        if (e instanceof BarocssError && e.code === 'STORAGE_CHANGED') { await loadLog(store, part); return fail('The versions changed elsewhere', new Error('Another window or program changed them: they are read again. Try once more.')); }
        return fail('The version was not kept', e);
      }
    };
    const actions = {
      async loadRecent() { setRecent(await recentFolder()); },
      async openFolder() { try { await use(await pickFolder()); } catch (e) { fail('The folder could not be opened', e); } },
      async reopen() { if (!recent) return; try { const s = await reopenFolder(recent); if (s) await use(s); else call.current.onError('No access to the folder', 'The browser did not allow it. Open the folder again.'); } catch (e) { fail('The folder could not be opened', e); } },
      async openInBrowser(name: string) { try { await use(await browserProject(name)); } catch (e) { fail('The project could not be opened', e); } },
      close() { tags.current = { part: null, log: null }; set(EMPTY); },
      /** A document of the project opened, its versions read, its autosaved work offered when there is some. */
      async openPart(path: string) {
        const store = live.current.store; if (!store) return false;
        try {
          const r = await readPart(store, path);
          if ('error' in r) return fail(`Could not open ${path}`, new Error(r.error));
          tags.current.part = r.tag; set({ part: path, offered: null });
          call.current.onOpened(r.doc, path, r.notes);
          await loadLog(store, path);
          const a = await readAutosave(store, path);
          if (a && 'doc' in a) set({ offered: a.doc });
          return true;
        } catch (e) { return fail(`Could not open ${path}`, e); }
      },
      /** Saved into the project: over the file it was read from (its tag expected), or as `name` when new there. */
      async save(doc: StudioDoc, name: string) {
        const store = live.current.store; if (!store) return false;
        const path = live.current.part ?? partPathOf(name);
        try {
          tags.current.part = (await writePart(store, path, doc, { expect: live.current.part ? tags.current.part : null })).tag;
          if (!live.current.part) await loadLog(store, path);
          set({ part: path, offered: null });
          await clearAutosave(store, path).catch(() => {});
          await refresh(store);
          return true;
        } catch (e) {
          if (e instanceof BarocssError && e.code === 'STORAGE_CHANGED') return fail(`${path} changed elsewhere`, new Error(live.current.part ? 'Another window or program saved it since it was opened. Open it again, or save under another name.' : `The project already has ${path}. Save under another name.`));
          return fail('Could not save', e);
        }
      },
      /** The work kept in the project a moment after a change (no-op until the document has a path there). */
      async autosave(doc: StudioDoc) { const { store, part } = live.current; if (store && part) await writeAutosave(store, part, doc).catch(() => {}); },
      /** The offered autosave answered: restored (the caller commits it) or discarded. */
      async settleOffered(restore: boolean) { const { store, part, offered } = live.current; set({ offered: null }); if (!restore && store && part) await clearAutosave(store, part).catch(() => {}); return restore ? offered : null; },

      /** A version of the document: saved first (a version is a save with a name), then recorded. */
      async makeVersion(doc: StudioDoc, name: string, o: { versionName?: string; note?: string } = {}) {
        if (!(await actions.save(doc, name))) return false;
        const { store, part, log } = live.current;
        try {
          const next = log ? makeVersion(log, doc, { at: now(), name: o.versionName, note: o.note }).log : makeVersions(doc, { at: now(), name: o.versionName, note: o.note });
          return keepLog(store!, part!, next);
        } catch (e) { return fail('No version made', e); }
      },
      /** A version's document, to work on (history is not rewound: saving it makes a new version). */
      restore(id: string): StudioDoc | null { const { log } = live.current; try { return log ? readVersion(log, id) : null; } catch (e) { fail('Could not restore', e); return null; } },
      async makeBranch(name: string, from?: string) {
        const { store, part, log } = live.current; if (!store || !part || !log) return false;
        try { return keepLog(store, part, makeBranch(log, name, { from })); } catch (e) { return fail('No branch made', e); }
      },
      /** Work switched to a branch: its head's document returned for the App to open. */
      async switchBranch(name: string, working: StudioDoc, discard = false): Promise<StudioDoc | null> {
        const { store, part, log } = live.current; if (!store || !part || !log) return null;
        try { const r = applyBranch(log, name, working, { discard }); return (await keepLog(store, part, r.log)) ? r.doc : null; }
        catch (e) { fail('Could not switch', e); return null; }
      },
      /** A branch merged into the current one; the conflicts returned for the person to answer. */
      async merge(from: string, working: StudioDoc, resolve?: Resolutions): Promise<MergeResult | null> {
        const { store, part, log } = live.current; if (!store || !part || !log) return null;
        try {
          const r = applyMerge(log, { from, working, at: now(), resolve });
          if ('conflicts' in r) return r;
          return (await keepLog(store, part, r.log)) ? r : null;
        } catch (e) { fail('Could not merge', e); return null; }
      },
    };
    return actions;
  }, [recent]);
  return { ...actions, view, recent: recent?.name ?? null };
}

/** The project's view and actions together, as the App and the panels take them. */
export type ProjectActions = ReturnType<typeof useProject>;

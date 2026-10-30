// CG6 S1b (DA-5): the open project in the studio — which store, which document of it is open (its path and the tag it
// was read or saved with), its version log, and the actions on them. The App keeps the document; this keeps the files.
// Every write expects the tag it read, so a file changed meanwhile (another tab, another program) is said, never
// written over. Version actions are versions/*.ts's, each written back to the project at once.
import { useMemo, useRef, useState } from 'react';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { applyBranch, makeBranch, makeVersion, makeVersions, readVersion, turnLog, withTurnLog, type VersionLog } from '@barocss/cad-model/versions/log';
import { applyMerge, type MergeResult, type Resolutions } from '@barocss/cad-model/versions/merge';
import { BarocssError } from '@barocss/cad/api';
import { browserProject, pickFolder, recentFolder, reopenFolder } from './access';
import { clearAutosave, partsOf, readAutosave, readPart, readVersions, writeAutosave, writePart, writeVersions } from './project';
import type { ProjectStore, StoreEntry } from './store';
import type { DirHandle } from './handleStore';
import { linkedRevisions, type Linked } from './linked';
import { acceptSaveReceipt } from '../state/saveOwnership';
import type { OpenIntentBridge, OpenScope } from '../state/openOwnership';

export interface ProjectView {
  store: ProjectStore | null;
  /** The open document's path in the project (null: not saved into it yet). */
  part: string | null;
  parts: StoreEntry[];
  log: VersionLog | null;
  /** Autosaved work found for the open document, offered back. */
  offered: StudioDoc | null;
}
export interface ProjectCallbacks extends OpenIntentBridge {
  /** A document of the project opened (as Open opens a file): the App replaces its document. */
  onOpened(doc: StudioDoc, path: string, notes: string[]): OpenScope | void;
  onError(title: string, hint: string): void;
  /** Placed parts whose project files differ (offered as waiting revisions), or that the project no longer has. */
  onLinked?(linked: Linked): void;
}
interface OpenOwner { request: object; scope?: OpenScope; session?: object; store?: ProjectStore; path?: string | null }
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
  const opening = useRef<object>({}), projectSession = useRef<object>({});
  const saves = useRef({ path: null as string | null, next: 0, success: 0 });
  const live = useRef(view); live.current = view;
  const call = useRef(cb); call.current = cb;
  // (The versions a turn's call asked for and did not have: sent with the next turn, DA-9.)
  const wanted = useRef<string[]>([]);

  const actions = useMemo(() => {
    const beginOpen = (): OpenOwner => {
      const request = {}; opening.current = request;
      return { request, scope: call.current.onOpenIntent?.() };
    };
    const currentOpen = (owner: OpenOwner) => opening.current === owner.request
      && (owner.session === undefined || projectSession.current === owner.session)
      && (owner.store === undefined || live.current.store === owner.store)
      && (owner.path === undefined || live.current.part === owner.path)
      && (owner.scope === undefined || call.current.isOpenCurrent?.(owner.scope) !== false);
    const invalidateSaves = (path: string | null = null) => { saves.current = { path, next: saves.current.next, success: 0 }; };
    const set = (next: Partial<ProjectView>) => { live.current = { ...live.current, ...next }; setView(live.current); };
    const fail = (title: string, e: unknown) => { call.current.onError(title, say(e)); return false; };
    const refresh = async (store: ProjectStore, current: () => boolean) => {
      const parts = await partsOf(store);
      if (current()) set({ parts });
    };
    const loadLog = async (store: ProjectStore, part: string, current?: () => boolean) => {
      const r = await readVersions(store, part);
      if (current && !current()) return;
      if (r && 'error' in r) { call.current.onError('The versions could not be read', `${r.error} The document itself is unchanged.`); tags.current.log = null; set({ log: null }); return; }
      tags.current.log = r?.tag ?? null; set({ log: r?.log ?? null });
    };
    const use = async (store: ProjectStore | null, owner: OpenOwner) => {
      if (!store || !currentOpen(owner)) return;
      // Picker, store adoption and refresh retain one request; a late picker must not mint new authority.
      owner.session = projectSession.current = {}; owner.store = store;
      invalidateSaves();
      tags.current = { part: null, log: null };
      set({ ...EMPTY, store });
      await refresh(store, () => currentOpen(owner)).catch(e => { if (currentOpen(owner)) fail('The project could not be read', e); });
    };
    const checkLinked = async (doc: StudioDoc, store: ProjectStore, current: () => boolean): Promise<boolean> => {
      if (!doc.instances?.length) return current();
      try {
        const linked = await linkedRevisions(doc, store);
        if (!current()) return false;
        // The callback can commit its own accepted revision; do not classify that synchronous change as stale.
        if (linked.offered.length || linked.missing.length) call.current.onLinked?.(linked);
        return true;
      } catch (e) { if (!current()) return false; fail('The placed parts could not be checked', e); return true; }
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
      async openFolder() { const owner = beginOpen(); try { await use(await pickFolder(), owner); } catch (e) { if (currentOpen(owner)) fail('The folder could not be opened', e); } },
      async reopen() {
        const owner = beginOpen(); if (!recent) return;
        try {
          const store = await reopenFolder(recent);
          if (!currentOpen(owner)) return;
          if (store) await use(store, owner);
          else call.current.onError('No access to the folder', 'The browser did not allow it. Open the folder again.');
        } catch (e) { if (currentOpen(owner)) fail('The folder could not be opened', e); }
      },
      async openInBrowser(name: string) { const owner = beginOpen(); try { await use(await browserProject(name), owner); } catch (e) { if (currentOpen(owner)) fail('The project could not be opened', e); } },
      close() { beginOpen(); projectSession.current = {}; invalidateSaves(); tags.current = { part: null, log: null }; set(EMPTY); },
      /** The document no longer the open one of the project (a new part, another file): the project stays open, the next save is a new file in it. */
      detach() { beginOpen(); projectSession.current = {}; invalidateSaves(); if (!live.current.part && !live.current.log) return; tags.current = { part: null, log: null }; set({ part: null, log: null, offered: null }); },
      /** A document of the project opened, its versions read, its autosaved work offered when there is some. */
      async openPart(path: string) {
        const owner = beginOpen(), store = live.current.store; if (!store) return false;
        owner.session = projectSession.current; owner.store = store;
        invalidateSaves(path);
        const current = () => currentOpen(owner);
        try {
          const r = await readPart(store, path);
          if (!current()) return false;
          if ('error' in r) return fail(`Could not open ${path}`, new Error(r.error));
          tags.current.part = r.tag; set({ part: path, offered: null }); owner.path = path;
          const accepted = call.current.onOpened(r.doc, path, r.notes);
          if (accepted) owner.scope = accepted;
          if (!current()) return false;
          await loadLog(store, path, current);
          if (!current()) return false;
          const a = await readAutosave(store, path);
          if (!current()) return false;
          if (a && 'doc' in a) set({ offered: a.doc });
          return await checkLinked(r.doc, store, current);
        } catch (e) { if (!current()) return false; return fail(`Could not open ${path}`, e); }
      },
      /** Saved into the project: over the file it was read from (its tag expected), or as `name` when new there. */
      async save(doc: StudioDoc, name: string, onCurrent?: () => void) {
        const store = live.current.store; if (!store) return false;
        const part = live.current.part, path = part ?? partPathOf(name);
        if (saves.current.path !== path) invalidateSaves(path);
        const owner = saves.current, order = ++owner.next;
        const current = () => saves.current === owner && live.current.store === store && (live.current.part === part || live.current.part === path);
        const currentSuccess = () => current() && owner.success === order;
        try {
          const written = await writePart(store, path, doc, { expect: part ? tags.current.part : null });
          if (!current() || !acceptSaveReceipt(owner, order)) return false;
          // A newer document edit must not leave this file's tag behind its own successful write.
          tags.current.part = written.tag;
          set({ part: path, offered: null });
          if (!part) {
            const r = await readVersions(store, path);
            if (!currentSuccess()) return false;
            if (r && 'error' in r) { call.current.onError('The versions could not be read', `${r.error} The document itself is unchanged.`); tags.current.log = null; set({ log: null }); }
            else { tags.current.log = r?.tag ?? null; set({ log: r?.log ?? null }); }
          }
          const parts = await partsOf(store);
          if (!currentSuccess()) return false;
          set({ parts });
          // Keep one checkpoint per path. readAutosave hides saved-equal bytes without racing a newer write/remove.
          if (!currentSuccess()) return false;
          onCurrent?.();
          return true;
        } catch (e) {
          if (!current() || order < owner.success) return false;
          if (e instanceof BarocssError && e.code === 'STORAGE_CHANGED') return fail(`${path} changed elsewhere`, new Error(part ? 'Another window or program saved it since it was opened. Open it again, or save under another name.' : `The project already has ${path}. Save under another name.`));
          return fail('Could not save', e);
        }
      },
      /** The work kept in the project a moment after a change (no-op until the document has a path there). */
      async autosave(doc: StudioDoc) { const { store, part } = live.current; if (store && part) await writeAutosave(store, part, doc).catch(() => {}); },
      /** The offered autosave answered: restored (the caller commits it) or discarded. */
      async settleOffered(restore: boolean) { const { store, part, offered } = live.current; set({ offered: null }); if (!restore && store && part) await clearAutosave(store, part).catch(() => {}); return restore ? offered : null; },

      /** Placed parts referenced by their project path checked against their files (storage/linked.ts). */
      async checkLinked(doc: StudioDoc) {
        const store = live.current.store; if (!store || !doc.instances?.length) return;
        const owner: OpenOwner = { request: opening.current, session: projectSession.current, store,
          path: live.current.part, scope: call.current.currentOpenScope?.() };
        await checkLinked(doc, store, () => currentOpen(owner));
      },
      /** A document of the project as a file (to insert it as a placed part). */
      async fileOf(path: string): Promise<File | null> {
        const store = live.current.store; if (!store) return null;
        const f = await store.read(path).catch(e => { fail(`Could not read ${path}`, e); return null; });
        return f ? new File([f.bytes as BlobPart], path.split('/').pop()!) : null;
      },
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
      /** The agent's side (DA-9): the log a turn carries, and the log a turn brings back. */
      chat: {
        turn(): VersionLog | null { const log = live.current.log; return log ? turnLog(log, { wanted: wanted.current }).log : null; },
        back(log: VersionLog, asked: readonly string[]) {
          wanted.current = [...asked];
          const full = live.current.log, r = full ? withTurnLog(full, log) : { log, kept: [] as string[] };
          if (r.kept.length) call.current.onError('Branches moved twice', `The agent moved ${r.kept.join(', ')} while you did: yours stays the branch's latest; the agent's versions are kept in the list.`);
          const { store, part } = live.current;
          // (No project open, or this document not in it yet: the agent's versions kept for this session.)
          if (store && part) void keepLog(store, part, r.log); else set({ log: r.log });
        },
      },
      /** A branch merged into the current one; the conflicts returned for the person to answer. */
      async merge(from: string, working: StudioDoc, resolve?: Resolutions): Promise<MergeResult | null> {
        const { store, part, log } = live.current; if (!store || !part || !log) return null;
        try {
          const r = applyMerge(log, { from, working, at: now(), resolve, note: `merged from ${from}` });
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

// CG6 S1b (DA-5): the open project in the studio — which store, which document of it is open (its path and the tag it
// was read or saved with), its version log, and the actions on them. The App keeps the document; this keeps the files.
// Every write expects the tag it read, so a file changed meanwhile (another tab, another program) is said, never
// written over. Version actions are versions/*.ts's, each written back to the project at once.
import { useMemo, useRef, useState } from 'react';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { Problem } from '@barocss/cad-model/engine/references';
import { sha256Hex } from '@barocss/cad-model/util/digest';
import { MAX_TASK_RUN_NATIVE_BYTES } from '../chat/taskRunOffer';
import { applyBranch, makeBranch, makeVersion, makeVersions, readVersion, turnLog, withTurnLog, type VersionLog } from '@barocss/cad-model/versions/log';
import { applyMerge, type MergeResult, type Resolutions } from '@barocss/cad-model/versions/merge';
import { BarocssError } from '@barocss/cad/api';
import { browserProject, pickFolder, recentFolder, reopenFolder } from './access';
import { clearAutosave, partsOf, readAutosave, readPart, readVersions, writeAutosave, writePart, writeVersions } from './project';
import type { ProjectStore, StoreEntry, StoreFile } from './store';
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
  onOpened(doc: StudioDoc, path: string, notes: string[], prepared?: { doc: StudioDoc; problems: Problem[] }): OpenScope | false | void;
  /** Resolve the current draft before an admitted project document replaces it. */
  confirmOpen?(focus: HTMLElement | null): Promise<boolean>;
  /** Validate geometry that must be admitted before updating the active project path. */
  validateOpen?(doc: StudioDoc, current: () => boolean): Promise<{ doc: StudioDoc; problems: Problem[] } | undefined> | undefined;
  onError(title: string, hint: string): void;
  /** Placed parts whose project files differ (offered as waiting revisions), or that the project no longer has. */
  onLinked?(linked: Linked): OpenScope | void;
  /** This Open's log, autosave and linked-file work completed under its accepted App scope. */
  onOpenReady?(scope: OpenScope): void;
  /** Whether an opened file may take the document now (not while a part is edited in place): asked before the project points at it. */
  canOpen?(): boolean;
}
interface ProjectTags { part: string | null; sourceSHA256: string | null; log: string | null }
export interface ProjectDocumentBinding {
  store: ProjectStore;
  path: string;
  tags: ProjectTags;
  log: VersionLog | null;
}
interface OpenOwner { request: object; scope?: OpenScope; session?: object; store?: ProjectStore; path?: string | null }
const EMPTY: ProjectView = { store: null, part: null, parts: [], log: null, offered: null };
/** A file name as a project path: `<name>.bcad`. */
export const partPathOf = (name: string) => /\.bcad$/i.test(name) ? name : `${name}.bcad`;
const now = () => new Date().toISOString();
const taskSourceSHA = (bytes: Uint8Array) => bytes.length <= MAX_TASK_RUN_NATIVE_BYTES ? sha256Hex(bytes) : null;
const say = (e: unknown) => e instanceof BarocssError ? e.message : e instanceof Error ? e.message : String(e);

export function useProject(cb: ProjectCallbacks) {
  const [view, setView] = useState<ProjectView>(EMPTY);
  const [recent, setRecent] = useState<DirHandle | null>(null);
  // (The tags read with — not shown, so not state — and the view as the async actions see it.)
  const tags = useRef<ProjectTags>({ part: null, sourceSHA256: null, log: null });
  const opening = useRef({ serial: 0 }), projectSession = useRef<object>({}), reading = useRef(0);
  const saves = useRef({ path: null as string | null, next: 0, success: 0 });
  const autosaves = useRef<{ owner: OpenOwner; next: number; settled: number; warned: boolean } | null>(null);
  const live = useRef(view); live.current = view;
  const call = useRef(cb); call.current = cb;
  // (The versions a turn's call asked for and did not have: sent with the next turn, DA-9.)
  const wanted = useRef<{ owner: OpenOwner; ids: readonly string[] } | null>(null);

  const actions = useMemo(() => {
    const beginOpen = (): OpenOwner => {
      const request = { serial: opening.current.serial + 1 }; opening.current = request;
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
      tags.current = { part: null, sourceSHA256: null, log: null };
      set({ ...EMPTY, store });
      await refresh(store, () => currentOpen(owner)).catch(e => { if (currentOpen(owner)) fail('The project could not be read', e); });
    };
    const checkLinked = async (doc: StudioDoc, store: ProjectStore, current: () => boolean, accept?: (scope: OpenScope) => void): Promise<boolean> => {
      if (!doc.instances?.length) return current();
      try {
        const linked = await linkedRevisions(doc, store);
        if (!current()) return false;
        // The callback can commit its own accepted revision; do not classify that synchronous change as stale.
        if (linked.offered.length || linked.missing.length) {
          const accepted = call.current.onLinked?.(linked);
          // Only the automatic Open caller accepts its callback's explicit synchronous dispatch scope.
          if (accepted) accept?.(accepted);
        }
        return true;
      } catch (e) { if (!current()) return false; fail('The placed parts could not be checked', e); return true; }
    };
    const versionOwner = (): OpenOwner => ({ request: opening.current, session: projectSession.current,
      store: live.current.store ?? undefined, path: live.current.part, scope: call.current.currentOpenScope?.() });
    const taskSourceKey = () => {
      const { store, part } = live.current;
      const { part: tag, sourceSHA256 } = tags.current;
      return store && part && tag !== null && sourceSHA256 ? JSON.stringify([opening.current.serial, part, tag, sourceSHA256]) : undefined;
    };
    // A completed write still owns its log/tag after a document edit, but cannot return a replacement document.
    const currentVersion = (owner: OpenOwner) => currentOpen({ ...owner, scope: undefined });
    /** The log written back; stale receipts and conflict reloads cannot enter another document's project view. */
    const keepLog = async (store: ProjectStore, part: string, log: VersionLog, owner = versionOwner(), expect = tags.current.log,
      recoverWrite?: () => Promise<boolean>) => {
      try {
        const written = await writeVersions(store, part, log, { expect });
        if (!currentVersion(owner)) return false;
        tags.current.log = written.tag; set({ log }); return true;
      } catch (e) {
        const restored = await recoverWrite?.();
        if (!currentVersion(owner)) return false;
        const saveStatus = restored === true ? ' The previous saved file was restored.'
          : restored === false ? ' The saved file could not be restored. Check it before retrying.' : '';
        if (e instanceof BarocssError && e.code === 'STORAGE_CHANGED') {
          try { await loadLog(store, part, () => currentVersion(owner)); }
          catch (readError) { return currentVersion(owner) ? fail('The versions could not be read', readError) : false; }
          if (!currentVersion(owner)) return false;
          return fail('The versions changed elsewhere', new Error('Another window or program changed them: they are read again. Try once more.' + saveStatus));
        }
        return fail('The version was not kept', new Error(say(e) + saveStatus));
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
      close() { beginOpen(); projectSession.current = {}; invalidateSaves(); tags.current = { part: null, sourceSHA256: null, log: null }; set(EMPTY); },
      documentBinding(): ProjectDocumentBinding | null {
        const { store, part, log } = live.current;
        return store && part ? { store, path: part, tags: { ...tags.current }, log } : null;
      },
      restoreDocument(binding: ProjectDocumentBinding | null) {
        beginOpen();
        projectSession.current = {};
        const current = binding?.store === live.current.store ? binding : null;
        invalidateSaves(current?.path ?? null);
        tags.current = current ? { ...current.tags } : { part: null, sourceSHA256: null, log: null };
        set({ part: current?.path ?? null, log: current?.log ?? null, offered: null });
      },
      /** A new or external document starts without a project path. */
      detach() { actions.restoreDocument(null); },
      /** A document of the project opened, its versions read, its autosaved work offered when there is some. */
      async openPart(path: string, focus: HTMLElement | null = null) {
        const owner = beginOpen(), store = live.current.store; if (!store) return false;
        reading.current++;
        owner.session = projectSession.current; owner.store = store;
        const current = () => currentOpen(owner);
        try {
          const r = await readPart(store, path);
          if (!current()) return false;
          if ('error' in r) return fail(`Could not open ${path}`, new Error(r.error));
          if (call.current.canOpen && !call.current.canOpen()) return false;
          const check = call.current.validateOpen?.(r.doc, current);
          let prepared;
          if (check) {
            prepared = await check;
            if (!current() || (call.current.canOpen && !call.current.canOpen())) return false;
          }
          if (call.current.confirmOpen) {
            if (!(await call.current.confirmOpen(focus)) || !current() || (call.current.canOpen && !call.current.canOpen())) return false;
          }
          const accepted = call.current.onOpened(r.doc, path, r.notes, prepared);
          if (accepted === false) return false;
          if (accepted) owner.scope = accepted;
          if (!current()) return false;
          invalidateSaves(path);
          tags.current = { part: r.tag, sourceSHA256: taskSourceSHA(r.bytes), log: null };
          set({ part: path, offered: null, log: null });
          owner.path = path;
          await loadLog(store, path, current);
          if (!current()) return false;
          // Recovery is optional. Its failure must not undo a valid file Open or block its ready callback.
          try {
            const a = await readAutosave(store, path);
            if (!current()) return false;
            if (a && 'doc' in a) set({ offered: a.doc });
            else if (a && 'error' in a) call.current.onError('The recovery copy could not be read', `${a.error} The project file is open. The recovery copy has not been applied.`);
          } catch (e) {
            if (!current()) return false;
            call.current.onError('The recovery copy could not be read', `${say(e)} The project file is open. The recovery copy has not been applied.`);
          }
          if (!(await checkLinked(r.doc, store, current, scope => { owner.scope = scope; })) || !current()) return false;
          if (owner.scope) call.current.onOpenReady?.(owner.scope);
          return true;
        } catch (e) { if (!current()) return false; return fail(`Could not open ${path}`, e); }
        finally { reading.current--; }
      },
      taskSourceKey,
      async readTaskSource(key: string) {
        const { store, part } = live.current, { part: tag, sourceSHA256 } = tags.current, owner = versionOwner();
        const moved = () => new Error('The saved source moved. Save and inspect the current model again.');
        const current = () => currentOpen(owner) && taskSourceKey() === key;
        if (!store || !part || !current()) throw moved();
        const read = async () => {
          const file = await store.read(part);
          if (!current() || !file || file.tag !== tag || taskSourceSHA(file.bytes) !== sourceSHA256) throw moved();
          return file.bytes;
        };
        return { bytes: await read(), current, verify: async () => { await read(); } };
      },
      /** Saved into the project: over the file it was read from (its tag expected), or as `name` when new there. */
      async save(doc: StudioDoc, name: string, onCurrent?: () => void, versionWrite?: {
        expect: string | null;
        didWrite(receipt: StoreFile): void;
      }) {
        const store = live.current.store; if (!store) return false;
        const part = live.current.part, path = part ?? partPathOf(name);
        if (saves.current.path !== path) invalidateSaves(path);
        const owner = saves.current, order = ++owner.next;
        const current = () => saves.current === owner && live.current.store === store && (live.current.part === part || live.current.part === path);
        const currentSuccess = () => current() && owner.success === order;
        try {
          const written = await writePart(store, path, doc, { expect: versionWrite ? versionWrite.expect : part ? tags.current.part : null });
          versionWrite?.didWrite(written);
          if (!current() || !acceptSaveReceipt(owner, order)) return false;
          // A newer document edit must not leave this file's tag behind its own successful write.
          tags.current.part = written.tag;
          tags.current.sourceSHA256 = taskSourceSHA(written.bytes);
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
      async autosave(doc: StudioDoc) {
        const { store, part } = live.current; if (!store || !part) return;
        const owner = versionOwner();
        let state = autosaves.current;
        // Edits share one outage notice; another Open/project/path gets its own warning state.
        if (!state || !currentVersion(state.owner)) {
          state = { owner, next: 0, settled: 0, warned: false }; autosaves.current = state;
        }
        const order = ++state.next;
        try {
          await writeAutosave(store, part, doc);
          if (autosaves.current !== state || !currentVersion(owner) || order < state.settled) return;
          state.settled = order; state.warned = false;
        } catch (e) {
          // A failure belongs to the document that asked for this copy, not a later edit or successful write.
          if (autosaves.current !== state || !currentOpen(owner) || order < state.settled) return;
          state.settled = order;
          if (state.warned) return;
          state.warned = true;
          call.current.onError('Automatic recovery is unavailable', `${say(e)} The latest recovery copy could not be confirmed. Save to keep your current work.`);
        }
      },
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
      /** Validate a proposed version before saving its document. Publish the version after the Save succeeds. */
      async makeVersion(doc: StudioDoc, name: string, o: { versionName?: string; note?: string; onSaved?: () => void } = {}) {
        const owner = versionOwner();
        const { store, part } = live.current;
        if (!store) return false;
        const path = part ?? partPathOf(name);
        let next: VersionLog, expect: string | null, previous: StoreFile | null;
        const previousTag = part ? tags.current.part : null;
        try {
          // An Open or first Save may not have installed the destination's log yet.
          const stored = await readVersions(store, path);
          if (!currentOpen(owner)) return false;
          if (stored && 'error' in stored) return fail('No version made', new Error(stored.error));
          const options = { at: now(), name: o.versionName, note: o.note };
          expect = stored?.tag ?? null;
          const log = stored?.log;
          next = log ? makeVersion(log, doc, options).log : makeVersions(doc, options);
          previous = part ? await store.read(path) : null;
          if (!currentOpen(owner)) return false;
        } catch (e) { return currentOpen(owner) ? fail('No version made', e) : false; }
        let written: StoreFile | undefined;
        if (!(await actions.save(doc, name, undefined, { expect: previousTag, didWrite: receipt => { written = receipt; } }))) return false;
        // A first Save may assign this session's path. It must not borrow a newer Open or document edit.
        if (!currentOpen({ ...owner, path: undefined }) || live.current.part !== path) return false;
        owner.path = path;
        const receipt = written;
        const kept = await keepLog(store, path, next, owner, expect, receipt ? async () => {
          try {
            // Compare the exact write receipt before restoring the previous bytes.
            const stillBound = () => live.current.store === store && live.current.part === path && tags.current.part === receipt.tag;
            if (previous) {
              const restored = await store.write(path, previous.bytes, { expect: receipt.tag });
              if (stillBound()) {
                tags.current.part = restored.tag;
                tags.current.sourceSHA256 = taskSourceSHA(previous.bytes);
              }
            } else {
              await store.remove(path, { expect: receipt.tag });
              if (stillBound()) {
                invalidateSaves();
                tags.current = { part: null, sourceSHA256: null, log: null };
                set({ part: null, log: null, offered: null, parts: live.current.parts.filter(file => file.path !== path) });
                owner.path = null;
              }
            }
            return true;
          } catch { return false; }
        } : undefined);
        if (kept) o.onSaved?.();
        return kept;
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
        const owner = versionOwner();
        try { const r = applyBranch(log, name, working, { discard }); return (await keepLog(store, part, r.log, owner)) && currentOpen(owner) ? r.doc : null; }
        catch (e) { fail('Could not switch', e); return null; }
      },
      /** The agent's side (DA-9): the log a turn carries, and the log a turn brings back. */
      chat: {
        turn(selectedVersions: readonly string[] = []) {
          const owner = versionOwner(), log = live.current.log;
          const requested = wanted.current && currentVersion(wanted.current.owner) ? wanted.current.ids : undefined;
          return {
            log: log ? turnLog(log, { wanted: [...selectedVersions, ...(requested ?? [])] }).log : null,
            back(log: VersionLog | undefined, asked: readonly string[]) {
              if (!currentVersion(owner)) return;
              wanted.current = { owner, ids: [...asked] };
              if (!log) return;
              const full = live.current.log, r = full ? withTurnLog(full, log) : { log, kept: [] as string[] };
              if (r.kept.length) call.current.onError('Branches moved twice', `The agent moved ${r.kept.join(', ')} while you did: yours stays the branch's latest; the agent's versions are kept in the list.`);
              const { store, part } = live.current;
              // (No project open, or this document not in it yet: the agent's versions kept for this session.)
              if (store && part) void keepLog(store, part, r.log, owner); else set({ log: r.log });
            },
          };
        },
      },
      /** A branch merged into the current one; the conflicts returned for the person to answer. */
      async merge(from: string, working: StudioDoc, resolve?: Resolutions): Promise<MergeResult | null> {
        const { store, part, log } = live.current; if (!store || !part || !log) return null;
        const owner = versionOwner();
        try {
          const r = applyMerge(log, { from, working, at: now(), resolve, note: `merged from ${from}` });
          if ('conflicts' in r) return r;
          return (await keepLog(store, part, r.log, owner)) && currentOpen(owner) ? r : null;
        } catch (e) { fail('Could not merge', e); return null; }
      },
    };
    return actions;
  }, [recent]);
  /** Whether a project file is being opened (read) now. */
  const opening_ = () => reading.current > 0;
  return { ...actions, view, recent: recent?.name ?? null, opening: opening_ };
}

/** The project's view and actions together, as the App and the panels take them. */
export type ProjectActions = ReturnType<typeof useProject>;

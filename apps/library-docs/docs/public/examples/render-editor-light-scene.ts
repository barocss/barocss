/** Downloadable host example, shared by directional and point workspaces.
 * Requires a TypeScript-capable browser host and working WebGPU. No fallback renderer.
 * Call dispose() on route exit/pagehide, including while mount() is pending.
 */
import {
  parseRenderNativeLightDocument, prepareRenderNativeLightDocument,
  serializeRenderNativeLightDocument, createRenderNativeLightRequest,
  createRenderNativeLightSession,
} from '@barocss/render-editor';
import type {RenderNativeLightSession, RenderNativeLightSavePayload} from '@barocss/render-editor';

type Outcome = {ok: true} | {ok: false; error: unknown};
const refused = (error: unknown): Outcome => ({ok: false, error});

/** Pure original-source/TEN/material qualification; this does not prove GPU presentation. */
export function qualifyLightScene(text: string) {
  const document = prepareRenderNativeLightDocument(parseRenderNativeLightDocument(text)).document;
  return {document, request: createRenderNativeLightRequest(document),
    text: serializeRenderNativeLightDocument(document)};
}

/** One fixed-kind lifetime. Create another host/canvas lifetime for a new workspace. */
export function createLightSceneHost(canvas: HTMLCanvasElement, size: {width: number; height: number}) {
  let session: RenderNativeLightSession | null = null;
  let disposed = false, busy = false, started = false;
  const live = () => {
    if (disposed) throw new Error('Light host is disposed.');
  };
  const owned = () => {
    live();
    if (!session) throw new Error('Await a successful mount first.');
    return session;
  };
  const idle = () => {
    live();
    if (busy) throw new Error('A light operation is pending.');
  };
  async function run(operation: () => Promise<void>): Promise<Outcome> {
    try {idle();} catch (error) {return refused(error);}
    busy = true;
    try {await operation(); live(); return {ok: true};}
    catch (error) {return refused(error);} // Show the error; never replace the corrective draft here.
    finally {busy = false;}
  }
  async function history(direction: 'undo' | 'redo'): Promise<Outcome> {
    return run(async () => {
      const current = owned(), snapshot = current.getSnapshot();
      if (snapshot.dirty) throw new Error('Apply or explicitly discard the draft before history.');
      const candidate = direction === 'undo' ? current.prepareUndo(snapshot.version) : current.prepareRedo(snapshot.version);
      if (candidate) await current.commitPrepared(candidate);
    });
  }
  return Object.freeze({
    getSnapshot: () => session?.getSnapshot() ?? null,
    getStatus: () => session?.getStatus() ?? null,
    isPending: () => busy,
    mount(text: string): Promise<Outcome> {
      return run(async () => {
        if (started) throw new Error('This host already started. Dispose it before a new workspace.');
        started = true;
        const {document} = qualifyLightScene(text);
        const next = await createRenderNativeLightSession(canvas, document, size);
        // Factories cannot be fake-cancelled: own and dispose a late successful result.
        if (disposed) {next.dispose(); throw new Error('Host closed during startup.');}
        session = next;
      });
    },
    stage(text: string): Outcome {
      try {idle(); const current = owned(); current.setDraftText(text, current.getSnapshot().version); return {ok: true};}
      catch (error) {return refused(error);}
    },
    apply(): Promise<Outcome> {
      return run(async () => {
        const current = owned(), snapshot = current.getSnapshot();
        // Use the signed serializer: lexical "1.0" is a no-op; +0/-0 may be authored data.
        const parsed = parseRenderNativeLightDocument(snapshot.draftText);
        if (serializeRenderNativeLightDocument(parsed) === serializeRenderNativeLightDocument(snapshot.accepted)) {
          current.discardDraft(snapshot.version); return;
        }
        await current.commitPrepared(current.prepareDraft(snapshot.version));
      });
    },
    open(text: string, confirmReplacement: () => boolean = () => false): Promise<Outcome> {
      return run(async () => {
        const current = owned(), snapshot = current.getSnapshot();
        if ((snapshot.dirty || snapshot.unsaved) && !confirmReplacement()) throw new Error('Open cancelled; current data retained.');
        // Capture the version BEFORE a host callback: reentrant changes become stale, never overwritten.
        await current.commitPrepared(current.prepareOpen(text, snapshot.version));
      });
    },
    discardDraft(): Outcome {
      try {idle(); const current = owned(); current.discardDraft(current.getSnapshot().version); return {ok: true};}
      catch (error) {return refused(error);}
    },
    undo: () => history('undo'),
    redo: () => history('redo'),
    save(persist: (payload: RenderNativeLightSavePayload) => Promise<void>): Promise<Outcome> {
      return run(async () => {
        const current = owned(), payload = current.getSavePayload(); // Accepted only, even with a refused draft.
        await persist(payload); // Reject on cancellation/failure. A download click alone is not disk proof.
        live(); current.markSaved(payload); // The exact issued object, never a reconstructed lookalike.
      });
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      const previous = session; session = null;
      previous?.dispose(); // Also invalidates any in-flight candidate; late startup is handled above.
    },
  });
}

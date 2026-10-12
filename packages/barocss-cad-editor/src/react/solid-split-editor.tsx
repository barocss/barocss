import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { createSolidSplitWorkspace } from '../split-workspace.js';

export interface CadEditorSolidSplitProps {
  initialAuthoredText: string;
  initialPresentation?: 'original' | 'split';
  initialFilename?: string;
  className?: string;
}

function describeError(value: unknown): string {
  const parts: string[] = [], seen = new Set<unknown>();
  function visit(error: unknown) {
    if (!(error instanceof Error) || seen.has(error)) return;
    seen.add(error); parts.push(error.message);
    if (error instanceof AggregateError) error.errors.forEach(visit);
    visit(error.cause);
  }
  visit(value);
  return parts.join(' · ') || 'The operation could not be completed.';
}

/** Owns one private coordinator. Initial props seed this workspace only. */
export function CadEditorSolidSplit({ initialAuthoredText, initialPresentation = 'original',
  initialFilename = 'solid-split.translated-strip-plane-split.json', className }: CadEditorSolidSplitProps) {
  const [workspace] = useState(() => createSolidSplitWorkspace(initialAuthoredText, { initialPresentation, initialFilename }));
  const [snapshot, setSnapshot] = useState(() => workspace.getSnapshot());
  const [canvasKey, setCanvasKey] = useState(0), [localError, setLocalError] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [replacement, setReplacement] = useState<File | null>(null);
  const root = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null), fileInput = useRef<HTMLInputElement>(null);
  const replacementDialog = useRef<HTMLDialogElement>(null);
  const lifetime = useRef(0), contextLost = useRef(false), composing = useRef(false);
  const cutId = useId();
  const session = snapshot.session, hasDraft = draft !== null && draft !== '' || !!session && Object.hasOwn(session.pending, 'cutY');
  const blocked = snapshot.busy || !snapshot.available || !!replacement;
  const selected = snapshot.selection;
  const selectedFace = selected?.faceId ? snapshot.display?.qualifications.find(face =>
    face.componentId === selected.componentId && face.faceId === selected.faceId) : null;

  useEffect(() => {
    const epoch = ++lifetime.current;
    const unsubscribe = workspace.subscribe(() => setSnapshot(workspace.getSnapshot()));
    setSnapshot(workspace.getSnapshot());
    return () => {
      unsubscribe();
      // React's development effect replay must not destroy the retained session.
      queueMicrotask(() => { if (lifetime.current === epoch) workspace.dispose(); });
    };
  }, [workspace]);

  useEffect(() => { setDraft(null); }, [session?.generation]);

  useEffect(() => {
    const dialog = replacementDialog.current;
    if (replacement && dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, [replacement]);

  useEffect(() => {
    const element = canvas.current!;
    let mounted = false, live = true;
    function visible() {
      return element.isConnected && !element.closest('[hidden]') && element.getClientRects().length > 0
        && !['hidden', 'collapse'].includes(getComputedStyle(element).visibility);
    }
    function reconcile() {
      if (!live) return;
      const rect = element.getBoundingClientRect();
      if (!visible() || rect.width <= 0 || rect.height <= 0) {
        if (mounted) { mounted = false; workspace.unmount(); setReplacement(null); }
        return;
      }
      if (contextLost.current) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.min(2048, Math.max(1, Math.round(rect.width * ratio)));
      const height = Math.min(2048, Math.max(1, Math.round(rect.height * ratio)));
      if (!mounted) {
        mounted = true;
        void workspace.mount(element, width, height).catch(cause => { if (live) setLocalError(describeError(cause)); });
      } else if (workspace.getSnapshot().available && !workspace.getSnapshot().busy
        && (element.width !== width || element.height !== height)) {
        try { workspace.resize(width, height); } catch (cause) { setLocalError(describeError(cause)); }
      }
    }
    function lost(event: Event) {
      event.preventDefault(); contextLost.current = true;
      workspace.markUnavailable(new Error('The WebGL2 context was lost. Remount the canvas to restore the accepted Body.'));
    }
    element.addEventListener('webglcontextlost', lost);
    const resize = new ResizeObserver(reconcile); resize.observe(element);
    // The host hides visited routes rather than destroying their native sessions.
    const visibility = new MutationObserver(reconcile);
    for (let node: HTMLElement | null = element; node; node = node.parentElement)
      visibility.observe(node, { attributes: true, attributeFilter: ['hidden', 'style', 'class'] });
    window.addEventListener('hashchange', reconcile);
    const stopResize = workspace.subscribe(() => { queueMicrotask(reconcile); });
    reconcile();
    return () => {
      live = false; stopResize(); resize.disconnect(); visibility.disconnect();
      window.removeEventListener('hashchange', reconcile); element.removeEventListener('webglcontextlost', lost);
      workspace.unmount();
    };
  }, [workspace, canvasKey]);

  function run(action: () => unknown | Promise<unknown>) {
    setLocalError(null);
    try { void Promise.resolve(action()).catch(cause => setLocalError(describeError(cause))); }
    catch (cause) { setLocalError(describeError(cause)); }
  }
  function openFile(file: File, replaceDirty: boolean) {
    setReplacement(null); run(() => workspace.open(file, replaceDirty));
  }
  function historyKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.repeat || event.altKey || event.nativeEvent.isComposing || composing.current
      || (event.target instanceof HTMLElement && (event.target.isContentEditable || event.target.closest('input,textarea,select')))) return;
    const key = event.key.toLowerCase(), modifier = event.metaKey || event.ctrlKey;
    const undo = modifier && key === 'z' && !event.shiftKey;
    const redo = modifier && key === 'z' && event.shiftKey || event.ctrlKey && !event.metaKey && key === 'y';
    if (!undo && !redo) return;
    event.preventDefault(); event.stopPropagation();
    if (blocked || hasDraft || !session || !(undo ? session.history.canUndo : session.history.canRedo)) return;
    run(() => undo ? workspace.undo() : workspace.redo());
  }
  const cutY = draft ?? session?.pending.cutY ?? (session ? String(session.cutY) : '');
  return <div ref={root} className={['cad-solid-split', className].filter(Boolean).join(' ')} onKeyDown={historyKey}
    onCompositionStartCapture={() => { composing.current = true; }} onCompositionEndCapture={() => { composing.current = false; }}
    aria-busy={snapshot.busy} data-testid="solid-split-workspace">
    <header className="cad-solid-split-header"><div><h1>Solid Split</h1><p>Constant-Y plane · Legacy WebGL2 · One shared depth canvas</p></div>
      <span className="cad-solid-split-filename" title={snapshot.filename}>{snapshot.filename}</span></header>
    <div className="cad-solid-split-toolbar" aria-label="Solid Split commands">
      <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={event => {
        const file = event.target.files?.[0]; event.target.value = '';
        if (!file || blocked || hasDraft) return;
        if (workspace.getSnapshot().session?.dirty) setReplacement(file); else openFile(file, false);
      }}/>
      <button type="button" disabled={blocked || hasDraft} onClick={() => fileInput.current?.click()}>Open…</button>
      <button type="button" disabled={blocked || session?.presentation.kind !== 'split'} onClick={() => run(() => workspace.download())}>Download accepted Split</button>
      <button type="button" disabled={blocked || hasDraft || !session?.history.canUndo} onClick={() => run(() => workspace.undo())}>Undo</button>
      <button type="button" disabled={blocked || hasDraft || !session?.history.canRedo} onClick={() => run(() => workspace.redo())}>Redo</button>
      <button type="button" disabled={blocked} onClick={() => run(() => workspace.fit())}>{session?.presentation.kind === 'original' ? 'Fit original' : 'Fit pair'}</button>
      <button type="button" disabled={blocked || !selected} onClick={() => run(() => workspace.fit(selected!.componentId))}>Fit selected Body</button>
    </div>
    {(localError || snapshot.error) && <p className="cad-solid-split-error" role="alert">{localError || describeError(snapshot.error)}</p>}
    <div className="cad-solid-split-main">
      <aside className="cad-solid-split-tree" aria-label="Native Bodies and Faces"><h2>Objects</h2>
        {snapshot.display?.bodies.map(body => <section key={body.componentId}>
          <button type="button" disabled={blocked} aria-pressed={selected?.componentId === body.componentId && !selected.faceId}
            onClick={() => run(() => workspace.select(body.componentId))}>{body.componentId} · Body {body.bodyId}</button>
          <ul>{body.faces.map(face => <li key={face.faceId}><button type="button" disabled={blocked}
            aria-pressed={selected?.componentId === body.componentId && selected.faceId === face.faceId}
            onClick={() => run(() => workspace.select(body.componentId, face.faceId))}>{face.role} · Face {face.faceId}</button></li>)}</ul>
        </section>)}
      </aside>
      <div className="cad-solid-split-viewport">
        <canvas key={canvasKey} ref={canvas} aria-label="Solid Split legacy WebGL2 canvas; approximate triangle selection" tabIndex={0}
          onClick={event => {
            if (blocked) return;
            const element = event.currentTarget, rect = element.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return;
            const x = Math.floor((event.clientX - rect.left) * element.width / rect.width);
            const topY = Math.floor((event.clientY - rect.top) * element.height / rect.height);
            if (x < 0 || topY < 0 || x >= element.width || topY >= element.height) return;
            run(() => workspace.pick(x, element.height - 1 - topY));
          }}/>
        {(snapshot.busy || !snapshot.available) && <div className="cad-solid-split-overlay" role="status">
          {snapshot.busy ? <><strong>{snapshot.cancelling ? 'Cancelling native preparation…' : 'Preparing native Solid Split…'}</strong><p>Native work runs in a dedicated worker. Cancellation waits for the current native phase to finish.</p>{snapshot.canCancel && <button type="button" onClick={() => workspace.cancelOperation()}>Cancel preparation</button>}</>
            : <><strong>Presentation unavailable</strong><p>{snapshot.authorityAvailable ? 'The accepted native Body and pending field are retained.' : 'Worker authority could not be confirmed. Reload the workspace to begin a new session.'}</p><button disabled={!snapshot.authorityAvailable} type="button" onClick={() => {
              contextLost.current = false; setLocalError(null); setCanvasKey(value => value + 1);
            }}>Remount canvas</button></>}
        </div>}
      </div>
      <aside className="cad-solid-split-inspector" aria-label="Split and lineage"><h2>Plane cut</h2>
        <label htmlFor={cutId}>Cut Y (mm)</label><input id={cutId} type="text" inputMode="decimal" maxLength={128}
          value={cutY} disabled={blocked} onChange={event => setDraft(event.target.value)}/>
        <div className="cad-solid-split-actions"><button type="button" disabled={blocked || composing.current} onClick={() => run(async () => {
            if (draft !== null) {
              await workspace.stageCutYField(draft);
              if (workspace.getSnapshot().error) return;
            }
            await workspace.apply();
            const after = workspace.getSnapshot();
            if (!after.error && !after.busy && after.session && !Object.hasOwn(after.session.pending, 'cutY')) setDraft(null);
          })}>Split</button>
          <button type="button" disabled={blocked || !hasDraft} onClick={() => run(async () => { await workspace.discardPending(); if (!workspace.getSnapshot().error) setDraft(null); })}>Discard field</button></div>
        <p>Type a finite constant Y value, then choose Split. The full original Body and cut Surface remain native authority.</p>
        <h2>Selection lineage</h2><p>Canvas selection is approximate triangle picking, not exact BRep or pixel picking.</p>
        {selected ? <dl><dt>Component</dt><dd>{selected.componentId}</dd><dt>Native Body</dt><dd>{selected.bodyId}</dd>
          {selectedFace && <><dt>Native Face</dt><dd>{selectedFace.faceId}</dd><dt>Role</dt><dd>{selectedFace.role}</dd>
            <dt>Effective orientation</dt><dd>{selectedFace.orientation}</dd><dt>Source support</dt><dd>{JSON.stringify(selectedFace.supportRef)}</dd></>}
        </dl> : <p>Select a Body or Face in the tree or canvas.</p>}
        {session?.presentation.kind === 'original' && <p>Original-only download is unsupported. Split first to save a native authored Split file.</p>}
        {hasDraft && <p>Pending fields are not included in downloads. Split or discard before Open or history.</p>}
      </aside>
    </div>
    {replacement && <dialog ref={replacementDialog} className="cad-solid-split-confirm" aria-labelledby={`${cutId}-replace`} onCancel={() => setReplacement(null)}>
      <h2 id={`${cutId}-replace`}>Replace unsaved Split?</h2><p>Opening {replacement.name} replaces {snapshot.filename} and its history. Download your accepted Split first if you need a copy.</p>
      <button type="button" autoFocus onClick={() => setReplacement(null)}>Cancel</button>
      <button type="button" onClick={() => openFile(replacement, true)}>Replace and open</button>
    </dialog>}
    <footer className="cad-solid-split-status" aria-live="polite"><span>{snapshot.cancelling ? 'Cancelling; waiting for worker' : snapshot.busy ? 'Native operation in progress' : snapshot.available ? `${session?.presentation.kind === 'original' ? 'Original Body' : 'Split pair'} displayed` : 'Pixels unavailable'}</span>
      <span>{hasDraft ? 'Cut draft pending' : 'No pending field'}</span><span>{session?.dirty ? 'Unsaved changes' : 'No new changes'}</span>
      <span>{session?.downloadStatus ?? 'Not downloaded'}</span>{session && <span>History {session.history.index + 1} / {session.history.count}</span>}
    </footer>
  </div>;
}

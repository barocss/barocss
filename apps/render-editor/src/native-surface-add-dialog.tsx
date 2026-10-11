import {useEffect, useRef, useState, useSyncExternalStore} from 'react';
import {prepareRenderNativeSourceImport, RenderEditorError, normalizeRenderEditorError} from '@barocss/render-editor';
import type {RenderNativeSourceImport} from '@barocss/render-editor';
import type {NativeSceneHost} from './native-scene-host';
import {Button} from './components/ui/button';
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from './components/ui/dialog';

export interface NativeSurfaceAddDialogProps {
  host: NativeSceneHost;
  onAdd: (source: string, surfaceId: string) => void;
  onClose: () => void;
  onError: (cause: unknown) => void;
  onCloseFocus?: () => void;
}
interface Candidate {fileName: string; inspection: RenderNativeSourceImport; surfaceId: string}
const sourceLimit = 65536;
const asyncFunction = Object.getPrototypeOf(async function () {}), asyncGenerator = Object.getPrototypeOf(async function* () {});

/** Original source inspection stays local to this dialog until one explicit whole-scene Add. */
export function NativeSurfaceAddDialog({host, onAdd, onClose, onError, onCloseFocus}: NativeSurfaceAddDialogProps) {
  const snapshot = useSyncExternalStore(host.subscribe, host.getSnapshot, host.getSnapshot);
  const baseline = useRef({host, snapshot: host.getSnapshot()});
  const currentHost = useRef(host); currentHost.current = host;
  const fileInput = useRef<HTMLInputElement>(null), mounted = useRef(true), readGeneration = useRef(0), readingRef = useRef(false);
  const [candidate, setCandidate] = useState<Candidate | null>(null), [reading, setReading] = useState(false), [error, setError] = useState<RenderEditorError | null>(null);
  const fresh = () => mounted.current && currentHost.current === baseline.current.host && host.getSnapshot() === baseline.current.snapshot && !host.getSnapshot().disposed;
  useEffect(() => {mounted.current = true; return () => {mounted.current = false; readGeneration.current++;};}, []);
  const report = (cause: unknown) => {setError(normalizeRenderEditorError(cause)); onError(cause);};
  const stale = host !== baseline.current.host || snapshot !== baseline.current.snapshot || snapshot.disposed;
  const cancel = () => {readGeneration.current++; readingRef.current = false; onClose();};
  const readFile = async (file: File | undefined) => {
    if (!file) return;
    if (!fresh()) {report(new RenderEditorError('STALE_CANDIDATE', 'The scene changed. Close and reopen Add Surface.')); return;}
    const generation = ++readGeneration.current;
    readingRef.current = true; setReading(true);
    try {
      if (file.size > sourceLimit) throw new RenderEditorError('DOCUMENT_BYTES', 'CAD source exceeds 65536 UTF-8 bytes.');
      const source = new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(await file.arrayBuffer());
      if (!mounted.current || generation !== readGeneration.current) return;
      if (!fresh()) throw new RenderEditorError('STALE_CANDIDATE', 'The scene changed while the source was opening. Close and reopen Add Surface.');
      const inspection = prepareRenderNativeSourceImport(source);
      if (!fresh() || generation !== readGeneration.current) throw new RenderEditorError('STALE_CANDIDATE', 'The scene changed during source inspection.');
      setCandidate({fileName: file.name, inspection, surfaceId: inspection.surfaces[0]!.id}); setError(null);
    } catch (cause) {if (mounted.current && generation === readGeneration.current) report(cause);}
    finally {if (mounted.current && generation === readGeneration.current) {readingRef.current = false; setReading(false);}}
  };
  const add = () => {
    if (readingRef.current || !candidate) return;
    try {
      if (!fresh()) throw new RenderEditorError('STALE_CANDIDATE', 'The scene changed. Close and reopen Add Surface.');
      if (!candidate.inspection.surfaces.some(surface => surface.id === candidate.surfaceId)) throw new RenderEditorError('DOCUMENT_INPUT', 'Choose a Surface from the inspected source.');
      const prototype = Object.getPrototypeOf(onAdd), source = Function.prototype.toString.call(onAdd);
      if (prototype === asyncFunction || prototype === asyncGenerator || /^async(?:\s|\(|\/)/.test(source)) throw new RenderEditorError('DOCUMENT_INPUT', 'Add Surface must complete synchronously.');
      const result: unknown = onAdd(candidate.inspection.source, candidate.surfaceId);
      if (result !== null && (typeof result === 'object' || typeof result === 'function') && typeof Reflect.get(result, 'then') === 'function') throw new RenderEditorError('DOCUMENT_INPUT', 'Add Surface must not return a thenable.');
      readGeneration.current++; onClose();
    } catch (cause) {report(cause);}
  };
  return <Dialog open onOpenChange={value => {if (!value) cancel();}}><DialogContent showCloseButton={false} data-testid="native-add-dialog" onCloseAutoFocus={event => {event.preventDefault(); onCloseFocus?.();}}>
    <DialogHeader><DialogTitle>Add Surface</DialogTitle><DialogDescription>Choose original CAD source, then select its Surface.</DialogDescription></DialogHeader>
    <Button variant="secondary" disabled={reading || stale} data-testid="native-add-choose-file" onClick={() => fileInput.current?.click()}>Choose CAD source</Button>
    <input ref={fileInput} type="file" accept=".barocad,.barocss,.txt,text/plain" hidden data-testid="native-add-source-file" onChange={event => {const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void readFile(file);}}/>
    {reading && <p role="status">Reading CAD source…</p>}
    {candidate && <>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs"><dt>File</dt><dd className="min-w-0 break-all">{candidate.fileName}</dd><dt>Model</dt><dd className="min-w-0 break-all">{candidate.inspection.modelId}</dd><dt>Objects</dt><dd>{candidate.inspection.objects.length}</dd></dl>
      <ul className="max-h-28 overflow-auto text-xs" aria-label="Source objects">{candidate.inspection.objects.map(object => <li key={object.id} className="flex justify-between gap-3"><span className="min-w-0 break-all">{object.id}</span><span>{object.kind === 'surface' ? 'Surface' : 'Curve'}</span></li>)}</ul>
      <label className="grid gap-1 text-xs" htmlFor="native-add-surface-choice">Surface<select id="native-add-surface-choice" data-testid="native-add-surface-choice" disabled={reading || stale} value={candidate.surfaceId} onChange={event => {setCandidate({...candidate, surfaceId: event.target.value}); setError(null);}}>{candidate.inspection.surfaces.map(surface => <option key={surface.id} value={surface.id}>{surface.id}</option>)}</select></label>
    </>}
    {(error || stale) && <p role="alert" data-testid="native-add-error" className="text-xs break-words">{error ? error.code + ': ' + error.message : 'The scene changed. Close and reopen Add Surface.'}</p>}
    <DialogFooter><Button variant="ghost" data-testid="native-add-cancel" onClick={cancel}>Cancel</Button><Button data-testid="native-add-confirm" disabled={reading || stale || !candidate} onClick={add}>Add Surface</Button></DialogFooter>
  </DialogContent></Dialog>;
}

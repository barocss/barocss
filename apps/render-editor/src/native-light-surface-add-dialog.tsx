import {useEffect, useRef, useState} from 'react';
import {prepareRenderNativeSourceImport, RENDER_MIXED_DOCUMENT_LIMITS, RenderEditorError, normalizeRenderEditorError} from '@barocss/render-editor';
import type {RenderNativeSourceImport} from '@barocss/render-editor';
import {Button} from './components/ui/button';
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from './components/ui/dialog';

interface Props {
  isCurrent: () => boolean;
  onAdd: (source: string, surfaceId: string) => Promise<boolean>;
  onClose: () => void;
  onCloseFocus: () => void;
}
interface Candidate {fileName: string; inspection: RenderNativeSourceImport; surfaceId: string}

/** Private Light lifetime: inspection is local; only explicit Add enters the owned async transaction. */
export function NativeLightSurfaceAddDialog({isCurrent, onAdd, onClose, onCloseFocus}: Props) {
  const input = useRef<HTMLInputElement>(null), mounted = useRef(true), generation = useRef(0);
  const readingRef = useRef(false), addingRef = useRef(false);
  const callbacks = useRef({isCurrent, onAdd, onClose}); callbacks.current = {isCurrent, onAdd, onClose};
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [reading, setReading] = useState(false), [adding, setAdding] = useState(false), [error, setError] = useState<string | null>(null);
  useEffect(() => {mounted.current = true; return () => {mounted.current = false; generation.current++;};}, []);
  const current = () => mounted.current && callbacks.current.isCurrent();
  const report = (cause: unknown) => {const value = normalizeRenderEditorError(cause); setError(value.code + ': ' + value.message);};
  const close = () => {
    // An explicit Add may already have reached the renderer. Close never pretends to undo its ACK.
    if (addingRef.current) return;
    generation.current++; readingRef.current = false; callbacks.current.onClose();
  };
  useEffect(() => {
    const element = input.current;
    const cancel = () => {if (!readingRef.current && !addingRef.current && mounted.current) setError(null);};
    element?.addEventListener('cancel', cancel);
    return () => element?.removeEventListener('cancel', cancel);
  }, []);
  const read = async (file: File | undefined) => {
    if (!file || readingRef.current || addingRef.current) return;
    if (!current()) {report(new RenderEditorError('STALE_CANDIDATE', 'The scene changed. Close and reopen Add Surface.')); return;}
    const started = ++generation.current;
    readingRef.current = true; setReading(true); setError(null);
    try {
      if (file.size > RENDER_MIXED_DOCUMENT_LIMITS.sourceBytes)
        throw new RenderEditorError('DOCUMENT_BYTES', 'CAD source exceeds 65536 UTF-8 bytes.');
      const bytes = await file.arrayBuffer();
      if (!mounted.current || generation.current !== started) return;
      if (!current()) throw new RenderEditorError('STALE_CANDIDATE', 'The scene changed while reading the source. Close and reopen Add Surface.');
      if (bytes.byteLength > RENDER_MIXED_DOCUMENT_LIMITS.sourceBytes)
        throw new RenderEditorError('DOCUMENT_BYTES', 'CAD source exceeds 65536 UTF-8 bytes.');
      const source = new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(bytes);
      const inspection = prepareRenderNativeSourceImport(source);
      if (!current() || generation.current !== started) throw new RenderEditorError('STALE_CANDIDATE', 'The source inspection no longer belongs to this scene.');
      setCandidate({fileName: file.name, inspection, surfaceId: inspection.surfaces[0]!.id});
    } catch (cause) {if (mounted.current && generation.current === started) report(cause);}
    finally {if (mounted.current && generation.current === started) {readingRef.current = false; setReading(false);}}
  };
  const add = async () => {
    if (readingRef.current || addingRef.current || !candidate) return;
    if (!current()) {report(new RenderEditorError('STALE_CANDIDATE', 'The scene changed. Close and reopen Add Surface.')); return;}
    addingRef.current = true; setAdding(true); setError(null);
    const started = generation.current;
    try {
      if (!candidate.inspection.surfaces.some(value => value.id === candidate.surfaceId))
        throw new RenderEditorError('DOCUMENT_INPUT', 'Choose a Surface from the inspected source.');
      const accepted = await callbacks.current.onAdd(candidate.inspection.source, candidate.surfaceId);
      if (mounted.current && generation.current === started && accepted) callbacks.current.onClose();
    } catch (cause) {if (mounted.current && generation.current === started) report(cause);}
    finally {if (mounted.current && generation.current === started) {addingRef.current = false; setAdding(false);}}
  };
  const stale = !adding && !isCurrent();
  return <Dialog open onOpenChange={open => {if (!open) close();}}>
    <DialogContent showCloseButton={false} data-testid="light-add-dialog" onCloseAutoFocus={event => {event.preventDefault(); onCloseFocus();}}
      onEscapeKeyDown={event => {if (addingRef.current) event.preventDefault();}}
      onInteractOutside={event => {if (addingRef.current) event.preventDefault();}}>
      <DialogHeader><DialogTitle>Add Surface</DialogTitle><DialogDescription>Choose original CAD source, then select its Surface. Native XYZ uses millimetres and the current scene scale. The new body copies the selected accepted material at its source origin.</DialogDescription></DialogHeader>
      <Button variant="secondary" disabled={reading || adding || stale} data-testid="light-add-choose-file" onClick={() => {if (current() && !readingRef.current && !addingRef.current) input.current?.click();}}>Choose CAD source</Button>
      <input ref={input} type="file" accept=".barocad,.barocss,.txt,text/plain" hidden aria-label="Add Surface source file" onChange={event => {const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void read(file);}}/>
      <small>Limit: 65536 UTF-8 bytes and UTF-16 code units. Original source is retained; extensions are hints only.</small>
      {reading && <p role="status">Reading CAD source…</p>}
      {candidate && <>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs"><dt>File</dt><dd className="break-all">{candidate.fileName}</dd><dt>Model</dt><dd className="break-all">{candidate.inspection.modelId}</dd><dt>Objects</dt><dd>{candidate.inspection.objects.length}</dd></dl>
        <ul className="max-h-28 overflow-auto text-xs" aria-label="Source objects">{candidate.inspection.objects.map(object => <li key={object.id}>{object.id} · {object.kind === 'surface' ? 'Surface' : 'Curve'}</li>)}</ul>
        <label>Surface<select aria-label="Surface to add" disabled={reading || adding || stale} value={candidate.surfaceId}
          onChange={event => {if (!readingRef.current && !addingRef.current && current()) {setCandidate({...candidate, surfaceId: event.target.value}); setError(null);}}}>
          {candidate.inspection.surfaces.map(surface => <option key={surface.id} value={surface.id}>{surface.id}</option>)}
        </select></label>
      </>}
      {(error || stale) && <p role="alert" data-testid="light-add-error">{error ?? 'The scene changed. Close this dialog and recover or reopen it.'}</p>}
      <DialogFooter><Button variant="ghost" disabled={adding} onClick={close}>Cancel</Button><Button disabled={reading || adding || stale || !candidate} onClick={() => void add()}>{adding ? 'Adding Surface…' : 'Add Surface'}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

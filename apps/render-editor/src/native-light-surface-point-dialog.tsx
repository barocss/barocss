import {useEffect, useRef, useState} from 'react';
import {normalizeRenderEditorError, RenderEditorError} from '@barocss/render-editor';
import type {RenderNativeSceneSurfacePolePatch} from '@barocss/render-editor';
import type {LightSurfacePointData} from './native-light-bodies';
import {Button} from './components/ui/button';
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from './components/ui/dialog';

interface Props {
  data: LightSurfacePointData;
  isCurrent: () => boolean;
  onApply: (patch: RenderNativeSceneSurfacePolePatch) => Promise<boolean>;
  onClose: () => void;
  onCloseFocus: () => void;
}
const text = (value: number) => Object.is(value, -0) ? '-0' : String(value);
const decimal = /^[\t\n\v\f\r ]*[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?[\t\n\v\f\r ]*$/;

/** One captured original coefficient; no preview or source staging until explicit Apply point. */
export function NativeLightSurfacePointDialog({data, isCurrent, onApply, onClose, onCloseFocus}: Props) {
  const [indices, setIndices] = useState({u: 0, v: 0});
  const accepted = data.rows[indices.u]![indices.v]!;
  const initial = [...accepted.pointMM, accepted.weight].map(text);
  const [raw, setRaw] = useState(initial), rawRef = useRef(raw); rawRef.current = raw;
  const indicesRef = useRef(indices); indicesRef.current = indices;
  const [pending, setPending] = useState(false), pendingRef = useRef(false), mounted = useRef(true);
  const [error, setError] = useState<string | null>(null), [notice, setNotice] = useState('');
  const callbacks = useRef({isCurrent, onApply, onClose}); callbacks.current = {isCurrent, onApply, onClose};
  useEffect(() => {mounted.current = true; return () => {mounted.current = false;};}, []);
  const dirty = raw.some((value, index) => value !== initial[index]);
  const current = () => mounted.current && callbacks.current.isCurrent();
  const close = () => {if (!pendingRef.current) callbacks.current.onClose();};
  const choose = (u: number, v: number) => {
    if (!current() || pendingRef.current || rawRef.current.some((value, index) => value !== initial[index])) return;
    const point = data.rows[u]?.[v]; if (!point) return;
    const next = {u, v}; indicesRef.current = next; setIndices(next);
    const values = [...point.pointMM, point.weight].map(text); rawRef.current = values; setRaw(values); setError(null); setNotice('');
  };
  const apply = async () => {
    if (!current() || pendingRef.current || data.shared) return;
    const captured = indicesRef.current, values = rawRef.current;
    try {
      const numbers = values.map(value => decimal.test(value) ? Number(value) : NaN);
      if (!numbers.every(Number.isFinite)) throw new RenderEditorError('DOCUMENT_INPUT', 'Enter four complete finite decimal values.');
      pendingRef.current = true; setPending(true); setError(null); setNotice('');
      const changed = await callbacks.current.onApply({uIndex: captured.u, vIndex: captured.v,
        xMM: numbers[0]!, yMM: numbers[1]!, zMM: numbers[2]!, weight: numbers[3]!});
      if (mounted.current) {if (changed) callbacks.current.onClose(); else setNotice('No source change. Fields are retained.');}
    } catch (cause) {
      if (mounted.current) {const value = normalizeRenderEditorError(cause); setError(value.code + ': ' + value.message);}
    } finally {if (mounted.current) {pendingRef.current = false; setPending(false);}}
  };
  const stale = !pending && !isCurrent(), locked = pending || stale || data.shared;
  return <Dialog open onOpenChange={open => {if (!open) close();}}>
    <DialogContent showCloseButton={false} data-testid="light-point-dialog" onCloseAutoFocus={event => {event.preventDefault(); onCloseFocus();}}
      onEscapeKeyDown={event => {if (pendingRef.current) event.preventDefault();}}
      onInteractOutside={event => {if (pendingRef.current) event.preventDefault();}}>
      <DialogHeader><DialogTitle>Edit control point</DialogTitle><DialogDescription>Original U row and V column, not UV parameters. XYZ is in source millimetres; body transforms stay unchanged.</DialogDescription></DialogHeader>
      {data.shared && <p role="alert">This source asset is shared. Close this dialog and Duplicate body, then edit the selected copy. Duplication still requires available asset, body and display capacity.</p>}
      <label>U row<select aria-label="Control point U row" value={indices.u} disabled={locked || dirty}
        onChange={event => choose(Number(event.target.value), indicesRef.current.v)}>{data.rows.map((_, u) => <option key={u} value={u}>{u}</option>)}</select></label>
      <label>V column<select aria-label="Control point V column" value={indices.v} disabled={locked || dirty}
        onChange={event => choose(indicesRef.current.u, Number(event.target.value))}>{data.rows[indices.u]!.map((_, v) => <option key={v} value={v}>{v}</option>)}</select></label>
      {['X in source mm', 'Y in source mm', 'Z in source mm', 'weight'].map((label, index) => <label key={label}>Control point {label}<input type="text" inputMode="decimal" maxLength={256}
        aria-label={'Control point ' + label} value={raw[index]} disabled={locked} onChange={event => {
          if (!current() || pendingRef.current || data.shared || event.target.value.length > 256) return;
          const next = [...rawRef.current]; next[index] = event.target.value; rawRef.current = next; setRaw(next); setError(null); setNotice('');
        }}/></label>)}
      <small>XYZ: −1000000 to 1000000 mm. Weight: 0.000001 to 1000000. Actual source and display admission still apply. Reset fields before choosing another point.</small>
      {(error || stale) && <p role="alert">{error ?? 'The scene changed. Close this dialog and recover or reopen it.'}</p>}
      {notice && <p role="status">{notice}</p>}
      <DialogFooter><Button variant="ghost" disabled={pending} onClick={close}>Cancel</Button>
        <Button variant="secondary" disabled={locked || !dirty} onClick={() => {if (!current() || pendingRef.current) return; rawRef.current = initial; setRaw(initial); setError(null); setNotice('');}}>Reset fields</Button>
        <Button disabled={locked} onClick={() => void apply()}>{pending ? 'Applying point…' : 'Apply point'}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

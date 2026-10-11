import {useLayoutEffect, useRef, useState, useSyncExternalStore} from 'react';
import {createPortal} from 'react-dom';
import {normalizeRenderEditorError, type RenderEditorError} from '@barocss/render-editor';
import type {NativeSceneHost} from './native-scene-host';
import {Button} from './components/ui/button';

interface Props {host: NativeSceneHost; disabled: boolean; onError: (cause: unknown) => void}

/** The host owns preview authority; this portal only retains its explicit one-use token. */
export function NativeMaterialPreviewControls({host, disabled, onError}: Props) {
  const snapshot = useSyncExternalStore(host.subscribe, host.getSnapshot, host.getSnapshot);
  const material = useSyncExternalStore(host.materialSession.subscribe, host.materialSession.getSnapshot, host.materialSession.getSnapshot);
  const [portal, setPortal] = useState<Element | null>(null);
  const token = useRef<{host: NativeSceneHost; value: object} | null>(null);
  const [ownedToken, setOwnedToken] = useState(token.current);
  const [error, setError] = useState<RenderEditorError | null>(null), [message, setMessage] = useState('');
  useLayoutEffect(() => {
    const uniforms = document.querySelector('.re-material-host .re-material-inspector section[aria-label="Material uniforms"]');
    if (!uniforms) return;
    const slot = document.createElement('div'); slot.className = 'native-material-preview-slot';
    uniforms.append(slot); setPortal(slot);
    return () => {slot.remove();};
  }, []);
  useLayoutEffect(() => {setError(null); setMessage('');}, [host, snapshot.selectedBodyId, material.accepted, material.draftSource, material.draftUniforms]);
  const pending = snapshot.materialPreview;
  const target = snapshot.targets.find(target => target.bodyId === (pending?.bodyId ?? snapshot.selectedBodyId));
  const locked = disabled || snapshot.disposed || !snapshot.available || snapshot.poseGestureActive || !!snapshot.posePreview
    || snapshot.surfacePoleGestureActive || !!snapshot.surfacePolePreview;
  // A pending restore can be retried. Do not inherit the ordinary material-preview lock here.
  const recoveryLocked = disabled || snapshot.disposed || !pending || ownedToken?.host !== host;
  const report = (cause: unknown) => {setError(normalizeRenderEditorError(cause)); onError(cause);};
  const begin = () => {
    if (locked || host.getSnapshot().materialPreview || !host.getSnapshot().materialDirty) return;
    try {
      const value = host.beginMaterialPreview();
      token.current = {host, value}; setOwnedToken(token.current); setError(null); setMessage('');
    } catch (cause) {report(cause);}
  };
  const finish = (apply: boolean) => {
    const captured = token.current;
    if (disabled || host.getSnapshot().disposed || !host.getSnapshot().materialPreview || captured?.host !== host) return;
    try {
      if (apply) host.applyMaterialPreview(captured.value); else host.cancelMaterialPreview(captured.value);
      token.current = null; setOwnedToken(null); setError(null);
      setMessage(apply ? 'Material applied in one scene change.' : 'Preview canceled. Draft text kept.');
    } catch (cause) {
      // Atomic restore refusal retains this exact token. A closed/quarantined token cannot be reused.
      if (!host.getSnapshot().materialPreview) {token.current = null; setOwnedToken(null);}
      setMessage(host.getSnapshot().materialPreview ? 'Preview retained. Retry Cancel preview.' : 'Draft text kept.');
      report(cause);
    }
  };
  if (!portal) return null;
  return createPortal(<section className="re-native-material-preview-controls" aria-label="Material draft preview"
    data-testid="native-material-preview-controls" data-body-id={pending?.bodyId ?? snapshot.selectedBodyId} data-active={String(!!pending)}>
    <p className="re-material-caption" data-testid="native-material-preview-target">Target: {target?.title ?? snapshot.selectedBodyId}</p>
    <div className="re-native-material-preview-actions">
      <Button size="sm" variant="secondary" data-testid="native-material-preview" disabled={locked || !!pending || !snapshot.materialDirty} onClick={begin}>Preview draft</Button>
      {pending && <><Button size="sm" variant="ghost" data-testid="native-material-preview-cancel" disabled={recoveryLocked} onClick={() => finish(false)}>Cancel preview</Button>
        <Button size="sm" data-testid="native-material-preview-apply" disabled={recoveryLocked} onClick={() => finish(true)}>Apply preview</Button></>}
    </div>
    <p className="re-material-caption" role="status" data-testid="native-material-preview-status">{!snapshot.available ? 'Preview unavailable. Draft text kept.'
      : pending ? message || 'Selected material preview. Applied scene unchanged.'
        : message || (snapshot.materialDirty ? 'Material draft. Preview before applying.' : 'Edit Source or a uniform to preview a draft.')}</p>
    {error && <div className="re-native-material-preview-error" role="alert"><p>Material preview action was refused.</p><details><summary>Details</summary><p>{error.code}: {error.message}</p></details></div>}
  </section>, portal);
}

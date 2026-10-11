import {useLayoutEffect, useState, useSyncExternalStore} from 'react';
import {createPortal} from 'react-dom';
import {Eye, EyeOff, Grid2X2, Spline} from 'lucide-react';
import type {NativeSceneHost} from './native-scene-host';

interface Props {host: NativeSceneHost; disabled: boolean; onTarget: (bodyId: string) => void}

/** A flat list of the accepted native inventory. Row selection is local editing context. */
export function NativeSceneOutliner({host, disabled, onTarget}: Props) {
  const snapshot = useSyncExternalStore(host.subscribe, host.getSnapshot, host.getSnapshot);
  const [portal, setPortal] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const inspector = document.querySelector('.re-material-host .re-material-inspector');
    if (!inspector) return;
    const slot = document.createElement('div'); slot.className = 're-native-outliner-slot native-outliner-slot';
    const controls = Array.from(inspector.children).find(child => child.classList.contains('native-controls-slot'));
    inspector.insertBefore(slot, controls ?? inspector.firstChild); setPortal(slot);
    return () => {slot.remove();};
  }, []);
  const locked = disabled || snapshot.nativeDirty || snapshot.materialDirty || snapshot.invalidLighting || snapshot.invalidBodyPose || snapshot.poseGestureActive || !!snapshot.posePreview || !snapshot.available || snapshot.disposed;
  if (!portal) return null;
  return createPortal(<section className="re-native-outliner" aria-label="Scene bodies" data-testid="native-body-outliner" data-active-body-id={snapshot.selectedBodyId}>
    <div className="re-material-heading"><h2>Outliner</h2><span>{snapshot.preparation.entries.length} {snapshot.preparation.entries.length === 1 ? 'body' : 'bodies'}</span></div>
    <div className="re-native-outliner-list">
      {snapshot.preparation.entries.map(entry => {
        const bodyId = entry.binding.bodyId;
        const title = snapshot.accepted.nativeDocument.bodies.find(body => body.id === bodyId)?.name ?? bodyId;
        const visible = snapshot.accepted.display.visibleBodyIds.includes(bodyId);
        const material = entry.kind === 'surface' && snapshot.targets.some(target => target.bodyId === bodyId && target.modelId === entry.ref.modelId && target.surfaceId === entry.ref.geometryId);
        const interactive = visible && material;
        const active = snapshot.selectedBodyId === bodyId;
        const content = <><span className="re-native-body-icon" aria-hidden="true">{entry.kind === 'surface' ? <Grid2X2 size={14}/> : <Spline size={14}/>}</span><span className="re-native-body-name" title={title}>{title}</span><span className="re-native-body-kind">{entry.kind === 'surface' ? 'Surface' : 'Curve'}</span><span className="re-native-body-visibility" title={visible ? 'Visible' : 'Hidden'}>{visible ? <Eye size={12} aria-label="Visible"/> : <EyeOff size={12} aria-label="Hidden"/>}</span></>;
        return interactive
          ? <button key={bodyId} type="button" className="re-native-outliner-row" data-testid={'native-body-' + bodyId} data-body-id={bodyId} data-active={active ? 'true' : undefined} aria-pressed={active} aria-label={'Edit ' + title} disabled={locked} onClick={() => {if (!locked) onTarget(bodyId);}}>{content}</button>
          : <div key={bodyId} className="re-native-outliner-row re-native-outliner-readonly" data-testid={'native-body-' + bodyId} data-body-id={bodyId} data-active={active ? 'true' : undefined} aria-label={title + (visible ? ' · read-only' : ' · hidden, read-only')}>{content}<span className="re-native-body-readonly">Read-only</span></div>;
      })}
    </div>
  </section>, portal);
}

import type { MeshCamera } from '@barocss/gpu';

export type NativeViewSide = 'front' | 'right' | 'top' | 'isometric' | 'back' | 'left' | 'bottom';
export const VIEW_SIDES: { side: NativeViewSide; label: string; direction: [number, number, number]; up: [number, number, number] }[] = [
  { side: 'front', label: 'Front', direction: [0, 0, 1], up: [0, 1, 0] },
  { side: 'right', label: 'Right', direction: [1, 0, 0], up: [0, 1, 0] },
  { side: 'top', label: 'Top', direction: [0, 1, 0], up: [0, 0, -1] },
  { side: 'isometric', label: 'Iso', direction: [1, 1, 1], up: [0, 1, 0] },
  { side: 'back', label: 'Back', direction: [0, 0, -1], up: [0, 1, 0] },
  { side: 'left', label: 'Left', direction: [-1, 0, 0], up: [0, 1, 0] },
  { side: 'bottom', label: 'Bottom', direction: [0, -1, 0], up: [0, 0, 1] },
];

/** Observe the actual camera instead of setting orientation optimistically on button activation. */
export function cameraOrientation(camera: MeshCamera | null | undefined): NativeViewSide | null {
  if (!camera) return null;
  const delta = camera.eye.map((value, index) => value - camera.target[index]);
  const distance = Math.hypot(...delta);
  if (!Number.isFinite(distance) || distance <= 0) return null;
  const direction = delta.map(value => value / distance), epsilon = 1e-6;
  return VIEW_SIDES.find(view => {
    const length = Math.hypot(...view.direction);
    return direction.every((value, index) => Math.abs(value - view.direction[index] / length) < epsilon)
      && camera.up.every((value, index) => Math.abs(value - view.up[index]) < epsilon);
  })?.side ?? null;
}

export function CadEditorViewNavigator({ camera, disabled, onChoose }: {
  camera: MeshCamera | null | undefined; disabled: boolean; onChoose: (side: NativeViewSide) => void;
}) {
  const orientation = cameraOrientation(camera);
  const name = orientation === 'isometric' ? 'Isometric' : VIEW_SIDES.find(view => view.side === orientation)?.label ?? 'Custom';
  return <div className="cad-editor-view-tools" role="group" aria-label="Viewport orientation">
    <span data-testid="viewport-view-status">{camera ? name : 'Unavailable'} · Perspective</span>
    {VIEW_SIDES.map(view => <button key={view.side} type="button" data-view={view.side} data-testid={'view-' + view.side}
      aria-label={(view.side === 'isometric' ? 'Isometric' : view.label) + ' view'}
      title={(view.side === 'isometric' ? 'Isometric' : view.label) + ' perspective view'}
      aria-pressed={orientation === view.side} disabled={disabled}
      onKeyDown={event => {
        if ((event.key === 'Enter' || event.key === ' ') && (event.repeat || event.nativeEvent.isComposing
          || event.keyCode === 229 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)) {
          event.preventDefault(); event.stopPropagation();
        }
      }}
      onClick={event => { if (!event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) onChoose(view.side); }}>
      {view.label}
    </button>)}
  </div>;
}

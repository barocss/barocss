/** Input-local keyboard intent only. No native computation or editor state mutation. */
export interface ModelingDimensionKey {
  key: string;
  repeat: boolean;
  isComposing: boolean;
  keyCode: number;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

export interface ModelingDimensionKeyState {
  accepted: boolean;
  draftCount: number;
  busy: boolean;
  disposed: boolean;
}

export type ModelingDimensionCommand = 'apply' | 'discard';

/** Reject IME, modifiers, repeat and stale/busy contexts before issuing an intent. */
export function modelingDimensionCommand(
  event: ModelingDimensionKey,
  state: ModelingDimensionKeyState,
): ModelingDimensionCommand | null {
  if (!state.accepted || state.busy || state.disposed || state.draftCount < 1
    || event.repeat || event.isComposing || event.keyCode === 229
    || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null;
  if (event.key === 'Enter') return 'apply';
  if (event.key === 'Escape') return 'discard';
  return null;
}

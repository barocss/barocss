import {
  captureCadEditorPreviewEpoch, isCadEditorPreviewEpochCurrent,
} from './feature-preview-epoch.js';
import type { CadEditorPreviewEpoch } from './feature-preview-epoch.js';

/** A pure, non-authoritative gate for async preview preparation.
 * Does not retain Native geometry, display resources or accepted Editor state.
 */
export interface CadEditorPreviewLease {
  readonly sequence: number;
  readonly epoch: Readonly<CadEditorPreviewEpoch>;
}
export interface CadEditorPreviewLifecycle {
  begin(): CadEditorPreviewLease;
  isCurrent(lease: CadEditorPreviewLease): boolean;
  cancel(): void;
  dispose(): void;
}
export function createCadEditorPreviewLifecycle(
  currentEpoch: () => CadEditorPreviewEpoch,
): CadEditorPreviewLifecycle {
  let sequence = 0;
  let active: CadEditorPreviewLease | null = null;
  let disposed = false;
  const requireLive = () => {
    if (disposed) throw new Error('DISPOSED CAD Editor preview lifecycle');
  };
  return {
    begin() {
      requireLive();
      const epoch = captureCadEditorPreviewEpoch(currentEpoch());
      const lease = Object.freeze({ sequence: ++sequence, epoch });
      active = lease;
      return lease;
    },
    isCurrent(lease) {
      if (disposed || active !== lease) return false;
      // Read current state on completion, never trust a snapshot captured at request time.
      try {
        if (isCadEditorPreviewEpochCurrent(lease.epoch, currentEpoch())) return true;
      } catch {
        // A refused or unavailable snapshot must permanently invalidate this lease.
      }
      ++sequence;
      active = null;
      return false;
    },
    cancel() {
      requireLive();
      ++sequence;
      active = null;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      ++sequence;
      active = null;
    },
  };
}

import type { OpenScope } from '../state/openOwnership';

/** One delayed fit for a completed project Open; subsequent document/Open ownership still cancels it. */
export function scheduleProjectOpenFit(scope: OpenScope, isCurrent: (scope: OpenScope) => boolean, fit: () => void,
  schedule: (run: () => void, delay: number) => unknown = setTimeout): void {
  schedule(() => { if (isCurrent(scope)) fit(); }, 300);
}

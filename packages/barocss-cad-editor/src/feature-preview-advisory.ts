import type { CadEditorPreviewLifecycle } from './feature-preview-lifecycle.js';

/** Run advisory work without allowing late success/failure to affect the current UI.
 * The caller controls presentation; this helper never accepts CAD authority.
 */
export async function runCadEditorPreviewAdvisory<T>(
  lifecycle: CadEditorPreviewLifecycle,
  prepare: () => Promise<T>,
): Promise<{ status: 'current'; value: T } | { status: 'stale' } | { status: 'error'; cause: unknown }> {
  const lease = lifecycle.begin();
  try {
    const value = await prepare();
    return lifecycle.isCurrent(lease) ? { status: 'current', value } : { status: 'stale' };
  } catch (cause) {
    return lifecycle.isCurrent(lease) ? { status: 'error', cause } : { status: 'stale' };
  }
}

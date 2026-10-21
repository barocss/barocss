// The direct-geometry module (NURBS curve and surface tools: most of the kernel the main thread uses) loads
// when a document first has direct geometry, or a tool first asks for it — not with the app.
import type * as Direct from './direct';

let loaded: typeof Direct | null = null, loading: Promise<typeof Direct> | null = null;
/** The module, loading it on the first call. */
export function loadDirect(): Promise<typeof Direct> {
  return loading ??= import('./direct').then(m => (loaded = m));
}
/** The module if it has loaded, else null (and it starts loading). */
export function directNow(): typeof Direct | null {
  if (!loaded) void loadDirect();
  return loaded;
}

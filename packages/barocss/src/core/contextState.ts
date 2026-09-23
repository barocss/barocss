import type { Context } from './context';
import type { ModifierRegistration, UtilityRegistration } from './registry';
import { AstCache, ParseResultCache, UtilityCache, setContextCacheReset } from '../utils/cache';

interface ContextState {
  utilities: UtilityRegistration[];
  modifiers: ModifierRegistration[];
  astCache: AstCache;
  parseResultCache: ParseResultCache;
  utilityCache: UtilityCache;
  failures: Set<string>;
  cacheGeneration: number;
}

const states = new WeakMap<Context, ContextState>();
let cacheGeneration = 0;

setContextCacheReset(() => { cacheGeneration += 1; });

export function initializeContextState(
  ctx: Context,
  utilities: UtilityRegistration[],
  modifiers: ModifierRegistration[],
): void {
  states.set(ctx, {
    utilities: [...utilities],
    modifiers: [...modifiers],
    astCache: new AstCache(),
    parseResultCache: new ParseResultCache(),
    utilityCache: new UtilityCache(),
    failures: new Set<string>(),
    cacheGeneration,
  });
}

export function getContextState(ctx: Context): ContextState | undefined {
  const state = states.get(ctx);
  if (state && state.cacheGeneration !== cacheGeneration) {
    clearContextCaches(ctx);
    state.cacheGeneration = cacheGeneration;
  }
  return state;
}

export function clearContextCaches(ctx: Context): void {
  const state = states.get(ctx);
  if (!state) return;
  state.astCache.clear();
  state.parseResultCache.clear();
  state.utilityCache.clear();
  state.failures.clear();
}

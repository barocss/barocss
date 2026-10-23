import { useSyncExternalStore } from 'react';

/**
 * A value outside React state (R1c (3b)): what a frame changes — a joint played, the explode factor — is set here, and
 * only the components that show it subscribe, so a frame no longer renders the whole App. `set` takes a value or an
 * updater, as a state setter does, and tells the subscribers only when the value changes (Object.is).
 */
export interface ValueStore<T> {
  get(): T;
  set(next: T | ((previous: T) => T)): void;
  subscribe(listener: () => void): () => void;
}

export function createValueStore<T>(initial: T): ValueStore<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: next => {
      const v = typeof next === 'function' ? (next as (previous: T) => T)(value) : next;
      if (Object.is(v, value)) return;
      value = v;
      for (const l of listeners) l();
    },
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}

const NOT_SUBSCRIBED = () => () => undefined;
/**
 * The store's value in a render. `subscribed` false: the value as it is when the component renders for another reason,
 * without rendering it when the value changes.
 */
export function useStoreValue<T>(store: ValueStore<T>, subscribed = true): T {
  return useSyncExternalStore(subscribed ? store.subscribe : NOT_SUBSCRIBED, store.get);
}

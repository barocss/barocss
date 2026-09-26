import type { BrowserRuntime } from './browser-runtime';
import { normalizeClassNameList } from './utils';

/** Collect literal className tokens from a json-render Spec's flat elements map. */
export function collectJsonRenderClassNames(spec: unknown): string[] {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return [];
  const elements = (spec as { elements?: unknown }).elements;
  if (!elements || typeof elements !== 'object' || Array.isArray(elements)) return [];

  const classes = new Set<string>();
  for (const key of Object.keys(elements)) {
    const element = (elements as Record<string, unknown>)[key];
    if (!element || typeof element !== 'object' || Array.isArray(element)) continue;
    const props = (element as { props?: unknown }).props;
    if (!props || typeof props !== 'object' || Array.isArray(props)) continue;
    const className = (props as { className?: unknown }).className;
    if (typeof className !== 'string') continue;
    for (const cls of normalizeClassNameList(className)) {
      if (cls) classes.add(cls);
    }
  }
  return Array.from(classes);
}

/** Submit literal classes synchronously before UI mount; the caller validates class support. */
export function preloadJsonRenderClasses(spec: unknown, runtime: Pick<BrowserRuntime, 'addClass'>): void {
  const classes = collectJsonRenderClassNames(spec);
  if (classes.length > 0) runtime.addClass(classes);
}

import type { BrowserRuntime } from './browser-runtime';

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
    for (const cls of className.split(/\s+/)) {
      if (cls) classes.add(cls);
    }
  }
  return Array.from(classes);
}

/** Generate CSS synchronously before committing a validated json-render Spec. */
export function preloadJsonRenderClasses(spec: unknown, runtime: Pick<BrowserRuntime, 'addClass'>): string[] {
  const classes = collectJsonRenderClassNames(spec);
  if (classes.length > 0) runtime.addClass(classes);
  return classes;
}

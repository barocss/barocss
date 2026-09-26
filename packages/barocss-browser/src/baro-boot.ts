import { BrowserRuntime, BrowserRuntimeOptions } from "./browser-runtime";

let runtime: BrowserRuntime | null = null;
let runtimeConfig: BrowserRuntimeOptions['config'];

/**
 * Returns the shared runtime, creating it on first use. If a live runtime
 * already exists and `options.config` is a different config object, it is
 * applied via `updateConfig` (which replaces the whole config), so an early
 * `getRuntime()` never makes a later `baroStart({ config })` lose its config.
 */
export function getRuntime(options: BrowserRuntimeOptions = {}) {
  if (!runtime || runtime.getStats().isDestroyed) {
    runtime = new BrowserRuntime(options);
    runtimeConfig = options.config;
  } else if (options.config && options.config !== runtimeConfig) {
    runtime.updateConfig(options.config);
    runtimeConfig = options.config;
  }
  return runtime;
}

type BaroBootOptions = BrowserRuntimeOptions & { loadingClassName?: string };

/**
 * Starts BaroCSS on the document (the shared runtime). #327: with `root: shadowRoot` it instead returns a new
 * runtime that observes and styles only that shadow root (runtimes with the same config share one sheet).
 */
export function baroBoot(options: BaroBootOptions & { root: ShadowRoot }): BrowserRuntime;
export function baroBoot(options?: BaroBootOptions): void;
export function baroBoot({ loadingClassName = 'baro-boot', ...options }: BaroBootOptions = {}): BrowserRuntime | void {
    if (options.root && options.root.nodeType === 11) return new BrowserRuntime(options);
    if (!document.body) {
        document.addEventListener('DOMContentLoaded', () => baroBoot({ loadingClassName, ...options }), { once: true });
        return;
    }
    const startClassName = `${loadingClassName}-doing`;
    const endClassName = `${loadingClassName}-done`;
    try {    

        document.body.classList.add(startClassName);

        const runtime = getRuntime(options);
        runtime.observe(document.body, { scan: true, onReady: () => {
            document.body.classList.remove(startClassName);
            document.body.classList.add(endClassName);
        }});
    } catch (error) {
        document.body?.classList.remove(startClassName);
        // eslint-disable-next-line no-console
        console.error('BaroCSS boot failed:', error);
    }
}

export const baroStart = baroBoot;

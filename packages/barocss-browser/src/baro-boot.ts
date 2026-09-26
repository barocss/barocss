import { BrowserRuntime, BrowserRuntimeOptions } from "./browser-runtime";

let runtime: BrowserRuntime | null = null;
let runtimeConfig: BrowserRuntimeOptions['config'];
let runtimeNonce = '';
let runtimeConstructable = false;
let mismatchWarned = false;

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
    runtimeNonce = options.nonce ?? '';
    runtimeConstructable = options.constructable ?? false;
    mismatchWarned = false;
  } else if (options.config && options.config !== runtimeConfig) {
    runtime.updateConfig(options.config);
    runtimeConfig = options.config;
  }
  if (!mismatchWarned) {
    const badNonce = options.nonce !== undefined && options.nonce !== runtimeNonce;
    const badConstructable = options.constructable !== undefined && options.constructable !== runtimeConstructable;
    if (badNonce || badConstructable) {
      mismatchWarned = true;
      const what = [badNonce && `nonce (runtime has ${runtimeNonce ? 'a different nonce' : 'none'})`, badConstructable && `constructable (runtime has ${runtimeConstructable})`].filter(Boolean).join(' and ');
      // console-ok: one-time real-misuse warning; the requested option is ignored, so strict-CSP styles may be blocked
      console.warn(`[BaroCSS] runtime already created with a different ${what}; the new value is ignored. Pass nonce/constructable on the first getRuntime/baroStart call.`);
    }
  }
  return runtime;
}

/**
 * #407: if the browser resolved styles before the boot insert (a frame or a forced style read before
 * DOMContentLoaded), `transition` utilities would animate from the unstyled values for their duration (the #405
 * first-paint tail). Right after the synchronous first insert, finish the CSS transitions that insert started, so
 * elements jump to their final styles. It uses no stylesheet (so nothing for CSP, nonce or constructable mode to
 * allow) and runs once per boot: transitions triggered later by class changes run normally.
 */
function snapshotAnimations(root: Document | ShadowRoot): Set<Animation> | null {
    // Taken right before the insert: the style flush it forces can't start transitions (no value changes yet).
    if (typeof root.getAnimations !== 'function' || typeof CSSTransition === 'undefined') return null;
    return new Set(root.getAnimations());
}
function finishBootTransitions(root: Document | ShadowRoot, before: Set<Animation> | null) {
    if (!before) return;
    // Only transitions the insert started; ones the page started before or during boot keep running.
    for (const a of root.getAnimations()) if (a instanceof CSSTransition && !before.has(a)) a.finish();
}

type BaroBootOptions = BrowserRuntimeOptions & { loadingClassName?: string };

/**
 * Starts BaroCSS on the document (the shared runtime). #327: with `root: shadowRoot` it instead returns a new
 * runtime that observes and styles only that shadow root (runtimes with the same config share one sheet).
 */
export function baroBoot(options: BaroBootOptions & { root: ShadowRoot }): BrowserRuntime;
export function baroBoot(options?: BaroBootOptions): void;
export function baroBoot({ loadingClassName = 'baro-boot', ...options }: BaroBootOptions = {}): BrowserRuntime | void {
    if (options.root && options.root.nodeType === 11) {
        const before = snapshotAnimations(options.root);
        const shadowRuntime = new BrowserRuntime(options);
        finishBootTransitions(options.root, before);
        return shadowRuntime;
    }
    if (!document.body) {
        document.addEventListener('DOMContentLoaded', () => baroBoot({ loadingClassName, ...options }), { once: true });
        return;
    }
    const startClassName = `${loadingClassName}-doing`;
    const endClassName = `${loadingClassName}-done`;
    try {    

        document.body.classList.add(startClassName);

        const runtime = getRuntime(options);
        const before = snapshotAnimations(document);
        runtime.observe(document.body, { scan: true, onReady: () => {
            document.body.classList.remove(startClassName);
            document.body.classList.add(endClassName);
        }});
        finishBootTransitions(document, before);
    } catch (error) {
        document.body?.classList.remove(startClassName);
        // console-ok: one-shot boot failure; otherwise the page stays unstyled with no signal
        // eslint-disable-next-line no-console
        console.error('BaroCSS boot failed:', error);
    }
}

export const baroStart = baroBoot;

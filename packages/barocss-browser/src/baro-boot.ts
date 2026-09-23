import { BrowserRuntime, BrowserRuntimeOptions } from "./browser-runtime";

let runtime: BrowserRuntime | null = null;

export function getRuntime(options: BrowserRuntimeOptions) {
  if (!runtime || runtime.getStats().isDestroyed) {
    runtime = new BrowserRuntime(options);
  }
  return runtime;
}

type BaroBootOptions = BrowserRuntimeOptions & { loadingClassName?: string };

export function baroBoot({ loadingClassName = 'baro-boot', ...options }: BaroBootOptions = {}) {
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

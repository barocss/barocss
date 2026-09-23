import { createContext, generateCssRules } from '@barocss/kit';
import { BrowserRuntime } from '@barocss/browser';

// The renderer knows only this class/CSS boundary. Model and UI spec formats
// stay outside the BaroCSS packages.
export function createBaroAdapter() {
  const context = createContext({});
  const runtime = new BrowserRuntime({ styleId: 'ai-ui-poc' });
  return {
    resolveClass(cls) { return generateCssRules(cls, context)[0]; },
    addClass(classes) { runtime.addClass(classes); },
    destroy() { runtime.destroy(); },
  };
}

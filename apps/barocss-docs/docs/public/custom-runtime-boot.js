import { BrowserRuntime } from '../../../../packages/barocss-browser/dist/index.es.js';
(function () {
    if (typeof window === 'undefined') return;
    console.log('[BaroCSS] custom-runtime-boot loaded');
    const runtime = new BrowserRuntime();
    runtime.observe(document.body, { scan: true });
})();

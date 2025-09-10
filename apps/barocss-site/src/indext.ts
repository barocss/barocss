import { BrowserRuntime } from '@barocss/browser';

const runtime = new BrowserRuntime();
runtime.observe(document.body, { scan: true });
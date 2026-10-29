// Integration fixture: mount the real App through a controllable React root.
import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import { App } from '../../src/App';
import '../../src/styles.css';
import '../../src/tailwind.css';
let root: Root | null = null;
const lifecycle = {
  mount() {
    if (root) throw new Error('App root already mounted');
    root = createRoot(document.getElementById('root')!); root.render(createElement(App));
  },
  unmount() { root?.unmount(); root = null; },
};
Object.assign(window, { __engineLifecycle: lifecycle });
lifecycle.mount();

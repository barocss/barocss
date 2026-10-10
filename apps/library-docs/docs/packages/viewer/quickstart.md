# Load a native Surface and attach controls

Copy the real [two-surfaces.barocad fixture](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/examples/viewer-scene/two-surfaces.barocad) into your host assets. Read it as text. Pass the complete text and a visible canvas to this browser-bundled function.

```ts
import { createViewer } from '@barocss/viewer';

export function openNative(canvas: HTMLCanvasElement, sourceText: string) {
  const viewer = createViewer(canvas, {
    mmToSceneUnit: 0.001, background: [0.04, 0.06, 0.1],
  });
  try {
    viewer.loadNative(sourceText, { sourceVersion: 0, countU: 8, countV: 8 });
    canvas.tabIndex = 0;
    canvas.style.touchAction = 'none';
    const controls = viewer.attachPointerControls({ onError: console.error });
    const keys = viewer.attachKeyboardControls({ onError: console.error });
    return { viewer, dispose() { keys.dispose(); controls.dispose(); viewer.dispose(); } };
  } catch (error) {
    viewer.dispose();
    throw error;
  }
}
```

At this scale, 1000 native millimetres become one scene unit. Primary drag orbits; Shift-drag pans; wheel zooms. Focus the canvas and press F to fit or Escape to clear selection. The host sets focus and installs its own click selection handler. Controls do not edit native source or select geometry.

Call `viewer.pick(xCss,yCss)` with canvas-local CSS pixels, then `viewer.select(hit.ref)` when a hit exists. This selects a displayed Surface reference, not a native ray/Surface intersection certificate. See [measurement](./guides#measure-original-native-points).

[Manifest and version](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-viewer/package.json) · [Package task notes](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-viewer/README.md)

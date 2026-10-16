import * as ViewerSampleAPI from '@barocss/viewer';

export async function createViewerExample(canvas, source) {
  const priorTabIndex = canvas.getAttribute('tabindex');
  const priorTouchAction = canvas.style.touchAction;
  // The Viewer draws with WebGPU through the @barocss/gpu viewer; creation is asynchronous.
  const viewer = await ViewerSampleAPI.createViewer(canvas, {
    mmToSceneUnit: 0.001,
    background: [0.04, 0.06, 0.1],
  });
  let acceptedSource;
  let pointer;
  let keyboard;
  let disposed = false;
  let controlError = null;
  function load(text) {
    viewer.loadNative(text, { sourceVersion: 0, countU: 3, countV: 3 });
    acceptedSource = text;
    controlError = null;
  }
  function report() {
    const state = viewer.getState();
    const sampled = state.native?.surfaces[0];
    const grid = sampled?.report.grid;
    const centerVertex = grid ? Math.floor(grid.countU / 2) * grid.countV + Math.floor(grid.countV / 2) : 0;
    return {
      backend: '@barocss/viewer on the @barocss/gpu WebGPU viewer',
      status: state.status,
      surfaces: state.surfaces,
      midpointMM: sampled?.packet.positions.slice(centerVertex * 3, centerVertex * 3 + 3) ?? null,
      vertices: sampled?.report.vertexCount ?? 0,
      triangles: sampled?.report.triangleCount ?? 0,
      sourceUnit: state.sourceUnit,
      mmToSceneUnit: state.mmToSceneUnit,
      frame: state.frame,
      curves: state.curves,
      camera: state.camera,
      selected: state.selected,
      selectedGeometry: state.selectedGeometry,
      native: state.native ? {
        source: state.native.source,
        modelId: state.native.model.name,
        modelVersion: state.native.model.version,
        lengthUnit: state.native.model.lengthUnit,
        objectIds: state.native.model.objects.map(object => object.id),
      } : null,
      grid: grid ?? null,
      midpointParameters: sampled?.packet.parameters.slice(centerVertex * 2, centerVertex * 2 + 2) ?? null,
      controlError,
    };
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    keyboard?.dispose();
    pointer?.dispose();
    try { viewer.dispose(); }
    finally {
      if (priorTabIndex === null) canvas.removeAttribute('tabindex');
      else canvas.setAttribute('tabindex', priorTabIndex);
      canvas.style.touchAction = priorTouchAction;
    }
  }
  try {
    load(source); // Native admission already fits and presents before committing its state.
    canvas.tabIndex = 0;
    canvas.style.touchAction = 'none';
    const onError = error => { controlError = error instanceof Error ? error.message : String(error); };
    pointer = viewer.attachPointerControls({ onError });
    keyboard = viewer.attachKeyboardControls({ onError });
  } catch (error) {
    dispose();
    throw error;
  }
  return {
    update(text) { load(text); return report(); },
    report,
    dispose,
    action(id) {
      if (disposed) throw new Error('Viewer sample is disposed');
      if (id === 'fit') viewer.fit();
      else if (id === 'clear') viewer.clear();
      else if (id === 'reload') load(acceptedSource);
      else throw new Error(`Unknown Viewer sample action: ${id}`);
      controlError = null;
      return report();
    },
  };
}

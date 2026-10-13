import * as CanvasSampleAPI from '@barocss/canvas2d';

const logicalSize = { width: 320, height: 200 };
const dpr = 1;

function parseInput(source) {
  if (typeof source !== 'string' || new TextEncoder().encode(source).length > 65536) {
    throw Error('Host JSON must be text within 64KiB');
  }
  const input = JSON.parse(source);
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).length !== 2 || !Object.hasOwn(input, 'rectangle') ||
      !Object.hasOwn(input, 'probe')) {
    throw Error('Host JSON requires exactly rectangle and probe');
  }
  const probe = input.probe;
  if (!probe || typeof probe !== 'object' || Array.isArray(probe) ||
      Object.keys(probe).length !== 2 || !Object.hasOwn(probe, 'x') ||
      !Object.hasOwn(probe, 'y') || [probe.x, probe.y].some(value =>
        typeof value !== 'number' || !Number.isFinite(value) || Object.is(value, -0) ||
        Math.abs(value) > 1e6)) {
    throw Error('Host probe requires finite x/y coordinates within ±1000000');
  }
  return input;
}

function createCandidate(source) {
  const input = parseInput(source);
  const tree = CanvasSampleAPI.createDisplayTree('RectangleScene');
  const rect = tree.createRect(input.rectangle);
  tree.stage.addChild(rect);
  return { input, source, tree, rect, snapshot: tree.snapshot() };
}

export function createCanvas2DExample(canvas, source) {
  let accepted = createCandidate(source); // CPU validation before allocating GPU resources.
  const renderer = CanvasSampleAPI.createCanvas2D(canvas, {
    logicalSize, dpr, backgroundColor: [.063, .094, .125, 1]
  });
  let disposed = false;
  let result;

  function active() {
    if (disposed) throw new CanvasSampleAPI.Canvas2DError('DISPOSED', 'Example is disposed');
  }
  function makeReport(candidate) {
    const data = candidate.rect.data;
    return {
      backend: 'Canvas2D WebGL2',
      sceneVersion: candidate.snapshot.version,
      probe: { ...candidate.input.probe },
      hit: renderer.hitTest(candidate.input.probe),
      rectangle: {
        id: data.id, x: data.transform.x, y: data.transform.y,
        width: data.width, height: data.height, fill: data.fill
      },
      logicalSize: { ...logicalSize }, dpr,
      backingSize: { width: canvas.width, height: canvas.height },
      inputFormat: 'Host JSON, not a package DSL',
      acceptedSource: candidate.source
    };
  }
  try {
    renderer.updateScene(accepted.snapshot);
    renderer.render();
    result = makeReport(accepted);
  } catch (error) {
    renderer.dispose();
    throw error;
  }

  function adopt(candidate) {
    active();
    try {
      renderer.updateScene(candidate.snapshot);
      renderer.render();
      const report = makeReport(candidate);
      accepted = candidate;
      result = report;
      return structuredClone(result);
    } catch (error) {
      // Restore admitted data and attempt frame restoration. Context loss can prevent paint.
      try { renderer.updateScene(accepted.snapshot); renderer.render(); } catch { /* Preserve the original error if best-effort frame restoration also fails. */ }
      throw error;
    }
  }

  return {
    update(text) {
      active();
      // A malformed JSON or invalid rectangle never reaches the live renderer.
      return adopt(createCandidate(text));
    },
    report() {
      active();
      return structuredClone(result);
    },
    action(id) {
      active();
      if (id !== 'resize-100') throw Error('Unknown Canvas2D example action');
      const candidate = createCandidate(accepted.source);
      const paint = candidate.rect.data;
      candidate.rect.setRect({ width: 100, height: paint.height, fill: paint.fill });
      candidate.input.rectangle.width = 100;
      candidate.source = JSON.stringify(candidate.input, null, 2);
      candidate.snapshot = candidate.tree.snapshot();
      return adopt(candidate);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      renderer.dispose();
    }
  };
}

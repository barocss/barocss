// @ts-check
import { createCanvas2D, createDisplayTree } from '@barocss/canvas2d';

const pose = (/** @type {number} */ x, /** @type {number} */ y) =>
  ({ x, y, scaleX: 1, scaleY: 1, rotation: 0 });

export function verifyAlphaComposites() {
  const canvas = document.createElement('canvas');
  const options = { logicalSize: { width: 80, height: 50 }, dpr: 2 };
  const renderer = createCanvas2D(canvas, options);
  try {
    renderer.setImageAsset('Red', { width: 1, height: 1,
      pixels: new Uint8Array([255, 0, 0, 255]) });
    renderer.setImageAsset('Green', { width: 1, height: 1,
      pixels: new Uint8Array([0, 255, 0, 255]) });
    renderer.setImageAsset('White', { width: 1, height: 1,
      pixels: new Uint8Array([255, 255, 255, 255]) });
    const tree = createDisplayTree('AlphaComposites');
    const back = tree.createRect({ id: 'Back', layer: 0, transform: pose(0, 0),
      width: 80, height: 50, fill: [0.25, 0.25, 0.25, 1] });
    const parent = tree.createContainer({ id: 'Parent', layer: 1, transform: pose(0, 0), alpha: 0.5 });
    const frame = tree.createFrame({ id: 'Frame', layer: 0, transform: pose(0, 0),
      width: 70, height: 40, fill: [0, 0, 0, 0], clip: false, alpha: 0.5 });
    const path = tree.createPath({ id: 'Path', layer: 0, transform: pose(10, 10),
      commands: [{ kind: 'M', x: 0, y: 0 }, { kind: 'L', x: 10, y: 0 },
        { kind: 'L', x: 10, y: 10 }, { kind: 'L', x: 0, y: 10 }, { kind: 'Z' }],
      fill: { color: [1, 0, 0, 0.8], rule: 'evenodd' },
      stroke: { color: [0, 1, 0, 0.8], width: 2 } });
    const line = tree.createLine({ id: 'Line', layer: 1, transform: pose(0, 0),
      x1: 10, y1: 30, x2: 20, y2: 30, width: 4, stroke: [0, 1, 0, 0.8] });
    const glyph = tree.createGlyphRun({ id: 'Glyph', layer: 2, transform: pose(30, 10),
      atlasId: 'White', text: 'H', baseline: 0, opacity: 0.8, sampling: 'nearest',
      glyphs: [{ sourceRect: { x: 0, y: 0, width: 1, height: 1 },
        x: 0, y: 0, width: 10, height: 10, textStart: 0, textEnd: 1 }] });
    const additive = tree.createSprite({ id: 'Add', layer: 3, transform: pose(40, 10),
      imageId: 'Red', width: 20, height: 10, opacity: 0.8, sampling: 'nearest',
      anchorX: 0, anchorY: 0, blendMode: 'add' });
    const normal = tree.createSprite({ id: 'Normal', layer: 2, transform: pose(50, 10),
      imageId: 'Green', width: 10, height: 10, opacity: 1, sampling: 'nearest',
      anchorX: 0, anchorY: 0 });
    tree.stage.addChild(back); tree.stage.addChild(parent); tree.stage.addChild(normal);
    parent.addChild(frame);
    for (const child of [path, line, glyph, additive]) frame.addChild(child);
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true,
      antialias: false, preserveDrawingBuffer: true, stencil: true });
    if (!gl) throw new Error('WebGL2 context missing');
    const sample = (/** @type {number} */ x, /** @type {number} */ y) => {
      const bytes = new Uint8Array(4);
      gl.readPixels(x * options.dpr, canvas.height - y * options.dpr - 1,
        1, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
      return { rgba: [...bytes], hit: renderer.hitTest({ x, y })?.id ?? null };
    };
    const observe = () => ({ path: sample(15, 15), pathStroke: sample(10, 15),
      line: sample(15, 30), glyph: sample(35, 15), add: sample(45, 15),
      normal: sample(55, 15) });
    renderer.updateScene(tree.snapshot()); renderer.render();
    const half = observe();
    parent.setAlpha(0); renderer.updateScene(tree.snapshot()); renderer.render();
    const zero = observe();
    for (const [key, id] of Object.entries({ path: 'Path', line: 'Line',
      glyph: 'Glyph', add: 'Add', normal: 'Normal' })) {
      if (half[/** @type {keyof typeof half} */ (key)].hit !== id) {
        throw new Error(`half-alpha ${key} hit mismatch`);
      }
    }
    if (half.path.rgba[0] <= 64 || half.line.rgba[1] <= 64 ||
        half.glyph.rgba[0] <= 64 || half.add.rgba[0] <= 64 ||
        half.normal.rgba.join(',') !== '0,255,0,255') {
      throw new Error('half-alpha vector/image blend mismatch');
    }
    for (const key of ['path', 'pathStroke', 'line', 'glyph', 'add']) {
      if (zero[/** @type {keyof typeof zero} */ (key)].hit !== 'Back' ||
          zero[/** @type {keyof typeof zero} */ (key)].rgba.join(',') !== '64,64,64,255') {
        throw new Error(`zero-alpha ${key} did not fall through`);
      }
    }
    if (zero.normal.hit !== 'Normal') throw new Error('independent normal sprite changed');
    return { half, zero };
  } finally { renderer.dispose(); }
}

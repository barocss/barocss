import { createCanvas2DApplication } from '../../../dist/index.js';
import type { Canvas2DApplication, Canvas2DApplicationOptions, TickInfo } from '../../../dist/index.js';

export function example(canvas: HTMLCanvasElement): Canvas2DApplication {
  const options: Canvas2DApplicationOptions = {
    contextId: 'ApplicationTypes', renderer: { logicalSize: { width: 320, height: 200 }, dpr: 2 },
    autoStart: false,
  };
  const app = createCanvas2DApplication(canvas, options);
  const actor = app.tree.createRect({
    id: 'Actor', layer: 0, transform: { x: 10, y: 10, scaleX: 1, scaleY: 1, rotation: 0 },
    width: 20, height: 20, fill: [1, 0, 0, 1],
  });
  app.tree.stage.addChild(actor);
  const unsubscribe: () => void = app.onUpdate((info: TickInfo) =>
    actor.setPosition(actor.data.transform.x + info.deltaMS * 0.02, 10));
  app.render();
  app.start();
  app.stop();
  unsubscribe();
  app.dispose();
  return app;
}

export function typeRefusals(app: Canvas2DApplication, canvas: HTMLCanvasElement): void {
  // @ts-expect-error Application owns its renderer; it cannot be replaced.
  app.renderer = app.renderer;
  // @ts-expect-error Optional autoStart is a boolean.
  createCanvas2DApplication(canvas, { contextId: 'Invalid', renderer: { logicalSize: { width: 1, height: 1 }, dpr: 1 }, autoStart: 1 });
  // @ts-expect-error External tree injection is not part of the Application contract.
  createCanvas2DApplication(canvas, { contextId: 'Invalid', renderer: { logicalSize: { width: 1, height: 1 }, dpr: 1 }, tree: app.tree });
}

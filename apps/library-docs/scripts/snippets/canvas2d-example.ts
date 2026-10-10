import { createDisplayTree, createDisplayTreeFromScene, Canvas2DError } from '@barocss/canvas2d';
const tree = createDisplayTree('RectangleScene');
const rect = tree.createRect({ id: 'Rectangle', layer: 0,
  transform: { x: 20, y: 20, scaleX: 1, scaleY: 1, rotation: 0 },
  width: 80, height: 50, fill: [1, 0, 0, 1] });
tree.stage.addChild(rect);
rect.setRect({ width: 100, height: 50, fill: [1, 0, 0, 1] });
let refused = '';
try { rect.setRect({ width: 0, height: 50, fill: [1, 0, 0, 1] }); }
catch (error) { if (!(error instanceof Canvas2DError)) throw error; refused = error.code; }
const scene = tree.snapshot();
const fresh = createDisplayTreeFromScene(scene);
const restored = fresh.get('Rectangle');
if (rect.data.width !== 100 || !restored || refused !== 'INVALID_SCENE') throw new Error('Unexpected rectangle result');
console.log(JSON.stringify({ task: 'canvas2d-tree', sceneVersion: scene.version,
  acceptedWidth: rect.data.width, refused, newHandle: restored !== rect,
  rendered: false }, null, 2));

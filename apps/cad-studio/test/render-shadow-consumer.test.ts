import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultRender, type RenderLight, type RenderSettings } from '@barocss/cad-model/engine/render';
import { isRefusal } from '@barocss/cad-model/engine/refusal';
import type { Light } from '@barocss/gpu/viewer';
import { changeRenderLights } from '../src/ui/RenderPanel';
import { GpuRenderer } from '../src/viewport/gpuRenderer';
import { OrbitCamera } from '../src/viewport/camera';
import type { ViewState } from '../src/viewport/renderer';

// Actual Studio mutation gate and renderer, with a recording viewer only. No browser, GPU resources,
// native evaluation or shadow-image oracle. The common Model validator is not mocked or reimplemented.
const point = (extra: Partial<Extract<RenderLight, { kind: 'point' }>> = {}): Extract<RenderLight, { kind: 'point' }> =>
  ({ kind: 'point', position: [20, 30, 80], color: '#ffffff', intensity: 1, range: 200, ...extra });
const spot = (extra: Partial<Extract<RenderLight, { kind: 'spot' }>> = {}): Extract<RenderLight, { kind: 'spot' }> =>
  ({ kind: 'spot', position: [25, -30, 90], direction: [0, 0, -1], color: '#ffeedd', intensity: 2, range: 300, angle: 30, penumbra: 0.2, ...extra });
const settings = (lights: RenderLight[]): RenderSettings => ({ ...defaultRender(), lights, sceneScale: 1000 });
const view: ViewState = { hoverFace: null, hoverEdge: null, selectedFaces: [], selectedEdges: [], selectedBodies: [], offsets: new Map(), ghostBodies: new Set() };

function recordingRenderer() {
  let frames = 0, backgrounds = 0;
  const viewer = {
    camera: {}, lights: [] as Light[], environment: {}, grid: {},
    setBackground() { backgrounds++; }, requestRender() {}, resize() {}, render() { frames++; },
  };
  // Existing renderer tests use its constructor with a recording viewer instead of creating a GPU device.
  const Renderer = GpuRenderer as unknown as new (canvas: HTMLCanvasElement, viewer: unknown) => GpuRenderer;
  const renderer = new Renderer({ clientWidth: 1440, clientHeight: 1000 } as HTMLCanvasElement, viewer);
  // A 60-by-80 mm scene has a 100 mm diagonal. Bounds are input; the actual renderer computes its scale.
  renderer.bounds = () => ({ min: [0, 0, 0], max: [60, 80, 0] });
  const camera = new OrbitCamera();
  return { renderer, viewer, draw() { renderer.render(camera, view); }, get frames() { return frames; }, get backgrounds() { return backgrounds; } };
}

test('G15 the panel mutation gate preserves optional mm values and refuses before the accepted render or undo callback changes', () => {
  let accepted = settings([point({ castShadow: false, shadowRadius: 1e40 })]);
  const undo: RenderSettings[] = [];
  const commit = (next: RenderSettings) => { undo.push(accepted); accepted = next; };
  const initial = structuredClone(accepted);
  const invalid = accepted.lights.map(light => light.kind === 'point' ? { ...light, castShadow: true } : light);
  assert.throws(() => changeRenderLights(accepted, invalid, commit), error => isRefusal(error, 'VALUE'));
  assert.equal(undo.length, 0, 'invalid activation must not reach the document/undo callback');
  assert.deepEqual(accepted, initial);

  const candidate = Object.freeze([point(), point({ castShadow: false, shadowRadius: 0 }), spot({ castShadow: true, shadowRadius: 1 / 3 })]);
  const before = structuredClone(candidate);
  changeRenderLights(accepted, candidate, commit);
  assert.equal(undo.length, 1);
  assert.deepEqual(undo[0], initial);
  assert.deepEqual(accepted.lights, before);
  assert.notEqual(accepted.lights, candidate, 'the controlled panel must not retain the caller array');
  assert.deepEqual(candidate, before);
  assert.equal(Object.hasOwn(accepted.lights[0], 'castShadow'), false);
  assert.equal(Object.hasOwn(accepted.lights[0], 'shadowRadius'), false);
  const off = accepted.lights[1], active = accepted.lights[2];
  assert.ok(off.kind === 'point' && active.kind === 'spot');
  assert.equal(off.castShadow, false); assert.equal(off.shadowRadius, 0);
  assert.equal(active.shadowRadius, 1 / 3, 'admission must not replace authored radius with its f32 value');
});

test('G15 the actual renderer forwards world-mm lengths and flags while retaining the existing intensity scale', () => {
  const f = recordingRenderer();
  const input = settings([point(), point({ castShadow: false, shadowRadius: 0 }), point({ shadowRadius: 2 }),
    point({ castShadow: true, shadowRadius: 1 / 3 }), spot({ castShadow: true, shadowRadius: 2 })]);
  const before = structuredClone(input);
  f.renderer.setRender(input); f.draw();
  assert.equal(f.frames, 1);
  assert.equal(f.viewer.lights.length, 5);
  for (let i = 0; i < input.lights.length; i++) {
    const authored = input.lights[i], sent = f.viewer.lights[i];
    assert.ok(authored.kind !== 'directional' && sent.kind !== 'directional');
    assert.deepEqual(sent.position, authored.position);
    assert.equal(sent.range, authored.range);
    assert.equal(sent.intensity, i === 4 ? 1000 : 500);
    assert.equal(Object.hasOwn(sent, 'castShadow'), Object.hasOwn(authored, 'castShadow'));
    assert.equal(Object.hasOwn(sent, 'shadowRadius'), Object.hasOwn(authored, 'shadowRadius'));
    assert.equal(sent.castShadow, authored.castShadow);
    assert.equal(sent.shadowRadius, authored.shadowRadius, 'scene size and CSS sceneScale must not scale light radius');
  }
  const sentSpot = f.viewer.lights[4]; assert.ok(sentSpot.kind === 'spot');
  assert.deepEqual(sentSpot.direction, [0, 0, -1]);
  assert.equal(sentSpot.angle, 30); assert.equal(sentSpot.penumbra, 0.2);
  assert.deepEqual(input, before);
});

test('G15 replacing settings, switching shadows off and returning to modelling do not retain prior shadow fields', () => {
  const f = recordingRenderer();
  f.renderer.setRender(settings([point({ castShadow: true, shadowRadius: 2 }), spot({ castShadow: true, shadowRadius: 3 })]));
  f.draw();
  const prior = f.viewer.lights;
  f.renderer.setRender(settings([point({ castShadow: false, shadowRadius: 0 }), spot({ castShadow: false, shadowRadius: 0 })]));
  f.draw();
  assert.notEqual(f.viewer.lights, prior);
  for (const light of f.viewer.lights) {
    assert.ok(light.kind === 'point' || light.kind === 'spot');
    assert.equal(light.castShadow, false); assert.equal(light.shadowRadius, 0);
  }
  f.renderer.setRender(settings([point(), spot()])); f.draw();
  for (const light of f.viewer.lights) {
    assert.equal(Object.hasOwn(light, 'castShadow'), false);
    assert.equal(Object.hasOwn(light, 'shadowRadius'), false);
  }
  f.renderer.setRender(settings([])); f.draw();
  assert.deepEqual(f.viewer.lights, []);
  f.renderer.setRender(null); f.draw();
  assert.equal(f.viewer.lights.length, 3, 'restore the existing modelling light list');
  assert.ok(f.viewer.lights.every(light => light.kind === 'directional'));
  assert.ok(f.viewer.lights.every(light => !Object.hasOwn(light, 'shadowRadius')));
});

test('G15 an invalid renderer replacement leaves the previously accepted lights and appearance installed', () => {
  const f = recordingRenderer();
  const accepted = settings([point({ castShadow: true, shadowRadius: 2 }), spot({ castShadow: true, shadowRadius: 1 / 3 })]);
  const before = structuredClone(accepted);
  f.renderer.setRender(accepted); f.draw();
  const payload = structuredClone(f.viewer.lights), backgrounds = f.backgrounds;
  const invalid = { ...accepted, lights: [point({ castShadow: true }), point({ castShadow: true })],
    environment: { ...accepted.environment, top: '#000000' as const } };
  assert.throws(() => f.renderer.setRender(invalid), error => isRefusal(error, 'VALUE'));
  assert.equal(f.backgrounds, backgrounds, 'refuse before applyLook changes the accepted appearance');
  f.draw();
  assert.deepEqual(f.viewer.lights, payload);
  assert.deepEqual(accepted, before);
});

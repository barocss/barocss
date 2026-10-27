import test from 'node:test';
import assert from 'node:assert/strict';
import { handleCameraKey } from '../keyboard-controls.js';

const canvas = {};
function key(key, options = {}) {
  return { key, target: canvas, repeat: false, shiftKey: false, ctrlKey: false, altKey: false,
    metaKey: false, isComposing: false, defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; }, ...options };
}
function setup() {
  const calls = [], errors = [];
  const viewer = { captureReviewState: () => ({ camera: { eye: [0, 0, 10], target: [0, 0, 0] } }),
    orbit: (...args) => calls.push(['orbit', ...args]), pan: (...args) => calls.push(['pan', ...args]),
    zoom: (...args) => calls.push(['zoom', ...args]) };
  return { viewer, calls, errors, options: { canvas, viewer, isLoaded: () => true, onError: error => errors.push(error) } };
}

test('canvas arrow, shifted arrow and zoom keys invoke public camera controls, including repeats', () => {
  const s = setup();
  for (const event of [key('ArrowRight'), key('ArrowUp', { repeat: true }),
    key('ArrowLeft', { shiftKey: true }), key('ArrowDown', { shiftKey: true }),
    key('+', { shiftKey: true }), key('='), key('-')]) {
    assert.equal(handleCameraKey(event, s.options), true);
    assert.equal(event.defaultPrevented, true);
  }
  assert.deepEqual(s.calls, [['orbit', Math.PI / 36, 0], ['orbit', 0, Math.PI / 36],
    ['pan', -0.8, 0], ['pan', 0, -0.8], ['zoom', 1.15], ['zoom', 1.15], ['zoom', 1 / 1.15]]);
  assert.deepEqual(s.errors, []);
});

test('inputs, composing and modifier keys, unrelated keys and an unloaded viewer are left alone', () => {
  const s = setup();
  for (const event of [key('ArrowLeft', { target: {} }), key('ArrowUp', { isComposing: true }),
    key('ArrowUp', { ctrlKey: true }), key('ArrowUp', { altKey: true }), key('ArrowUp', { metaKey: true }),
    key('ArrowUp', { defaultPrevented: true }), key('f'), key('Escape'), key('Tab'), key('x'), key('toString'),
    key('_', { shiftKey: true })]) {
    const wasPrevented = event.defaultPrevented;
    assert.equal(handleCameraKey(event, s.options), false);
    assert.equal(event.defaultPrevented, wasPrevented);
  }
  const e = key('ArrowUp');
  assert.equal(handleCameraKey(e, { ...s.options, isLoaded: () => false }), false);
  assert.equal(e.defaultPrevented, false);
  assert.deepEqual(s.calls, []);
});

test('a camera error is reported and the recognized key still prevents page scrolling', () => {
  const s = setup(), failure = new Error('camera unavailable'), e = key('ArrowLeft');
  s.viewer.orbit = () => { throw failure; };
  assert.equal(handleCameraKey(e, s.options), true);
  assert.equal(e.defaultPrevented, true);
  assert.deepEqual(s.errors, [failure]);
});

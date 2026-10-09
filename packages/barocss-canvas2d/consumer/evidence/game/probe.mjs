import assert from 'node:assert/strict';

const { createDisplayTree, createSpriteAtlas, createSpriteAnimation, createTicker } =
  await import(new URL('../../../dist/index.js', import.meta.url));

// This is a public API timing probe. It does not create or simulate a renderer.
const entries = ['Red', 'Green', 'Blue'].map((name, index) => ({
  name, sourceRect: { x: index * 16, y: 0, width: 16, height: 16 }, durationMS: 100,
}));
const atlas = createSpriteAtlas('GameAtlas', { width: 64, height: 16 }, entries);
entries[0].sourceRect.x = 48;
const copiedFrame = atlas.frame('Red');
copiedFrame.sourceRect.x = 48;
assert.equal(atlas.frame('Red').sourceRect.x, 0);
assert.throws(() => createSpriteAtlas('GameAtlas', { width: 64, height: 16 }, [{
  name: 'Outside', sourceRect: { x: 63, y: 0, width: 16, height: 16 }, durationMS: 100,
}]), error => error?.code === 'INVALID_ASSET');

const tree = createDisplayTree('GameTimingProbe');
const group = tree.createContainer({ id: 'ActorGroup', layer: 0,
  transform: { x: 30, y: 20, scaleX: 1.2, scaleY: 1.1, rotation: 0.2 } });
const initialPosition = { x: 24, y: 30 };
const actor = tree.createSprite({ id: 'Actor', layer: 0,
  transform: { ...initialPosition, scaleX: 1, scaleY: 1, rotation: 0 },
  imageId: 'GameAtlas', width: 16, height: 16, opacity: 1, sampling: 'nearest',
  anchorX: 0.5, anchorY: 0.5 });
group.addChild(actor);
tree.stage.addChild(group);
const sequence = atlas.sequence(['Red', 'Green', 'Blue']);
const animation = createSpriteAnimation(actor, sequence);
sequence[1].sourceRect.x = 48;
sequence[1].durationMS = 1000;
assert.equal(animation.frameIndex, 0);
assert.equal(actor.data.sourceRect.x, 0);

const beforeInvalidEdit = tree.snapshot();
assert.throws(() => actor.setSourceRect({ x: 0, y: 0, width: 0, height: 16 }),
  error => error?.code === 'INVALID_SCENE');
assert.deepEqual(tree.snapshot(), beforeInvalidEdit);
assert.throws(() => createSpriteAnimation(actor, [{
  imageId: 'GameAtlas', sourceRect: { x: 0, y: 0, width: 16, height: 16 }, durationMS: 0,
}]), error => error?.code === 'INVALID_SCENE');
assert.deepEqual(tree.snapshot(), beforeInvalidEdit);

let nextToken = 0;
const pending = new Map();
const cancelled = [];
const scheduler = {
  requestFrame(callback) {
    const token = ++nextToken;
    pending.set(token, callback);
    return token;
  },
  cancelFrame(token) { cancelled.push(token); pending.delete(token); },
};
function scheduledCallback() {
  assert.equal(pending.size, 1);
  return pending.values().next().value;
}
function deliver(timestampMS) {
  assert.equal(pending.size, 1);
  const [token, callback] = pending.entries().next().value;
  pending.delete(token);
  callback(timestampMS);
}

const ticker = createTicker(scheduler);
const ticks = [];
let hostCallbacks = 0;
const unsubscribe = ticker.onTick(info => {
  hostCallbacks++;
  animation.advance(info.deltaMS);
  const snapshot = tree.snapshot();
  assert.equal(snapshot.nodes[0].children[0].id, 'Actor');
  ticks.push({ elapsedMS: info.elapsedMS, deltaMS: info.deltaMS,
    frameIndex: animation.frameIndex });
});
animation.play();
ticker.start();
deliver(100);
assert.deepEqual(ticks[0], { elapsedMS: 0, deltaMS: 0, frameIndex: 0 });
deliver(5100);
assert.deepEqual(ticks[1], { elapsedMS: 5000, deltaMS: 100, frameIndex: 1 });
assert.equal(actor.data.sourceRect.x, 16);

const stoppedCallback = scheduledCallback();
ticker.stop();
animation.pause();
assert.equal(pending.size, 0);
const paused = tree.snapshot();
assert.equal(animation.advance(100), false);
stoppedCallback(5200);
assert.equal(hostCallbacks, 2);
assert.deepEqual(tree.snapshot(), paused);

// The host implements a paused step by playing, advancing 100 ms, then pausing.
animation.play();
assert.equal(animation.advance(100), true);
animation.pause();
assert.equal(animation.frameIndex, 2);
assert.equal(actor.data.sourceRect.x, 32);
assert.equal(animation.playing, false);
actor.setPosition(90, 70);
animation.pause();
animation.seek(0);
actor.setPosition(initialPosition.x, initialPosition.y);
assert.equal(animation.frameIndex, 0);
assert.equal(actor.data.sourceRect.x, 0);
assert.equal(animation.playing, false);
assert.deepEqual(actor.data.transform, { ...initialPosition, scaleX: 1, scaleY: 1, rotation: 0 });

animation.play();
ticker.start();
deliver(10_000);
assert.deepEqual(ticks[2], { elapsedMS: 0, deltaMS: 0, frameIndex: 0 });
deliver(10_100);
assert.equal(animation.frameIndex, 1);
unsubscribe();
unsubscribe();
const callbacksBeforeUnsubscribedTick = hostCallbacks;
deliver(10_200);
assert.equal(hostCallbacks, callbacksBeforeUnsubscribedTick);
assert.equal(animation.frameIndex, 1);
const disposedCallback = scheduledCallback();
ticker.dispose();
animation.dispose();
ticker.dispose();
animation.dispose();
assert.equal(pending.size, 0);
assert.equal(ticker.running, false);
assert.equal(animation.playing, false);
disposedCallback(10_300);
assert.equal(hostCallbacks, callbacksBeforeUnsubscribedTick);
assert.throws(() => animation.advance(100), error => error?.code === 'DISPOSED');
assert.throws(() => ticker.start(), error => error?.code === 'DISPOSED');
assert.equal(cancelled.length, 2);

console.log(JSON.stringify({
  scope: 'compiled public API timing and host callback lifecycle',
  ticks, hostCallbacks, callbacksAfterUnsubscribe: 0, callbacksAfterDispose: 0,
  cancelledFrames: cancelled.length, stepMS: 100, resetFrameIndex: 0,
  copiedAtlasMetadata: true, copiedAnimationFrames: true,
  rejectedCropCode: 'INVALID_SCENE', invalidEditRetainedActor: true,
  rejectedAtlasCropCode: 'INVALID_ASSET', rejectedAnimationFrameCode: 'INVALID_SCENE',
  gpuTested: false, browserTested: false,
}));

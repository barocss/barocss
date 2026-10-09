import assert from 'node:assert/strict';

const { HostTextError, validateText, boundsFromMetrics, copyRaster } =
  await import(new URL('../../text-raster-host.mjs', import.meta.url));
const { createDisplayTree, stringifySceneJSON } =
  await import(new URL('../../../dist/index.js', import.meta.url));
const refuse = (operation, code) => assert.throws(operation,
  error => error instanceof HostTextError && error.code === code);

const acceptedText = ['Canvas2D', 'HI', 'H I', ' a0 ', 'A'.repeat(32)];
for (const input of acceptedText) assert.equal(validateText(input), input);
const invalidText = [undefined, null, 123, {}, new String('HI'), '', ' ', '    ',
  'A'.repeat(33), 'A\nB', 'A\tB', 'é', '한글', '😀', 'A-B', 'A_B', 'A!'];
for (const input of invalidText) refuse(() => validateText(input), 'HOST_TEXT');

// Synthetic metrics test the host's bounds policy; they are not browser-font measurements.
const metrics = { width: 48.5, actualBoundingBoxLeft: 1.25, actualBoundingBoxRight: 47.1,
  actualBoundingBoxAscent: 18.25, actualBoundingBoxDescent: 4.5 };
const bounds = boundsFromMetrics(metrics);
assert.deepEqual(bounds, { left: -4, right: 50, top: -21, bottom: 7, width: 54, height: 28,
  backingWidth: 108, backingHeight: 56, advance: 48.5 });
assert.deepEqual(boundsFromMetrics({ width: 13, actualBoundingBoxLeft: -3,
  actualBoundingBoxRight: 10, actualBoundingBoxAscent: 16, actualBoundingBoxDescent: -2 }),
{ left: 1, right: 12, top: -18, bottom: 0, width: 11, height: 18,
  backingWidth: 22, backingHeight: 36, advance: 13 });
let invalidMetrics = 0;
for (const field of Object.keys(metrics)) {
  for (const value of [undefined, NaN, Infinity, -Infinity]) {
    refuse(() => boundsFromMetrics({ ...metrics, [field]: value }), 'HOST_METRICS');
    invalidMetrics++;
  }
}
refuse(() => boundsFromMetrics({ ...metrics, actualBoundingBoxLeft: -10,
  actualBoundingBoxRight: 0 }), 'HOST_METRICS');
refuse(() => boundsFromMetrics({ ...metrics, actualBoundingBoxAscent: -10,
  actualBoundingBoxDescent: 0 }), 'HOST_METRICS');
const limitMetrics = { width: 508, actualBoundingBoxLeft: 0, actualBoundingBoxRight: 508,
  actualBoundingBoxAscent: 60, actualBoundingBoxDescent: 0 };
const atLimit = boundsFromMetrics(limitMetrics);
assert.equal(atLimit.backingWidth, 1024);
assert.equal(atLimit.backingHeight, 128);
assert.equal(atLimit.backingWidth * atLimit.backingHeight, 131072);
refuse(() => boundsFromMetrics({ ...limitMetrics, actualBoundingBoxRight: 508.001 }),
  'HOST_RASTER_LIMIT');
refuse(() => boundsFromMetrics({ ...limitMetrics, actualBoundingBoxAscent: 60.001 }),
  'HOST_RASTER_LIMIT');

const pixels = new Uint8ClampedArray(bounds.backingWidth * bounds.backingHeight * 4);
pixels[0] = 255; pixels[3] = 255;
const asset = copyRaster(bounds, pixels);
assert.equal(asset.width, bounds.backingWidth);
assert.equal(asset.height, bounds.backingHeight);
assert.ok(asset.pixels instanceof Uint8Array);
assert.notEqual(asset.pixels.buffer, pixels.buffer);
assert.equal(asset.pixels.byteLength, 24192);
pixels[0] = 0; pixels[3] = 0;
assert.deepEqual([...asset.pixels.subarray(0, 4)], [255, 0, 0, 255]);
const transparent = new Uint8ClampedArray(asset.pixels.byteLength); transparent[0] = 255;
refuse(() => copyRaster(bounds, transparent), 'HOST_RASTER');
refuse(() => copyRaster(bounds, new Uint8ClampedArray(asset.pixels.byteLength - 1)), 'HOST_RASTER');
const largestPixels = new Uint8ClampedArray(524288); largestPixels[3] = 1;
const largestAsset = copyRaster(atLimit, largestPixels);
assert.equal(largestAsset.pixels.byteLength, 524288);

// Public admission of one whole-label quad verifies metadata, not raster paint or GPU behavior.
const text = validateText('A'.repeat(32));
const layout = { atlasId: 'TextRaster', text, baseline: 0, opacity: 1, sampling: 'nearest',
  glyphs: [{ sourceRect: { x: 0, y: 0, width: asset.width, height: asset.height },
    x: bounds.left, y: bounds.top, width: bounds.width, height: bounds.height,
    textStart: 0, textEnd: text.length }] };
const tree = createDisplayTree('TextRasterProbe');
const glyph = tree.createGlyphRun({ id: 'Label', layer: 0,
  transform: { x: 40, y: 50, scaleX: 1, scaleY: 1, rotation: 0 }, ...layout });
tree.stage.addChild(glyph);
const snapshot = tree.snapshot();
assert.equal(snapshot.version, 23);
assert.equal(snapshot.nodes[0].text.length, 32);
assert.equal(snapshot.nodes[0].glyphs.length, 1);
assert.deepEqual(snapshot.nodes[0].glyphs[0], layout.glyphs[0]);
assert.equal(snapshot.nodes[0].baseline, 0);
assert.deepEqual(glyph.toWorld({ x: 0, y: 0 }), { x: 40, y: 50 });
assert.deepEqual(glyph.getLocalBounds(), { x: -4, y: -21, width: 54, height: 28 });
assert.deepEqual(glyph.getWorldBounds(), { x: 36, y: 29, width: 54, height: 28 });
const beforeInvalidLayout = stringifySceneJSON(snapshot);
assert.throws(() => glyph.setLayout({ ...layout,
  glyphs: [{ ...layout.glyphs[0], textEnd: 33 }] }), error => error?.code === 'INVALID_SCENE');
assert.equal(stringifySceneJSON(tree.snapshot()), beforeInvalidLayout);

console.log(JSON.stringify({ scope: 'pure host validation and public whole-label metadata',
  acceptedTextLengths: acceptedText.map(text => text.length), invalidTextCount: invalidText.length,
  invalidMetricValues: invalidMetrics, signedMetricExtents: true, bounds,
  maximumBacking: { width: atLimit.backingWidth, height: atLimit.backingHeight, bytes: 524288 },
  oversizeRejected: true, bytesCopied: true, emptyAlphaRejected: true, byteLengthRejected: true,
  sceneVersion: snapshot.version, wholeLabelRange: [0, 32], baseline: 0,
  invalidLayoutRetained: true, generationTested: false, browserFontTested: false, gpuTested: false }));

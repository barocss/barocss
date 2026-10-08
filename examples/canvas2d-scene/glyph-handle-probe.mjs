import assert from 'node:assert/strict';
import { createDisplayTree, createDisplayTreeFromScene, stringifySceneJSON } from '../../packages/barocss-canvas2d/dist/index.js';

const pose = (x = 0, y = 0) => ({ x, y, scaleX: 1, scaleY: 1, rotation: 0 });
const quad = (x, start) => ({ sourceRect: { x: start * 5, y: 0, width: 5, height: 7 },
  x, y: -56, width: 40, height: 56, textStart: start, textEnd: start + 1 });
const tree = createDisplayTree('GlyphProbe');
const team = tree.createContainer({ id: 'Team', layer: 0, transform: pose(10, 10) });
const glyph = tree.createGlyphRun({ id: 'Title', layer: 1, transform: pose(20, 0),
  atlasId: 'Atlas1', text: 'HI', baseline: 100, opacity: 1, sampling: 'nearest',
  glyphs: [quad(0, 0), quad(48, 1)] });
const sprite = tree.createSprite({ id: 'Icon', layer: 0, transform: pose(0, 0),
  imageId: 'IconAsset', width: 8, height: 8, opacity: 1, sampling: 'nearest', anchorX: 0, anchorY: 0 });
tree.stage.addChild(team); team.addChild(sprite); team.addChild(glyph);
const first = stringifySceneJSON(tree.snapshot());
assert.equal(tree.get('Title'), glyph);
const copy = glyph.data;
copy.glyphs[0].x = 900;
assert.equal(stringifySceneJSON(tree.snapshot()), first);
for (const bad of [
  { atlasId: 'Atlas1', text: 'HI', baseline: 100, opacity: 1, sampling: 'nearest', glyphs: [quad(0, 0), { ...quad(48, 1), textEnd: 3 }] },
  { atlasId: 'Atlas1', text: 'HI', baseline: 100, opacity: 2, sampling: 'nearest', glyphs: [quad(0, 0), quad(48, 1)] },
  { atlasId: 'Atlas1', text: 'HI', baseline: 100, opacity: 1, sampling: 'nearest', glyphs: [quad(0, 0), quad(48, 1)], extra: true },
]) {
  assert.throws(() => glyph.setLayout(bad), error => error.code === 'INVALID_SCENE');
  assert.equal(stringifySceneJSON(tree.snapshot()), first);
}
const duplicate = tree.createGlyphRun({ ...glyph.data });
assert.throws(() => team.addChild(duplicate), error => error.code === 'INVALID_SCENE');
assert.equal(stringifySceneJSON(tree.snapshot()), first);
const route = [];
glyph.onPointer('pointerdown', event => route.push(`target:${event.target.id}`));
team.onPointer('pointerdown', () => route.push('team'));
tree.stage.onPointer('pointerdown', () => route.push('stage'));
tree.dispatchPointer({ type: 'pointerdown', pointerId: 1, point: { x: 31, y: 44 }, hit: { id: 'Title', kind: 'glyphRun' } });
assert.deepEqual(route, ['target:Title', 'team', 'stage']);
assert.throws(() => tree.dispatchPointer({ type: 'pointerdown', pointerId: 1, point: { x: 31, y: 44 },
  hit: { id: 'Missing', kind: 'glyphRun' } }), error => error.code === 'INVALID_SCENE');
assert.equal(route.length, 3);
const stale = tree.createGlyphRun({ ...glyph.data, id: 'Stale' });
team.addChild(stale);
team.removeChild(stale);
assert.throws(() => tree.dispatchPointer({ type: 'pointerdown', pointerId: 1, point: { x: 31, y: 44 },
  hit: { id: 'Stale', kind: 'glyphRun' } }), error => error.code === 'INVALID_SCENE');
const foreignTree = createDisplayTree('ForeignProbe');
foreignTree.stage.addChild(foreignTree.createGlyphRun({ ...glyph.data, id: 'Foreign' }));
assert.throws(() => tree.dispatchPointer({ type: 'pointerdown', pointerId: 1, point: { x: 31, y: 44 },
  hit: { id: 'Foreign', kind: 'glyphRun' } }), error => error.code === 'INVALID_SCENE');
assert.equal(route.length, 3);
const reopened = createDisplayTreeFromScene(tree.snapshot());
assert.equal(reopened.get('Title').kind, 'glyphRun');
reopened.get('Title').setLayout({ atlasId: 'Atlas2', text: 'I', baseline: 100,
  opacity: 1, sampling: 'nearest', glyphs: [{ ...quad(0, 0), sourceRect: { x: 5, y: 0, width: 5, height: 7 } }] });
assert.equal(reopened.get('Title').data.text, 'I');
assert.equal(glyph.data.text, 'HI');
console.log('glyph-handle-probe: glyph/sprite tree, copied data, atomic refusal, pointer route, stale/foreign hits and reconstruction passed');

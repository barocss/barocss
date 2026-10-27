import test from 'node:test';
import assert from 'node:assert/strict';
import { GRADES, postOf } from '../src/viewport/post';

test('G15d.1: the post as the viewer takes it — nothing when neutral, the grade preset under contrast and saturation, the vignette', () => {
  assert.deepEqual(postOf(undefined), {});
  assert.deepEqual(postOf({ grade: 'neutral', contrast: 1, saturation: 1, vignette: 0 }), {});
  assert.deepEqual(postOf({ grade: 'neutral', contrast: 1.2, saturation: 1, vignette: 0 }), { grading: { contrast: 1.2, saturation: 1 } });
  const warm = postOf({ grade: 'warm', contrast: 1, saturation: 0.9, vignette: 0.4 });
  assert.deepEqual(warm.grading, { ...GRADES.warm, contrast: 1, saturation: 0.9 });
  assert.ok((GRADES.warm.temperature ?? 0) > 0 && (GRADES.cool.temperature ?? 0) < 0);
  assert.equal(warm.vignette?.amount, 0.4);
  assert.deepEqual(postOf({ grade: 'neutral', contrast: 1, saturation: 1, vignette: 0, bloom: 0.5 }), { bloom: { strength: 0.1 } });
});


test('G15d.3: Render focus and blur pass through without unit or pixel-ratio conversions; zero blur stays off', () => {
  const neutral = { grade: 'neutral' as const, contrast: 1, saturation: 1, vignette: 0 };
  assert.deepEqual(postOf({ ...neutral, depthOfField: { focus: 125.5, blur: 6 } }), { depthOfField: { focus: 125.5, blur: 6 } });
  assert.deepEqual(postOf({ ...neutral, depthOfField: { focus: 125.5, blur: 0 } }), {});
  assert.deepEqual(postOf({ ...neutral, bloom: 0.5, depthOfField: { focus: 125.5, blur: 24 } }), {
    bloom: { strength: 0.1 }, depthOfField: { focus: 125.5, blur: 24 },
  });
});

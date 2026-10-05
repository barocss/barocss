import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseScene, compileScene, GPU_LIMITS } from '../dist/index.js';
const source = '@scene demo { version: 0; sphere #ball; box #cube; } #ball { color: #f00; radius: 1; translate: -1 0 0; } #cube { size: 1 2 3; translate: 1 0 0; }';
test('deterministic fixed shaders use only numeric scene data', () => {
 const scene = parseScene(source); const shaders = compileScene(scene);
 assert.deepEqual(shaders, compileScene(scene));
 assert.match(shaders.vertex, /^#version 300 es/); assert.match(shaders.fragment, /step<128/);
 assert.match(shaders.fragment, /boxDistance/); assert.match(shaders.fragment, /length\(p-/);
 assert.ok(!shaders.fragment.includes('ball')); assert.ok(!shaders.fragment.includes(source));
 assert.ok(new TextEncoder().encode(shaders.fragment).length < GPU_LIMITS.maxShaderBytes);
});
test('empty scene and maximum bounded scene compile', () => {
 assert.match(compileScene(parseScene('@scene empty {version:0;}')).fragment, /background/);
 const scene = parseScene('@scene many {version:0;'+ Array.from({length:32},(_,i)=>`sphere #s${i};`).join('') + '}');
 assert.ok(compileScene(scene).fragment.length < GPU_LIMITS.maxShaderBytes);
});
test('structured consumers cannot inject GLSL or bypass geometry limits', () => {
 const scene = JSON.parse(JSON.stringify(parseScene(source)));
 for (const edit of [s=>s.objects[0].radius=NaN,s=>s.objects[0].radius=0,s=>s.objects[0].radius=1001,s=>s.objects[0].translate=[Infinity,0,0],s=>s.objects[0].size=[0,1,1],s=>s.objects[0].color=[-1,0,0],s=>s.objects[0].type='rawShader',s=>s.objects.push(s.objects[0]),s=>s.objects=Array(33).fill(s.objects[0]),s=>s.version=1]) {
  const copy=structuredClone(scene);edit(copy);assert.throws(()=>compileScene(copy));
 }
 const renamed=structuredClone(scene);renamed.objects[0].id='void main(){discard;}';
 assert.equal(compileScene(renamed).fragment, compileScene(scene).fragment);
});

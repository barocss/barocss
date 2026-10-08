import { readFileSync } from 'node:fs';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { BaroCADBabylonLoader } from '../dist/babylon.js';

const engine = new NullEngine();
const scene = new Scene(engine);
scene.useRightHandedSystem = true;
const loader = new BaroCADBabylonLoader(scene, {
  sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001,
});
const source = readFileSync(new URL('./two-surfaces.barocad', import.meta.url), 'utf8');
const result = loader.parse(source);
console.log(result.model.name, result.meshes.map(mesh => mesh.metadata.barocss.surfaceId));
result.dispose();
scene.dispose();
engine.dispose();

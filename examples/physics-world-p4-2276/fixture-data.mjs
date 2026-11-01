/** DATA setup only. The original fixture function remains the sole authority. */
import { fixture } from '../physics-rigid-contact-reference/fixtures.mjs';
const originalSin = Math.sin, originalCos = Math.cos;
let sinCalls = 0, cosCalls = 0;
Math.sin = value => { sinCalls++; return originalSin(value); };
Math.cos = value => { cosCalls++; return originalCos(value); };
try {
  const fixtures = Object.fromEntries(['ALIGNED', 'OFFSET', 'YAW'].map(scene => [scene, fixture(scene)]));
  process.stdout.write(JSON.stringify({ node: process.version, fixtureFunctionCalls: 3, sinCalls, cosCalls, fixtures }) + '\n');
} finally { Math.sin = originalSin; Math.cos = originalCos; }

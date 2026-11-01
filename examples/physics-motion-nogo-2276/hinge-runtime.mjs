/** Reconstructed historical scalar expression. No absent candidate or Physics runtime import. */
import { readFileSync } from 'node:fs';
import os from 'node:os';

const encoded = readFileSync(0);
if (encoded.length > 4096) throw new Error('Runtime input exceeds 4096 bytes');
const request = JSON.parse(encoded.toString('utf8'));
if (Object.keys(request).sort().join(',') !== 'postContactRawHex,version'
  || request.version !== 1 || typeof request.postContactRawHex !== 'string'
  || !/^[0-9a-f]{832}$/.test(request.postContactRawHex)) throw new Error('Invalid runtime input');
const bytes = Buffer.from(request.postContactRawHex, 'hex');
const bodies = Array.from({ length: 4 }, (_, body) => Array.from({ length: 13 },
  (_, field) => bytes.readDoubleLE(body * 104 + field * 8)));
if (bodies.flat().some(value => !Number.isFinite(value))) throw new Error('Nonfinite archived body');
const bits = value => { const buffer = Buffer.alloc(8); buffer.writeDoubleLE(value); return buffer.toString('hex'); };

// Exact operation order of pinned packages/barocss-physics/src/math.ts.
// This is a transcription for one scalar study, not execution of that package.
function multiply(a, b) {
  const [ax, ay, az, aw] = a, [bx, by, bz, bw] = b;
  return [aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz];
}
const pairs = [];
let atan2Calls = 0;
for (const pair of [0, 1]) {
  const a = bodies[2 * pair].slice(6, 10), b = bodies[2 * pair + 1].slice(6, 10);
  const relative = multiply(b, [-a[0], -a[1], -a[2], a[3]]);
  const y = relative.slice(0, 3).reduce((sum, value, i) => sum + value * [0, 0, 1][i], 0);
  const x = relative[3];
  if (!(x > 0 && y > 0 && y / x < 0.25)) throw new Error('Archived scalar is outside frozen domain');
  atan2Calls++;
  const scalar = Math.atan2(y, x);
  const raw = 2 * scalar;
  const wrapped = raw > Math.PI ? raw - 2 * Math.PI : raw < -Math.PI ? raw + 2 * Math.PI : raw;
  pairs.push({ pair, quaternionABits: a.map(bits), quaternionBBits: b.map(bits),
    relativeBits: relative.map(bits), yBits: bits(y), xBits: bits(x),
    atan2Bits: bits(scalar), doubledBits: bits(raw), targetBits: bits(Math.max(-0.8, Math.min(0.8, wrapped))) });
}
const output = JSON.stringify({ version: 1, kind: 'RECONSTRUCTED_HISTORICAL_SCALAR',
  candidateOperandsObserved: false, atan2Calls, pairs,
  runtime: { executable: process.execPath, node: process.version, versions: process.versions,
    architecture: process.arch, platform: process.platform, endianness: os.endianness(),
    osType: os.type(), osRelease: os.release(), osVersion: os.version(), machine: os.machine() },
  calls: { world: 0, projection: 0, motor: 0, free: 0, contact: 0, solve: 0, derive: 0 } }) + '\n';
if (Buffer.byteLength(output) > 65536) throw new Error('Runtime output exceeds 64 KiB');
process.stdout.write(output);

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { app, loadCad1301Consumer } from './cad-1301-runtime.mjs';

if (Number(process.versions.node.split('.')[0]) < 22) throw Error('Use Node22 or later for this bounded compiled consumer');
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--input')) throw Error('Usage: node apps/library-docs/scripts/run-cad-body-1301.mjs [--input <complete-request.json>]');
const inputPath = args.length ? resolve(args[1]) : resolve(app, 'samples/cad-1301/single.complete-body-request.json');
const bytes = await readFile(inputPath);
if (bytes.length > 2097152) throw Error('Complete request exceeds2MiB');
const hash = value => createHash('sha256').update(value).digest('hex');
const inputSha256 = hash(bytes);
const referenceSha256 = '765db84e9b59c22be65c741ef1607bcaa0a2f31fd5333dfe43fbdb17263b3683';
const { module, provenance } = await loadCad1301Consumer();
const result = module.runCadBodyRequest(bytes);
if (inputSha256 === referenceSha256) {
  if (bytes.length !== 677219 || JSON.stringify(result.topology) !== JSON.stringify({ vertices:8,edges:12,faces:6,uses:24,vertexLinks:8,euler:2 }) || JSON.stringify(result.modelObjectCounts) !== '[16,2]' || result.geometryObjects !== 18 || result.volumeMM3 !== 92.5 || result.exactVolumeMM3.numerator !== '185' || result.exactVolumeMM3.denominator !== '2' || result.inputNumericNegativeZeros !== 813) throw Error('Selected immutable sample result mismatch');
}
const after = await readFile(inputPath);
if (!bytes.equals(after) || hash(after) !== inputSha256) throw Error('Input changed during CLI execution');
console.log(JSON.stringify({
  profile: 'CAD1301 compiled public root; separate from5f live gallery',
  nodeVersion: process.version, provenance,
  input: { path: inputPath, bytes: bytes.length, sha256: inputSha256, bundledReference: inputSha256 === referenceSha256, bytesRetained: true },
  result,
}, null, 2));

import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { sha256 } from './flow-helper.mjs';

const output = process.argv[2];
const app = resolve(import.meta.dirname, '..');
const repo = resolve(app, '../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'), 'Use an external evidence directory');

const source = `
import { readStudioFile } from '../../packages/barocss-cad-model/src/engine/container';
import { cylinderPart, emptyDoc, rectanglePart, withNode } from '../../packages/barocss-cad-model/src/engine/doc';
import { evaluateDoc, stlFor } from '../../packages/barocss-cad-model/src/engine/evaluate';
import { evaluatedPart } from '../../packages/barocss-cad-model/src/engine/wireDoc';

const polar = (x, r, angle) => withNode(
  withNode(emptyDoc(), { kind: 'sketch', profile: 'circle', center: [x, 0], radius: r }),
  { kind: 'revolve', sketch: 0, axis: 'y', angle },
);
export const extra = {
  cylinder: cylinderPart(10, 8),
  'annular-cap': withNode(cylinderPart(10, 8), {
    kind: 'hole', parent: { node: 1, side: 'solid' }, center: [0, 0], radius: 9.9,
  }),
  'offset-hole': withNode(cylinderPart(10, 8), {
    kind: 'hole', parent: { node: 1, side: 'solid' }, center: [6.9, 0.2], radius: 3,
  }),
  'full-torus': polar(20, 5, 360),
  'partial-torus': polar(20, 5, 150),
  'thin-at-origin': rectanglePart(2, 2, 1/4096),
  'thin-at-z9999': withNode(
    withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [2, 2] }),
    { kind: 'extrude', sketch: 0, height: 1/4096, from: 9999 },
  ),
};
export async function classify(bytes) {
  const read = await readStudioFile(bytes);
  if ('error' in read) return { status: 'FILE_REFUSED', reason: read.error };
  const doc = evaluatedPart(read.doc);
  const evaluation = evaluateDoc(doc, 1);
  if (!evaluation.ok) return { status: 'EVALUATION_REFUSED', reason: evaluation.error };
  return {
    status: evaluation.bodies.length ? 'EVALUATED' : 'NO_ROOT_BODY',
    bodies: evaluation.bodies.map(body => {
      const result = { key: body.key, family: body.family, displayTriangles: body.mesh.indices.length / 3 };
      if (body.lumpTouch?.length) return { ...result, automatic: 'TOUCHING_SPLIT' };
      try {
        const stl = stlFor(doc, body.key);
        return { ...result, automatic: stl === null ? 'UNAVAILABLE' : 'BYTES', bytes: stl?.length ?? 0 };
      } catch (error) {
        return { ...result, automatic: 'ERROR', code: error.code ?? null, reason: error.message };
      }
    }),
  };
}
`;

const built = await build({
  stdin: { contents: source, resolveDir: app, sourcefile: 'stl-availability-scan.ts', loader: 'ts' },
  bundle: true, platform: 'node', format: 'esm', target: 'node22', write: false,
});
const { classify, extra } = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].contents).toString('base64')}`);
const rows = [];
const fixtures = join(import.meta.dirname, 'fixtures');
async function measure(label, bytes) {
  rows.push({ label, sha256: sha256(bytes), ...await classify(bytes) });
}
for (const name of (await readdir(fixtures)).filter(name => name.endsWith('.bcad')).sort()) {
  await measure(name, await readFile(join(fixtures, name)));
}
for (const [label, doc] of Object.entries(extra)) await measure(label, Buffer.from(JSON.stringify(doc)));

const report = { status: 'COMPLETE', scope: 'Source runner for the Automatic STL path. Studio qualification is separate.', rows };
await writeFile(join(output, 'stl-availability.json'), JSON.stringify(report, null, 2), { flag: 'wx' });
process.stdout.write(JSON.stringify({
  inputs: rows.length,
  admission: Object.fromEntries(Object.entries(Object.groupBy(rows, row => row.status)).map(([status, entries]) => [status, entries.length])),
  exports: Object.fromEntries(Object.entries(Object.groupBy(rows.flatMap(row => row.bodies ?? []), body => body.automatic)).map(([status, entries]) => [status, entries.length])),
}) + '\n');

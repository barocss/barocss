// Writes the DXF conformance files (conformance/r11b/<case>/expected.<version>.dxf) from each case's input with
// this kernel's writer, and, when DXF_ORACLE_PYTHON names a Python with ezdxf (see scripts/dxf-oracle.py), the
// oracle's reading of each (oracle.<version>.json). Run after a deliberate change to the writer's output:
//   pnpm build:library && DXF_ORACLE_PYTHON=~/.cache/barocss-ezdxf/bin/python node scripts/dxf-fixtures.mjs
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { writeDxf } from '../dist/index.js';
import { caseRuns } from '../test/dxf-cases.mjs';

const root = resolve(import.meta.dirname, '../conformance/r11b');
const python = process.env.DXF_ORACLE_PYTHON;
for (const name of readdirSync(root)) {
  const dir = join(root, name);
  if (!existsSync(join(dir, 'case.json'))) continue;
  const c = JSON.parse(readFileSync(join(dir, 'case.json'), 'utf8'));
  for (const run of caseRuns(c, dir)) {
    const file = join(dir, `expected.${run.options.version}.dxf`);
    writeFileSync(file, writeDxf(run.document, run.options).bytes);
    if (python) writeFileSync(join(dir, `oracle.${run.options.version}.json`), execFileSync(python, ['-I', resolve(import.meta.dirname, 'dxf-oracle.py'), file], { encoding: 'utf8' }));
    console.log(`${name} ${run.options.version}${python ? ' (+ oracle)' : ''}`);
  }
}

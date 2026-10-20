// Writes the flat-pattern DXF conformance files (conformance/r12/flat-dxf/<case>/expected.<version>.dxf) from each case's
// part document — its flat (R12.2, D117) through flatPatternDxf and the writer — and, when DXF_ORACLE_PYTHON names a
// Python with ezdxf (see scripts/dxf-oracle.py), the oracle's reading of each (oracle.<version>.json). Run after a
// deliberate change to the flat or its DXF:
//   pnpm build:library && DXF_ORACLE_PYTHON=~/.cache/barocss-ezdxf/bin/python node scripts/flat-dxf-fixtures.mjs
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { writeDxf } from '../dist/index.js';
import { flatDxfOfCase } from '../test/flat-dxf-cases.mjs';

const root = resolve(import.meta.dirname, '../conformance/r12/flat-dxf');
const python = process.env.DXF_ORACLE_PYTHON;
for (const name of readdirSync(root)) {
  const dir = join(root, name);
  if (!existsSync(join(dir, 'case.json'))) continue;
  const c = JSON.parse(readFileSync(join(dir, 'case.json'), 'utf8')), doc = flatDxfOfCase(c);
  for (const version of c.input.versions) {
    const file = join(dir, `expected.${version}.dxf`);
    writeFileSync(file, writeDxf(doc, { version }).bytes);
    if (python) writeFileSync(join(dir, `oracle.${version}.json`), execFileSync(python, ['-I', resolve(import.meta.dirname, 'dxf-oracle.py'), file], { encoding: 'utf8' }));
    console.log(`${name} ${version}${python ? ' (+ oracle)' : ''}`);
  }
}

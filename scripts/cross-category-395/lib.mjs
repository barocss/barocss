// #395 shared loaders: kit + @barocss/server (built CJS) and Tailwind 4.3.3 compile.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '../..');
const require = createRequire(path.join(ROOT, 'packages/barocss-server/package.json'));
// kit's package exports point at src/*.ts; alias '@barocss/kit' to its built CJS for plain node.
const Module = require('node:module');
const kitCjs = path.join(ROOT, 'packages/barocss/dist/index.cjs');
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (req, ...a) { return req === '@barocss/kit' ? kitCjs : origResolve.call(this, req, ...a); };
export const { ServerRuntime } = require('./dist/index.cjs');
export const kit = require(kitCjs);

const rootReq = createRequire(path.join(ROOT, 'package.json'));
const { compile } = rootReq('tailwindcss');
const twDir = path.dirname(rootReq.resolve('tailwindcss/package.json'));
export async function tailwindCss(classes) {
  const c = await compile('@import "tailwindcss";', {
    base: twDir,
    loadStylesheet: async (id, base) => {
      const p = id === 'tailwindcss' ? path.join(twDir, 'index.css') : path.join(twDir, id.replace(/^tailwindcss\//, ''));
      return { path: p, base: path.dirname(p), content: fs.readFileSync(p, 'utf8') };
    },
  });
  return c.build(classes);
}

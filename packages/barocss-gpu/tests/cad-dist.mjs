// The tests' @barocss/cad (G18): CAD's built entry, as a consumer of the packed package gets it — the GPU bundle keeps
// CAD external (REVIEW G9), and in the workspace its name resolves to CAD's TypeScript sources, which Node does not
// load. `node --import ./tests/cad-dist.mjs --test …` (package.json's test scripts); `pnpm build:library` in
// packages/barocss-cad first.
import { registerHooks } from 'node:module';

const entry = new URL('../../barocss-cad/dist/index.js', import.meta.url).href;
registerHooks({
  resolve(specifier, context, next) {
    return specifier === '@barocss/cad' ? { url: entry, shortCircuit: true } : next(specifier, context);
  },
});

// Resolve hook: map `@barocss/kit` to the built kit dist so the built server bundle runs under plain node.
// Usage: node --import ./scripts/fuzz/kit-dist-loader.mjs <script>
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const kitDist = pathToFileURL(fileURLToPath(new URL('../../packages/barocss/dist/index.js', import.meta.url))).href;
register('data:text/javascript,' + encodeURIComponent(
  `export async function resolve(s,c,n){ if(s==='@barocss/kit') return {url:${JSON.stringify(kitDist)},shortCircuit:true}; return n(s,c); }`));

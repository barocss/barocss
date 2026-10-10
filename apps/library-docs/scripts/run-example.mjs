import { resolve } from 'node:path';
import { bundleExample, pin } from './example-runtime.mjs';
if(!process.argv[2]) throw Error('Usage: node apps/library-docs/scripts/run-example.mjs <input.ts>');
const {result,inputs,provenance} = await bundleExample(resolve(process.argv[2]),'node');
await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
console.log(JSON.stringify(provenance || {sourcePin:pin,ownSourceInputs:inputs.length,ownDistInputs:0}));

import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { app, bundleExample } from './example-runtime.mjs';
import { visualEntry } from './gallery-input.mjs';
const { result, provenance } = await bundleExample(await visualEntry());
const directory = resolve(app, 'docs/.vitepress/generated');
await mkdir(directory, { recursive: true });
await writeFile(resolve(directory, 'visual.js'), result.outputFiles[0].contents);
console.log(JSON.stringify({ ...provenance, bundleBytes: result.outputFiles[0].contents.length }));

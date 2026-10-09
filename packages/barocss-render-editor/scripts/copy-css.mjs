import {copyFile} from 'node:fs/promises';
await copyFile(new URL('../src/style.css', import.meta.url), new URL('../dist/style.css', import.meta.url));

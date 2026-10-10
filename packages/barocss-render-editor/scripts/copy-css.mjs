import {copyFile} from 'node:fs/promises';
await copyFile(new URL('../src/style.css', import.meta.url), new URL('../dist/style.css', import.meta.url));
await copyFile(new URL('../src/source-studio-layout.css', import.meta.url), new URL('../dist/source-studio-layout.css', import.meta.url));

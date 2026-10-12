import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const repo = resolve(import.meta.dirname, '../..');
// The explicit compiled checkpoint supplies every transitive native public entry.
const compiledMap = process.env.CAD_EDITOR_COMPILED_MAP;
const aliases: { find: string; replacement: string }[] = compiledMap
  ? Object.entries(JSON.parse(readFileSync(compiledMap, 'utf8')) as Record<string, string>).map(([find, replacement]) => ({ find, replacement }))
  : [];
aliases.sort((a, b) => b.find.length - a.find.length);
export default defineConfig({
  worker: { format: 'es' },
  plugins: [tailwindcss()],
  resolve: { alias: aliases },
  server: { host: '127.0.0.1', port: 52010, strictPort: true, fs: { allow: [repo, ...(compiledMap ? Object.values(JSON.parse(readFileSync(compiledMap, 'utf8'))) as string[] : [])] } },
  build: { target: 'es2022', outDir: 'dist' },
});

#!/usr/bin/env node
// P1-L3's live AI run on Codex: see server/liveRun/codexRun.ts. Bundles the run and the MCP tool server (cad-mcp on a
// .bcad, server/cadDoc.ts) from the sources, once for the series, so every run talks to the same server build.
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const out = mkdtempSync(join(tmpdir(), 'cad-live-run-build-'));
await build({ entryPoints: { main: join(root, 'server/liveRun/codexRun.ts'), cadDoc: join(root, 'server/cadDoc.ts') }, outdir: out, bundle: true, platform: 'node', format: 'esm', target: 'node22', outExtension: { '.js': '.mjs' }, logLevel: 'warning' });
await build({ stdin: { contents: `import { mcpMain } from ${JSON.stringify(join(out, 'cadDoc.mjs'))};\nprocess.exit(await mcpMain(process.argv.slice(2)));\n`, resolveDir: out, loader: 'js' }, outfile: join(out, 'cad-mcp.mjs'), bundle: false, platform: 'node', format: 'esm', logLevel: 'warning' });
const { liveRunMain } = await import(pathToFileURL(join(out, 'main.mjs')).href);
const code = await liveRunMain(process.argv.slice(2), { mcpScript: join(out, 'cad-mcp.mjs'), scripted: join(root, 'test/fixtures/scripted-codex.mjs') });
rmSync(out, { recursive: true, force: true });
process.exit(code);

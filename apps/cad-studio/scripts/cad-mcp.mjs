#!/usr/bin/env node
// The external MCP server (A5.4): the studio's CAD tools over stdio on one local .bcad file (server/cadDoc.ts).
//   node apps/cad-studio/scripts/cad-mcp.mjs --doc part.bcad [--autonomy 1-4] [--libraries dir]
// In an MCP client's config: {"command": "node", "args": ["<repo>/apps/cad-studio/scripts/cad-mcp.mjs", "--doc", "<abs>/part.bcad"]}.
// (Bundled from the TypeScript sources at start, as the chat server is; stdout carries only the protocol.)
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const out = mkdtempSync(join(tmpdir(), 'cad-mcp-'));
await build({ entryPoints: { cadDoc: join(root, 'server/cadDoc.ts') }, outdir: out, bundle: true, platform: 'node', format: 'esm', target: 'node22', outExtension: { '.js': '.mjs' }, logLevel: 'warning' });
const { mcpMain } = await import(pathToFileURL(join(out, 'cadDoc.mjs')).href);
const code = await mcpMain(process.argv.slice(2));
rmSync(out, { recursive: true, force: true });
process.exit(code);

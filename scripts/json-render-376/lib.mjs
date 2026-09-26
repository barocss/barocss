// #376 shared helpers: bundling against the scratch installs (scratch/{jr,a2}/node_modules, see NOTES.md).
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '../..');
export const SCR = path.join(HERE, 'scratch');
const rreq = createRequire(path.join(ROOT, 'package.json'));
export const esbuild = rreq('esbuild');

export async function bundle(entry, which, out, opts = {}) {
  await esbuild.build({
    entryPoints: [path.join(HERE, entry)], outfile: out, bundle: true, format: opts.format || 'iife',
    platform: opts.platform || 'browser', alias: opts.platform === 'node' ? {} : Object.fromEntries(['react', 'react-dom'].map((m) => [m, path.join(SCR, which, 'node_modules', m)])), nodePaths: [path.join(SCR, which, 'node_modules')], jsx: 'automatic',
    loader: { '.css': 'text' }, define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'error', minify: false,
  });
  return out;
}

// Import jr-catalog.mjs in node (bundled with the scratch json-render install).
export async function jrCatalog() {
  const out = path.join(SCR, 'jr-catalog.node.mjs');
  await bundle('jr-catalog.mjs', 'jr', out, { format: 'esm', platform: 'node' });
  return (await import(pathToFileURL(out).href)).catalog;
}

export const REQS = {
  'dashboard-card': 'a dashboard KPI card: title "Monthly revenue", the value $48,210, a trend "+12.5% vs last month", a progress bar toward a $60,000 goal (80%), and a "View report" button',
  'settings-form': 'a notification settings form: "Full name" and "Email" text fields, two toggles ("Email notifications" on, "Weekly digest" off), a "Plan" select (Free, Pro, Team), and "Save changes" and "Cancel" buttons',
  pricing: 'a pricing section with three tiers side by side: Starter $0, Pro $19/month (highlighted, "Most popular"), Team $49/month; each tier lists 3 features and has a call-to-action button',
  'data-table': 'an orders data table with a header row (title "Recent orders" and an "Export" button) and columns Order, Customer, Status, Amount; 4 rows; Status is shown as colored badges (Paid, Pending, Refunded)',
  'empty-state': 'an empty state for a projects page: an icon, the heading "No projects yet", one sentence of description, a primary "Create project" button and a secondary "Import" button, all centered',
  hero: 'a marketing hero section for a product: a small badge "New: v2.0", a large headline, a one-sentence subheading, two buttons ("Get started" primary and "Learn more" outline), and a line "Trusted by 2,000+ teams", centered',
};
export const FORMATS = ['json-render', 'a2ui', 'companion', 'native'];
export const MODELS = ['opus', 'haiku'];
export const readJSON = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

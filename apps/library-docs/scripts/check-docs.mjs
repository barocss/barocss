import { checkExampleCatalog } from './check-example-catalog.mjs';
import { repairSourceLinks } from './source-links.mjs';
import { readFile, readdir, access } from 'node:fs/promises';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkCurrentInventory, retiredSlugs } from './inventory.mjs';
const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(app, '../..');
const docs = resolve(app, 'docs');
const inventory = JSON.parse(await readFile(resolve(app, 'evidence/package-inventory.json'), 'utf8'));
const currentInventory = await checkCurrentInventory(root, app);
const pages = [];
async function walk(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    if (item.name.startsWith('.')) continue;
    const path = resolve(directory, item.name);
    if (item.isDirectory()) await walk(path);
    else if (extname(path) === '.md') pages.push(path);
  }
}
await walk(docs);
for (const p of inventory.packages.filter(p => !retiredSlugs.includes(p.slug))) {
  const required = ['index', ...( ['kit','browser','server'].includes(p.slug) ? [] : ['quickstart','guides','api','reference','examples','limits'])];
  for (const name of required) {
    const text = await readFile(resolve(docs, 'packages', p.slug, `${name}.md`), 'utf8');
    if (!text.replace(/^---[\s\S]*?---\s*/, '').startsWith('# ') || text.length < 350) throw new Error(`Missing substantive page: ${p.slug}/${name}`);
  }
}
let links = 0, assets = 0, downloads = 0;
const builtAnchors = new Map();
for (const page of pages) {
  const text = (await readFile(page, 'utf8')).replace(/```[\s\S]*?```/g, '');
  // JSON/CSS downloads use native anchors; verify their built bytes match the source.
  for (const match of text.matchAll(/<a\b[^>]*\s(?::href="withBase\('([^'?#]+\.(?:json|css))'\)"|href="([^"?#]+\.(?:json|css))")[^>]*>/g)) {
    const href = match[1] || match[2];
    if (!href.startsWith('/examples/'))
      throw new Error(`Unexpected JSON/CSS download: ${href}`);
    const source = resolve(docs, 'public', `.${href}`);
    const built = resolve(docs, '.vitepress/dist', `.${href}`);
    const [sourceBytes, builtBytes] = await Promise.all([readFile(source), readFile(built)]);
    if (!sourceBytes.equals(builtBytes)) throw new Error(`Built example download changed: ${href}`);
    downloads++;
  }
  for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
    const href = match[1];
    if (href.startsWith(`https://github.com/barocss/barocss/blob/${inventory.commit}/`)) {
      const sourcePath = href.split(`/blob/${inventory.commit}/`)[1].split('#')[0];
      await access(resolve(root, sourcePath)).catch(() => { throw new Error(`Missing source reference: ${href}`); });
    }
    if (/^(https?:|mailto:)/.test(href)) continue;
    const [path, anchor] = href.split('#');
    if (path && /\.(png|jpg|svg|webp)$/.test(path)) {
      const asset = path.startsWith('/') ? resolve(docs, 'public', `.${path}`) : resolve(dirname(page), path);
      await access(asset).catch(() => { throw new Error(`Missing image ${href} in ${page}`); });
      if (path.startsWith('/')) await access(resolve(docs, '.vitepress/dist', `.${path}`));
      assets++; continue;
    }
    let target = path ? (path.startsWith('/') ? resolve(docs, `.${path}`) : resolve(dirname(page), path)) : page;
    if (!target.endsWith('.md')) {
      try { await access(target + '.md'); target += '.md'; }
      catch { target = resolve(target, 'index.md'); }
    }
    await access(target).catch(() => { throw new Error(`Broken link ${href} in ${page}`); });
    if (anchor) {
      const htmlPath = target.replace(docs, resolve(docs, '.vitepress/dist')).replace(/\.md$/, '.html');
      if (!builtAnchors.has(htmlPath)) {
        const html = await readFile(htmlPath, 'utf8');
        builtAnchors.set(htmlPath, new Set([...html.matchAll(/id="([^"]+)"/g)].map(match => match[1])));
      }
      if (!builtAnchors.get(htmlPath).has(decodeURIComponent(anchor))) throw new Error(`Missing built anchor: ${href}`);
    }
    links++;
  }
}
await repairSourceLinks(JSON.parse(await readFile(resolve(app, 'evidence/public-api.json'), 'utf8')), { check: true });
const exampleCatalog = await checkExampleCatalog(app);
console.log(JSON.stringify({ exampleCatalog, pages: pages.length, packages: currentInventory.packages.length, checkedInternalLinks: links, checkedImageAssets: assets, checkedDownloadAssets: downloads, manifestHashes: 'matched', sourceCommit: inventory.commit, manifestCommit: currentInventory.manifestCommit }));

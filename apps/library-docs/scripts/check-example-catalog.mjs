import { readFile, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { exampleCatalog, exampleHref } from '../docs/.vitepress/example-catalog.mjs';

const defaultApp = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const modules = ['visual', 'advanced-shader', 'reusable-shader', 'cad-quantity-functions', 'discrete-material', 'viewer-display-pose', 'cad-adaptive-sampling', 'generated-scene'];
const galleryFiles = ['cad', 'scene', 'materials', 'viewer', 'physics', 'cad-language', 'gpu-compositions'];
const standaloneFiles = ['advanced-shader', 'caustics-shader', 'weave-shader', 'contour-shader', 'halftone-shader', 'reusable-shader', 'cad-quantity-functions', 'discrete-material', 'viewer-display-pose', 'cad-adaptive-sampling', 'generated-scene'];
const libraries = new Set(['cad', 'gpu', 'viewer', 'physics']);
const categories = new Set(['api', 'language', 'integration']);
const fields = new Set(['label', 'anchor', 'library', 'category', 'guide', 'summary', 'libraries', 'language']);
const require = (condition, message) => { if (!condition) throw new Error(`Example catalog: ${message}`); };

/** Read preset metadata only. No factory, compiler, renderer or evaluator runs. */
export async function checkExampleCatalog(app = defaultApp, { built = true } = {}) {
  const docs = resolve(app, 'docs');
  const runtime = {};
  for (const name of modules) {
    const url = pathToFileURL(resolve(docs, '.vitepress/generated', `${name}.js`));
    const loaded = await import(url.href);
    require(loaded.presets && typeof loaded.presets === 'object', `missing ${name} preset table`);
    for (const [key, preset] of Object.entries(loaded.presets)) {
      require(!Object.hasOwn(runtime, key), `duplicate runtime key ${key}`);
      runtime[key] = preset;
    }
  }
  const keys = Object.keys(exampleCatalog), runtimeKeys = Object.keys(runtime);
  require(keys.length === 38 && runtimeKeys.length === 38, 'expected the 38 current presets');
  require(keys.every(key => Object.hasOwn(runtime, key)) && runtimeKeys.every(key => Object.hasOwn(exampleCatalog, key)), 'runtime/catalog coverage differs');

  const authored = {};
  for (const name of galleryFiles) {
    const data = JSON.parse(await readFile(resolve(app, `scripts/snippets/presets/${name}.json`), 'utf8'));
    for (const [key, preset] of Object.entries(data)) {
      require(!Object.hasOwn(authored, key), `duplicate authored key ${key}`);
      authored[key] = preset;
    }
  }
  for (const name of standaloneFiles) {
    require(!Object.hasOwn(authored, name), `duplicate standalone key ${name}`);
    authored[name] = JSON.parse(await readFile(resolve(app, `scripts/snippets/${name}.json`), 'utf8'));
  }
  const visualSource = await readFile(resolve(app, 'scripts/snippets/visual.mjs'), 'utf8');
  const builtinKeys = [];
  for (const match of visualSource.matchAll(/\b(scene|curve|surface|material):\s*\{[^\n]*source:\s*`([\s\S]*?)`/g)) {
    const [, key, source] = match;
    require(!builtinKeys.includes(key), `duplicate builtin source ${key}`);
    // These four reviewed literals contain no JS escapes or interpolation.
    require(!source.includes('\\') && !source.includes('${'), `builtin ${key} needs an updated literal reader`);
    require(runtime[key]?.source === source.replace(/\r\n?/g, '\n'), `builtin ${key} source differs from generated data`);
    builtinKeys.push(key);
  }
  require(builtinKeys.length === 4, 'expected four original visual source literals');
  require(Object.keys(authored).length + builtinKeys.length === 38, 'authored source coverage differs');
  for (const [key, preset] of Object.entries(authored)) {
    require(Object.hasOwn(runtime, key), `authored preset missing at runtime: ${key}`);
    require(runtime[key].source === preset.source, `generated source differs: ${key}`);
    const label = preset.targetFunction ? `${preset.targetFunction}()` : preset.label;
    require(runtime[key].label === label, `generated label differs from source: ${key}`);
    require(runtime[key].anchor === (preset.anchor || key), `generated anchor differs from source: ${key}`);
  }

  const anchors = new Set(), counts = { api: 0, language: 0, integration: 0 };
  const htmlCache = new Map();
  async function page(route) {
    const path = resolve(docs, `.${route}.md`);
    await access(path).catch(() => { throw new Error(`Example catalog: missing guide/route ${route}`); });
    return path;
  }
  async function builtAnchor(route, anchor) {
    if (!built) return;
    const path = resolve(docs, '.vitepress/dist', `.${route}.html`);
    if (!htmlCache.has(path)) {
      const html = await readFile(path, 'utf8');
      const ids = new Map();
      for (const match of html.matchAll(/\bid="([^"]+)"/g)) ids.set(match[1], (ids.get(match[1]) || 0) + 1);
      htmlCache.set(path, ids);
    }
    require(htmlCache.get(path).get(anchor) === 1, `built anchor must occur once: ${route}#${anchor}`);
  }
  for (const key of keys) {
    const entry = exampleCatalog[key], preset = runtime[key];
    require(/^[a-z][a-z0-9-]*$/.test(key), `invalid key ${key}`);
    require(Object.keys(entry).every(field => fields.has(field)), `unexpected schema field: ${key}`);
    for (const field of ['label', 'anchor', 'library', 'category', 'guide', 'summary']) {
      require(typeof entry[field] === 'string' && entry[field].trim().length > 0, `missing ${field}: ${key}`);
    }
    require(entry.label === preset.label && entry.anchor === preset.anchor, `runtime label/anchor differs: ${key}`);
    require(/^[a-z][a-z0-9-]*$/.test(entry.anchor) && !anchors.has(entry.anchor), `invalid/duplicate anchor: ${key}`);
    anchors.add(entry.anchor);
    require(libraries.has(entry.library) && categories.has(entry.category), `invalid library/category: ${key}`);
    if (entry.libraries !== undefined) {
      require(Array.isArray(entry.libraries) && entry.libraries.length >= 2 &&
        new Set(entry.libraries).size === entry.libraries.length && entry.libraries.includes(entry.library) &&
        entry.libraries.every(library => libraries.has(library)), `invalid libraries: ${key}`);
    }
    if (entry.language !== undefined) require(typeof entry.language === 'string' && entry.language.length > 0, `invalid language: ${key}`);
    require(/^\/packages\/[a-z0-9-]+\/[a-z0-9-]+(?:#[a-z0-9-]+)?$/.test(entry.guide), `invalid guide: ${key}`);
    const [guideRoute, guideAnchor] = entry.guide.split('#');
    await page(guideRoute);
    if (guideAnchor) await builtAnchor(guideRoute, guideAnchor);
    const expectedRoute = `/examples/${entry.category === 'api' ? 'library' : entry.category}`;
    require(exampleHref(key) === `${expectedRoute}#${entry.anchor}`, `href differs: ${key}`);
    await page(expectedRoute);
    await builtAnchor(expectedRoute, entry.anchor);
    await builtAnchor('/playground', entry.anchor);
    counts[entry.category]++;
  }
  return { presets: keys.length, uniqueAnchors: anchors.size, authoredSources: 38, categories: counts,
    generatedModules: modules.length, builtAnchorsChecked: built, execution: 'Preset metadata and links only; no public API calls or gallery execution' };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await checkExampleCatalog()));
}

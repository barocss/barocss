import { defineConfig } from 'vitepress'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { buildAdvancedShader } from '../../scripts/build-advanced-shader.mjs'
import { buildReusableShader } from '../../scripts/build-reusable-shader.mjs'
import { buildCadQuantityFunctions } from '../../scripts/build-cad-quantity-functions.mjs'
import { buildDiscreteMaterial } from '../../scripts/build-discrete-material.mjs'
import { buildUnicodeLabel } from '../../scripts/build-unicode-label.mjs'
import { buildDiagramLabel } from '../../scripts/build-diagram-label.mjs'
import { buildPathEdit } from '../../scripts/build-path-edit.mjs'
import { buildSvgExport } from '../../scripts/build-svg-export.mjs'
import { buildViewerDisplayPose } from '../../scripts/build-viewer-display-pose.mjs'
import { buildCadAdaptiveSampling } from '../../scripts/build-cad-adaptive-sampling.mjs'
import { buildGeneratedScene } from '../../scripts/build-generated-scene.mjs'
import { buildSvgArcImport } from '../../scripts/build-svg-arc-import.mjs'
import { buildRadialSvgExport } from '../../scripts/build-radial-svg-export.mjs'
import { buildMaterialBench } from '../../scripts/build-material-bench.mjs'
// Root hosting by default; GitHub project Pages uses BAROCSS_DOCS_BASE=/manual/.
const base = process.env.BAROCSS_DOCS_BASE || '/'
if (!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(base)) {
  throw new Error('BAROCSS_DOCS_BASE must be / or a slash-delimited path such as /manual/')
}
const appRoot = fileURLToPath(new URL('../../', import.meta.url))
await Promise.all([buildAdvancedShader(appRoot), buildUnicodeLabel(appRoot), buildDiagramLabel(appRoot), buildPathEdit(appRoot), buildSvgExport(appRoot), buildRadialSvgExport(appRoot), buildReusableShader(appRoot), buildCadQuantityFunctions(appRoot), buildDiscreteMaterial(appRoot), buildSvgArcImport(appRoot), buildViewerDisplayPose(appRoot), buildCadAdaptiveSampling(appRoot), buildGeneratedScene(appRoot), buildMaterialBench(appRoot)])
const packages = ['kit', 'browser', 'server', 'render', 'gpu', 'cad', 'cad-interop', 'canvas2d', 'viewer', 'physics', 'cad-editor', 'render-editor']
const names = { 'cad-interop': 'CAD Interop (Loader)', 'cad-editor': 'CAD Editor', 'render-editor': 'Render Editor', canvas2d: 'Canvas2D', gpu: 'GPU', cad: 'CAD' }
const common = [
  { text: 'Use the examples', link: '/concepts/run-examples' },
  { text: 'Example catalog', link: '/examples/' },
  { text: 'Run visual examples', link: '/playground' },
  { text: 'Library catalog', link: '/packages/' },
  { text: 'Coordinates and units', link: '/concepts/coordinates' },
  { text: 'IDs and ownership', link: '/concepts/ownership' },
  { text: 'Versions and availability', link: '/concepts/versions' }
]
const catalog = { text: 'Packages', items: packages.map(p => ({ text: names[p] || p[0].toUpperCase() + p.slice(1), link: `/packages/${p}/` })) }
const sidebar = Object.fromEntries(packages.map(p => [`/packages/${p}/`, [
  { text: names[p] || p[0].toUpperCase() + p.slice(1), items: [
    { text: 'Overview', link: `/packages/${p}/` },
    ...(packages.indexOf(p) < 3 ? [] : ['quickstart', ...(p === 'cad' ? ['modeling'] : []), ...(p === 'cad-editor' ? ['first-model', 'round-post'] : []), 'guides', ...(p === 'cad' || p === 'gpu' ? ['language'] : []), ...(p === 'cad' ? ['language-workflows', 'language-examples', 'rational-surface', 'line-width-extrusion', 'line-width-extrusion-graph', 'quantity-functions', 'curve-knot-insertion', 'surface-knot-insertion', 'adaptive-curve-sampling', 'capabilities', 'exact-prism-modeling', 'serial-part-v2', 'body-1301', 'body-boundary-mesh', 'paired-roof-body-split', 'nurbs-loft-graph'] : []), ...(p === 'viewer' ? ['display-pose', 'authored-directional-lights'] : []), ...(p === 'cad-interop' ? ['loft-graph-ingestion'] : []), ...(p === 'gpu' ? ['advanced-shader', 'caustics-shader', 'weave-shader', 'contour-shader', 'halftone-shader', 'reusable-shader', 'discrete-material', 'generated-scene', 'composition-examples', 'material-language', 'function-examples', 'cpu-material-evaluation'] : []), ...(p === 'canvas2d' ? ['unicode-labels', 'diagram-labels', 'path-editing', 'svg-export', 'radial-svg-export', 'svg-arc-import'] : []), 'api', 'examples', 'limits'].map(page => ({ text: { 'surface-knot-insertion': 'Surface control-net refinement', 'adaptive-curve-sampling': 'Adaptive Curve display', capabilities: 'Supported shapes and edit chains', 'modeling': 'Model a part', 'first-model': 'First model in the UI', 'round-post': 'Create a round post', 'exact-prism-modeling': 'Archive: exact-prism workflow', 'serial-part-v2': 'Archive: serial-part v2', 'display-pose': 'Native points and display pose', 'authored-directional-lights': 'Authored directional lights', 'generated-scene': 'Typed Scene generation', 'discrete-material': 'Discrete threshold palette', 'curve-knot-insertion': 'Curve knot refinement', 'quantity-functions': 'Quantity functions', 'line-width-extrusion-graph': 'Line width dependency graph', 'reusable-shader': 'Reusable material functions', 'radial-svg-export': 'Radial SVG export', 'svg-arc-import': 'Import and edit SVG arcs', 'weave-shader': 'Woven grid shader', 'contour-shader': 'Contour bands shader', 'halftone-shader': 'Halftone dots shader', 'line-width-extrusion': 'Line width and direct extrusion', 'rational-surface': 'Rational surface weights', 'svg-export': 'Export SVG and editable JSON', 'path-editing': 'Edit path controls', 'diagram-labels': 'Diagram labels', 'unicode-labels': 'Unicode labels', language: p === 'cad' ? 'Advanced text language' : 'Language reference', 'language-workflows': 'Archive: Source0–3 programs', 'language-examples': 'Language practice', 'caustics-shader': 'Interference caustics', 'advanced-shader': 'Procedural shader lab', 'composition-examples': 'Scene and material compositions', 'nurbs-loft-graph': 'Edit sections and a Loft', 'loft-graph-ingestion': 'Read Loft graphs and updates', 'body-1301': 'Body and topology', 'body-boundary-mesh': 'Body boundary mesh', 'paired-roof-body-split': 'Split a paired-roof Body', 'cpu-material-evaluation': 'CPU material color', 'material-language': 'Material language', 'function-examples': 'Material function examples', quickstart: 'Quickstart', guides: 'Guides', api: 'API reference', examples: 'Examples', limits: 'Limits and lifecycle' }[page], link: `/packages/${p}/${page}` })))
  ] }, { text: 'Shared concepts', items: common }, catalog
]]))
export default defineConfig({
  base,
  title: 'BaroCSS Libraries',
  description: 'Task guides and public API contracts for the BaroCSS library family.',
  lang: 'en-US',
  cleanUrls: true,
  vite: { plugins: [{ name: 'library-docs-linked-search-css', configureServer(server) {
    const css = createRequire(import.meta.url).resolve('@docsearch/css')
    if (!server.config.server.fs.allow.includes(css)) server.config.server.fs.allow.push(css)
  } }] },
  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: `${base}favicon.svg` }]],
  lastUpdated: false,
  themeConfig: {
    siteTitle: 'BaroCSS Libraries',
    nav: [ { text: 'Examples', link: '/examples/' }, { text: 'Libraries', link: '/packages/' }, { text: 'Concepts', link: '/concepts/coordinates' }, { text: 'Package', items: catalog.items }, { text: 'CSS docs', link: 'https://barocss.com/guide/' } ],
    sidebar: { ...sidebar, '/packages/': [catalog, { text: 'Shared concepts', items: common }], '/concepts/': [{ text: 'Shared concepts', items: common }, catalog], '/examples/': [{ text: 'Examples', items: [{ text: 'Catalog', link: '/examples/' }, { text: 'By library', link: '/examples/library' }, { text: 'Language practice', link: '/examples/language' }, { text: 'Integrated workflows', link: '/examples/integration' }, { text: 'Original playground', link: '/playground' }] }, catalog] },
    search: { provider: 'local' },
    outline: { level: [2, 3] },
    socialLinks: [{ icon: 'github', link: 'https://github.com/barocss/barocss' }],
    footer: { message: 'Local manual snapshot. Availability is stated on each package page.', copyright: 'BaroCSS · Source, native build, local integration and publication are separate stages.' }
  }
})

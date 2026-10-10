import { defineConfig } from 'vitepress'
const packages = ['kit', 'browser', 'server', 'render', 'gpu', 'cad', 'cad-interop', 'canvas2d', 'viewer', 'physics', 'cad-editor', 'render-editor']
const names = { 'cad-interop': 'CAD Interop (Loader)', 'cad-editor': 'CAD Editor', 'render-editor': 'Render Editor', canvas2d: 'Canvas2D', gpu: 'GPU', cad: 'CAD' }
const common = [
  { text: 'Run the examples', link: '/concepts/run-examples' },
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
    ...(packages.indexOf(p) < 3 ? [] : ['quickstart', 'guides', ...(p === 'cad' || p === 'gpu' ? ['language'] : []), ...(p === 'gpu' ? ['material-language'] : []), 'api', 'reference', 'examples', 'limits'].map(page => ({ text: { language: 'Language reference', 'material-language': 'Material language', quickstart: 'Quickstart', guides: 'Guides', api: 'API reference', reference: 'Public signatures', examples: 'Examples', limits: 'Limits and lifecycle' }[page], link: `/packages/${p}/${page}` })))
  ] }, { text: 'Shared concepts', items: common }, catalog
]]))
export default defineConfig({
  title: 'BaroCSS Libraries',
  description: 'Task guides and public API contracts for the BaroCSS library family.',
  lang: 'en-US',
  cleanUrls: true,
  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }]],
  lastUpdated: false,
  themeConfig: {
    siteTitle: 'BaroCSS Libraries',
    nav: [ { text: 'Run examples', link: '/playground' }, { text: 'Libraries', link: '/packages/' }, { text: 'Concepts', link: '/concepts/coordinates' }, { text: 'Package', items: catalog.items }, { text: 'CSS docs', link: 'https://barocss.com/guide/' } ],
    sidebar: { ...sidebar, '/packages/': [catalog, { text: 'Shared concepts', items: common }], '/concepts/': [{ text: 'Shared concepts', items: common }, catalog] },
    search: { provider: 'local' },
    outline: { level: [2, 3] },
    socialLinks: [{ icon: 'github', link: 'https://github.com/barocss/barocss' }],
    footer: { message: 'Local manual snapshot. Availability is stated on each package page.', copyright: 'BaroCSS · Source, native build, local integration and publication are separate stages.' }
  }
})

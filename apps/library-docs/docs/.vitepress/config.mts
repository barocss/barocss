import { defineConfig } from 'vitepress';
import { sidebar } from './sidebar.mjs';

// The BaroCSS CAD documentation (W0, 2026-10-23): rewritten from scratch for the CAD stack as it is now — the studio,
// the AI agent, @barocss/cad, @barocss/cad-model and @barocss/gpu. Its structure is sidebar.mjs.
export default defineConfig({
  title: 'BaroCSS CAD',
  description: 'Design manufacturable products with an AI agent: a B-rep CAD kernel, a document model and a GPU studio, in TypeScript.',
  cleanUrls: true,
  // (`_*.md` are parts a page includes, such as the generated tool tables: not pages of their own.)
  srcExclude: ['**/_*.md'],
  lastUpdated: true,
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Studio', link: '/studio/tour' },
      { text: 'Agent', link: '/agent/' },
      { text: 'Packages', link: '/packages/cad/' },
      { text: 'Reference', link: '/reference/refusals' },
    ],
    sidebar: sidebar.map(group => ({ text: group.text, items: group.items.map(({ text, link }) => ({ text, link })) })),
    search: { provider: 'local' },
  },
});

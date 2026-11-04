import { defineConfig, type DefaultTheme } from 'vitepress';
import { navigationSections, sidebarByRoute } from './sidebar.mjs';

type SidebarSourceItem = {
  text: string;
  link?: string;
  lane?: string;
  collapsed?: boolean;
  items?: SidebarSourceItem[];
};

function navigationItem(item: SidebarSourceItem): DefaultTheme.SidebarItem {
  return {
    text: item.text,
    ...(item.link !== undefined ? { link: item.link } : {}),
    ...(item.collapsed !== undefined ? { collapsed: item.collapsed } : {}),
    ...(item.items ? { items: item.items.map(navigationItem) } : {}),
  };
}

// The BaroCSS CAD documentation (W0, 2026-10-23): rewritten from scratch for the CAD stack as it is now — the studio,
// the AI agent, @barocss/cad, @barocss/cad-model and @barocss/gpu. Its structure is sidebar.mjs.
export default defineConfig({
  title: 'BaroCSS CAD',
  description: 'Design manufacturable products with an AI agent: a B-rep CAD kernel, a document model and a GPU studio, in TypeScript.',
  cleanUrls: true,
  // (`_*.md` are parts a page includes, such as the generated tool tables: not pages of their own.)
  srcExclude: ['**/_*.md'],
  lastUpdated: true,
  markdown: { languageAlias: { mjs: 'js' } },
  themeConfig: {
    nav: navigationSections.map(({ text, link, activeMatch }) => ({ text, link, activeMatch })),
    sidebar: Object.fromEntries(Object.entries(sidebarByRoute).map(([prefix, items]) => [
      prefix, items.map(navigationItem),
    ])),
    outline: [2, 3],
    search: { provider: 'local' },
  },
});

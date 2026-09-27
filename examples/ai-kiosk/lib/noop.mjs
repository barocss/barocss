// The #426 no-op check: a class token is "unstyled" when BaroCSS generates no CSS for it.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tokenize } from './sanitize.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// The prebuilt kit (packages/barocss/dist). Override with BARO_KIT=/abs/path/to/index.js.
export const KIT_PATH = process.env.BARO_KIT || path.resolve(HERE, '../../../packages/barocss/dist/index.js');

let kit = null;
export async function loadKit() {
  if (!kit) {
    const k = await import(pathToFileURL(KIT_PATH).href);
    kit = { generateCss: k.generateCss, ctx: k.createContext({}) };
  }
  return kit;
}

export function classTokens(html) {
  const set = new Set();
  for (const t of tokenize(html)) if (t.type === 'start') for (const [n, v] of t.attrs) if (n === 'class') v.split(/\s+/).filter(Boolean).forEach((c) => set.add(c));
  return [...set];
}

export async function noopCheck(html) {
  const { generateCss, ctx } = await loadKit();
  const tokens = classTokens(html);
  const unstyled = tokens.filter((c) => !String(generateCss(c, ctx) ?? '').trim());
  return { tokens: tokens.length, unstyled };
}

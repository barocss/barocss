// #218 build-time pre-generation arms for the json-render probe (imported by run.mjs). Each arm is the app's normal
// Tailwind 4.1.13 compile() with extra `@source inline("…")` lines (compile() supports @source inline natively in this
// setup, brace expansion included; no candidate-list emulation needed).
//   families    corpus (#188) utility families at full scale: every colour x shade for bg/text/border/ring, the full
//               spacing scale for p*/m*/gap*/space-*, every other corpus base literally; all x common variants
//   wide        families + every colour x shade x variants for 16 colour roots
//   corpusonly  exactly the corpus tokens (a best case that knows the future)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
export const COLORS = ['red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo',
  'violet', 'purple', 'fuchsia', 'pink', 'rose', 'slate', 'gray', 'zinc', 'neutral', 'stone'];
const SHADE = '{50,{100..900..100},950}';
const COLOR = `{{${COLORS.join(',')}}-${SHADE},white,black,transparent,current,inherit}`;
export const VARIANT_LIST = ['hover', 'focus', 'focus-visible', 'sm', 'md', 'lg', 'dark'];
const VARIANTS = `{${VARIANT_LIST.map((v) => v + ':').join(',')},}`;
const SPACING = '{0,px,0.5,1,1.5,2,2.5,3,3.5,4,5,6,7,8,9,10,11,12,14,16,20,24,28,32,36,40,44,48,52,56,60,64,72,80,96}';
const SPACE_ROOTS = '{p,px,py,pt,pr,pb,pl,m,mx,my,mt,mr,mb,ml,gap,gap-x,gap-y,space-x,space-y}';
const WIDE_ROOTS = ['bg', 'text', 'border', 'ring', 'outline', 'fill', 'stroke', 'from', 'via', 'to', 'shadow', 'decoration',
  'divide', 'placeholder', 'accent', 'caret'];

const src = fs.readFileSync(path.join(ROOT, 'packages/barocss/tests/compat/corpus.ts'), 'utf8');
export const corpus = [...src.matchAll(/\["([^"]+)",\s*(\d+)\]/g)].map((m) => m[1]);
// Base utility of a token: drop the variant prefix (last ':' outside brackets).
export const base = (t) => { let d = 0, last = -1; for (let i = 0; i < t.length; i++) { const c = t[i]; if (c === '[' || c === '(') d++; else if (c === ']' || c === ')') d--; else if (c === ':' && !d) last = i; } return t.slice(last + 1); };
const q = (s) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
const bases = [...new Set(corpus.map(base))].filter((b) => !/[\[\]()",{}]/.test(b));
const families = [`${VARIANTS}{bg,text,border,ring}-${COLOR}`, `${VARIANTS}${SPACE_ROOTS}-${SPACING}`,
  `${VARIANTS}-{m,mx,my,mt,mr,mb,ml,space-x,space-y}-${SPACING}`, `${VARIANTS}{${bases.map(q).join(',')}}`];
export const ARM_SOURCES = {
  families,
  wide: [...families, `${VARIANTS}{${WIDE_ROOTS.join(',')}}-${COLOR}`],
  corpusonly: corpus.map((t) => q(t)),
};
export const inlineCss = (arm) => ARM_SOURCES[arm].map((s) => `@source inline("${s}");`).join('\n');

// Class names a CSS text has a rule for (class tokens in selectors, unescaped).
export function cssClasses(css) {
  const out = new Set(), re = /\.((?:\\.|[^\s.:>,{}\[\]()#~+*"'])+)/g;
  const sels = css.replace(/\/\*[\s\S]*?\*\//g, '').match(/[^{};]+(?=\{)/g) || [];
  for (const s of sels) { if (/^\s*@/.test(s)) continue; let m; while ((m = re.exec(s))) out.add(m[1].replace(/\\(.)/g, '$1')); }
  return out;
}
// #209 prompted outputs: class tokens with their use counts (class="" / className="" attributes).
export function outputTokens() {
  const dir = path.join(ROOT, 'scripts/mcp-model-outputs/outputs-tw'), uses = new Map();
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.html'))) {
    const h = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const m of h.matchAll(/class(?:Name)?\s*=\s*["']([^"']*)["']/g)) for (const t of m[1].split(/\s+/).filter(Boolean)) {
      if (/[${}<>+]/.test(t) && !/\[/.test(t)) continue;
      uses.set(t, (uses.get(t) || 0) + 1);
    }
  }
  return uses;
}
export function category(t, known) {
  const b = base(t), vs = t.length > b.length ? t.slice(0, t.length - b.length - 1).split(':') : [];
  if (/\(--/.test(t)) return 'custom-property';
  if (/\[/.test(t)) return 'arbitrary';
  if (!known) return 'not-default-theme (invented/config)';
  if (/\/\d+$/.test(b) && !/^-?(w|h|inset|left|right|top|bottom|translate-[xy]|basis|aspect|size|min-w|max-w)-/.test(b)) return 'opacity-modifier';
  if (vs.length > 1 || vs.some((v) => !VARIANT_LIST.includes(v))) return 'variant-stack/uncommon-variant';
  return 'other-root/value';
}

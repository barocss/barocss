import { compile } from 'tailwindcss';
import { createContext, generateCss } from '../../packages/barocss/dist/index.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const output = process.argv[2];
if (!output) {
  throw new Error('Usage: node docs/verification/render-compat-fixtures.mjs <output-directory>');
}

const directory = resolve(output);
mkdirSync(directory, { recursive: true });

const input = `
@theme inline {
  --spacing: 0.25rem;
  --color-red-500: #ef4444;
  --breakpoint-md: 48rem;
}
@tailwind utilities;
`;

const candidates = ['hover:block', 'md:block', 'mask-linear-from-50%', 'inset-ring-2'];
const records = [];

for (const candidate of candidates) {
  const tailwind = (await compile(input)).build([candidate]);
  const context = createContext({
    preflight: false,
    theme: { colors: { red: { 500: '#ef4444' } }, breakpoints: { md: '48rem' } },
  });
  const baro = generateCss(candidate, context);
  records.push({ candidate, tailwind, baro });

  const baseStyle = candidate === 'hover:block'
    ? '.probe { display: inline-block; width: 100px; height: 100px; background: #1246b4; }'
    : candidate === 'md:block'
      ? '.probe { display: none; width: 100px; height: 100px; background: #1246b4; }'
      : '.probe { display: block; width: 100px; height: 100px; color: #1246b4; background: linear-gradient(90deg, #f00 0%, #f00 100%); }';
  const file = candidate.replaceAll(':', '-').replaceAll('%', 'pct');

  for (const [engine, css] of [['tailwind', tailwind], ['baro', baro]]) {
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>${baseStyle}\n${css}</style></head><body><div id="probe" role="img" aria-label="probe" class="probe ${candidate}"></div></body></html>`;
    writeFileSync(join(directory, `${file}-${engine}.html`), html);
  }
}

writeFileSync(join(directory, 'css.json'), JSON.stringify(records, null, 2));
console.log(`Wrote browser comparison pages to ${directory}`);

import { compile } from 'tailwindcss';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import '../../src/presets';

const tailwindInput = `
@theme inline {
  --spacing: 0.25rem;
  --color-red-500: #ef4444;
  --breakpoint-md: 48rem;
}
@tailwind utilities;
`;

export async function buildCssPair(candidate: string) {
  const compiler = await compile(tailwindInput);
  const tailwindCss = compiler.build([candidate]);
  const context = createContext({
    preflight: false,
    theme: { colors: { red: { 500: '#ef4444' } }, breakpoints: { md: '48rem' } },
  });
  const baroCss = generateCss(candidate, context);
  return { tailwindCss, baroCss };
}

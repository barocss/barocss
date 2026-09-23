import { compile } from 'tailwindcss';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import '../../src/presets';
import { compatibilityBaseline } from './catalog';

export async function buildCssPair(candidate: string) {
  const compiler = await compile(compatibilityBaseline.settings.tailwindInput);
  const tailwindCss = compiler.build([candidate]);
  const context = createContext(compatibilityBaseline.settings.baroContext);
  const baroCss = generateCss(candidate, context);
  return { tailwindCss, baroCss };
}

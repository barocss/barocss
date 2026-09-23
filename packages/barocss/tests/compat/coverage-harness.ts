import { compile as compileV4_1_13 } from 'tailwindcss';
import { compile as compileV4_3_3 } from 'tailwindcss-v4-3';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import '../../src/presets';
import { normalizeCss, structureFingerprint } from './normalize';

export const coverageRun = {
  id: 'tailwind-4.1.13-and-4.3.3-baro-4cf6a2c-broad',
  measuredOn: '2026-09-23',
  barocssCommit: '4cf6a2c',
  tailwindVersions: ['4.1.13', '4.3.3'],
  environment: { node: '22.22.0', pnpm: '10.11.0', postcss: '8.5.6' },
  browserStatus: 'seven-selected-4.3.3-states-verified',
} as const;

export const tailwindInput = `
@theme inline {
  --spacing: 0.25rem;
  --color-red-500: #ef4444;
  --breakpoint-sm: 40rem;
  --breakpoint-md: 48rem;
  --breakpoint-lg: 64rem;
  --text-xs: 0.75rem;
  --text-base: 1rem;
  --text-xl: 1.25rem;
  --font-weight-normal: 400;
  --font-weight-semibold: 600;
  --container-sm: 24rem;
  --radius: 0.25rem;
  --radius-lg: 0.5rem;
  --shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  --blur: 8px;
  --blur-sm: 8px;
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --animate-spin: spin 1s linear infinite;
  @keyframes spin { to { transform: rotate(360deg); } }
}
@tailwind utilities;
`;

export type CoverageStatus = 'match' | 'different' | 'unsupported' | 'reference-no-rule';

export function classifyCss(referenceCss: string, baroCss: string): CoverageStatus {
  const referenceNodes = normalizeCss(referenceCss);
  const baroNodes = normalizeCss(baroCss);
  if (referenceNodes.length === 0) return 'reference-no-rule';
  if (baroNodes.length === 0) return 'unsupported';
  return JSON.stringify(referenceNodes) === JSON.stringify(baroNodes) ? 'match' : 'different';
}

export async function buildCoverageCase(classes: string[]) {
  const [oldCompiler, latestCompiler] = await Promise.all([
    compileV4_1_13(tailwindInput),
    compileV4_3_3(tailwindInput),
  ]);
  const tailwindV4_1_13 = oldCompiler.build(classes);
  const tailwindV4_3_3 = latestCompiler.build(classes);
  const context = createContext({
    preflight: false,
    theme: {
      colors: { red: { 500: '#ef4444' } },
      breakpoints: { sm: '40rem', md: '48rem', lg: '64rem' },
      blur: { DEFAULT: '8px' },
    },
  });
  const barocss = generateCss(classes.join(' '), context);
  return {
    tailwindV4_1_13,
    tailwindV4_3_3,
    barocss,
    statusV4_1_13: classifyCss(tailwindV4_1_13, barocss),
    statusV4_3_3: classifyCss(tailwindV4_3_3, barocss),
    fingerprints: {
      tailwindV4_1_13: structureFingerprint(tailwindV4_1_13),
      tailwindV4_3_3: structureFingerprint(tailwindV4_3_3),
      barocss: structureFingerprint(barocss),
    },
  };
}

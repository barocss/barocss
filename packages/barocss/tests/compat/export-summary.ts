import { writeFileSync } from 'node:fs';
import { compatibilityBaseline } from './catalog';

const outputPath = process.argv[2];
if (!outputPath) {
  throw new Error('Usage: vite-node --script tests/compat/export-summary.ts <output-markdown>');
}

const { id, tailwindVersion, barocssCommit, measuredOn, environment, cases } = compatibilityBaseline;
const evidenceLinks = compatibilityBaseline.evidence as Record<string, string>;
const lines = [
  '# Generated compatibility case summary',
  '',
  `Source: [catalog.ts](../../packages/barocss/tests/compat/catalog.ts). Baseline: \`${id}\`.`,
  `Tailwind CSS \`${tailwindVersion}\`; BaroCSS commit \`${barocssCommit}\`; measured ${measuredOn}.`,
  `CSS environment: Node ${environment.node}, pnpm ${environment.pnpm}, Vitest ${environment.vitest}. Browser evidence is recorded per input.`,
  'Exact Tailwind input and BaroCSS context settings are in the catalog. Preflight is off in this baseline.',
  '',
  'Patterns classify syntax; they do not claim support for every value in a family. This first slice has no combination fixture. `verified` browser results apply only to the named scenario. This table is not an overall compatibility rate.',
  '',
  '| Origin | Family | Pattern | Role | Exact input | BaroCSS introduced | CSS structure | Browser behavior | Evidence |',
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ...cases.map(({ origin, family, pattern, sampleRole, input, barocssIntroducedVersion, cssStructure, browser, evidenceIds }) => {
    const evidence = evidenceIds.map((evidenceId) => {
      const link = evidenceLinks[evidenceId];
      if (!link) throw new Error(`Missing evidence link: ${evidenceId}`);
      const href = link.startsWith('docs/verification/') ? link.slice('docs/verification/'.length) : link;
      return `[${evidenceId}](${href})`;
    });
    if (browser.evidence && browser.evidence !== evidenceLinks.B1) {
      evidence.push(`[browser recheck](${browser.evidence})`);
    }
    const browserScope = browser.status === 'verified'
      ? `: Chromium ${browser.version}${browser.recheckVersion ? `; recheck ${browser.recheckVersion}` : ''}; ${browser.scenario}`
      : '';
    return `| ${origin} | ${family} | \`${pattern}\` | ${sampleRole} | \`${input}\` | ${barocssIntroducedVersion} | ${cssStructure} | ${browser.status}${browserScope} | ${evidence.join(', ')} |`;
  }),
  '',
];

writeFileSync(outputPath, lines.join('\n'));

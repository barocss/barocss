import { writeFileSync } from 'node:fs';
import { compatibilityBaseline, compatibilityFollowup, type CompatibilityCase } from './catalog';

const outputPath = process.argv[2];
if (!outputPath) {
  throw new Error('Usage: vite-node --script tests/compat/export-summary.ts <output-markdown>');
}

const { id, tailwindVersion, barocssCommit, measuredOn, environment, cases } = compatibilityBaseline;
const evidenceLinks = compatibilityBaseline.evidence as Record<string, string>;
const tableHeader = [
  '| Origin | Family | Pattern | Role | Exact input | BaroCSS introduced | CSS structure | Browser behavior | Evidence |',
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
];
const renderRows = (entries: ReadonlyArray<CompatibilityCase>, links: Record<string, string>) => entries.map(({ origin, family, pattern, sampleRole, input, barocssIntroducedVersion, cssStructure, browser, evidenceIds }) => {
  const evidence = evidenceIds.map((evidenceId) => {
    const link = links[evidenceId];
    if (!link) throw new Error(`Missing evidence link: ${evidenceId}`);
    const href = link.startsWith('docs/verification/') ? link.slice('docs/verification/'.length) : link;
    return `[${evidenceId}](${href})`;
  });
  if (browser.evidence && !Object.values(links).includes(browser.evidence)) {
    evidence.push(`[browser recheck](${browser.evidence})`);
  }
  const browserScope = browser.status === 'verified'
    ? `: Chromium ${browser.version}${browser.recheckVersion ? `; recheck ${browser.recheckVersion}` : ''}; ${browser.scenario}`
    : '';
  return `| ${origin} | ${family} | \`${pattern}\` | ${sampleRole} | \`${input}\` | ${barocssIntroducedVersion} | ${cssStructure} | ${browser.status}${browserScope} | ${evidence.join(', ')} |`;
});
const lines = [
  '# Generated compatibility case summary',
  '',
  `Source: [catalog.ts](../../packages/barocss/tests/compat/catalog.ts). Baseline: \`${id}\`.`,
  `Tailwind CSS \`${tailwindVersion}\`; BaroCSS commit \`${barocssCommit}\`; measured ${measuredOn}.`,
  `CSS environment: Node ${environment.node}, pnpm ${environment.pnpm}, Vitest ${environment.vitest}. Browser evidence is recorded per input.`,
  'Exact Tailwind input and BaroCSS context settings are in the catalog. Preflight is off in this baseline.',
  '',
  'Patterns classify syntax; they do not claim support for every value in a family. The original 15-case slice has no combination fixture; the follow-up tests one named combination. `verified` browser results apply only to the named scenario. This table is not an overall compatibility rate.',
  '',
  ...tableHeader,
  ...renderRows(cases, evidenceLinks),
  '',
  '## Follow-up: five additional measured inputs',
  '',
  `Run: \`${compatibilityFollowup.id}\`; Tailwind CSS \`${compatibilityFollowup.tailwindVersion}\`; BaroCSS commit \`${compatibilityFollowup.barocssCommit}\`; measured ${compatibilityFollowup.measuredOn}.`,
  'The follow-up uses the same CSS settings as the original slice. Browser behavior was not measured for these five inputs.',
  '',
  ...tableHeader,
  ...renderRows(compatibilityFollowup.cases, compatibilityFollowup.evidence as Record<string, string>),
  '',
];

writeFileSync(outputPath, lines.join('\n'));

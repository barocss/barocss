import { readFileSync, writeFileSync } from 'node:fs';
import { coverageBacklog } from './coverage-catalog';
import { coverageRun, type CoverageStatus } from './coverage-harness';

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  throw new Error('Usage: vite-node --script tests/compat/export-broad-report.ts <raw-json> <report-md>');
}

type Record = {
  id: string;
  axis: string;
  family: string;
  role: string;
  classes: string[];
  source: string;
  statusV4_1_13: CoverageStatus;
  statusV4_3_3: CoverageStatus;
  browserStatus: string;
};
const raw = JSON.parse(readFileSync(inputPath, 'utf8')) as { run: typeof coverageRun; records: Record[] };
if (JSON.stringify(raw.run) !== JSON.stringify(coverageRun)) throw new Error('Run metadata does not match harness');

const statuses: CoverageStatus[] = ['match', 'different', 'unsupported', 'reference-no-rule'];
const count = (records: Record[], version: 'statusV4_1_13' | 'statusV4_3_3', status: CoverageStatus) =>
  records.filter((record) => record[version] === status).length;
const summaryRow = (label: string, records: Record[]) =>
  `| ${label} | ${records.length} | ${statuses.map((status) => count(records, 'statusV4_1_13', status)).join(' | ')} | ${statuses.map((status) => count(records, 'statusV4_3_3', status)).join(' | ')} |`;

const axes = [...new Set(raw.records.map(({ axis }) => axis))];
const lines = [
  '# Tailwind CSS 4.1.13 and 4.3.3: measured CSS structure',
  '',
  `Generated from the [raw CSS records](tailwind-4.1.13-4.3.3-broad-output.json) and the [exact input catalog](../../packages/barocss/tests/compat/coverage-catalog.ts) on ${coverageRun.measuredOn}. This is a selected sample, **not a compatibility percentage** or a claim of full version support.`,
  '',
  `Reference versions: pinned \`tailwindcss@4.1.13\` and \`tailwindcss@4.3.3\`. The latter was the npm latest tag on ${coverageRun.measuredOn}; see [Tailwind releases](https://github.com/tailwindlabs/tailwindcss/releases) and the [v4.3 release notes](https://tailwindcss.com/blog/tailwindcss-v4-3). BaroCSS source: \`${coverageRun.barocssCommit}\`. Environment: Node ${coverageRun.environment.node}, pnpm ${coverageRun.environment.pnpm}, PostCSS ${coverageRun.environment.postcss}.`,
  '',
  '## Method and limits',
  '',
  '- Each row is one exact class set. Tailwind `compile()` builds that set against the pinned inline theme in the raw JSON. BaroCSS uses `generateCss()` with Preflight off, red-500 `#ef4444`, and sm/md/lg breakpoints at 40/48/64rem. Both Tailwind versions use those values.',
  '- Other theme tokens and CSS variable definitions are not aligned or rendered as a complete page. A `different` result can reflect theme setup, variable naming, or generated CSS structure. Inspect the raw CSS before treating it as a product gap.',
  '- PostCSS parsing removes comments and formatting only. It preserves selectors, declaration names and values, rule order, nesting, and at-rules. `match` means these structures are identical. `different` means they are not. A different structure is **not** proof of different browser behavior.',
  '- `unsupported` means Tailwind emitted a CSS rule and BaroCSS emitted no rule for the exact input. `reference-no-rule` means that pinned Tailwind version emitted no rule; it does not establish the feature introduction date.',
  '- Every browser result in this run is `unverified`. CSS variables and theme output are not separately rendered here. A syntactic match alone does not establish computed style or visual parity.',
  '- The older [15-input matrix](tailwind-compatibility-matrix.md) and [five-input follow-up](tailwind-4.1.13-followup-output.json) remain separate records with their own settings and browser evidence.',
  '',
  '## Selected-input counts',
  '',
  '| Axis | Inputs | 4.1 match | 4.1 different | 4.1 unsupported | 4.1 no rule | 4.3 match | 4.3 different | 4.3 unsupported | 4.3 no rule |',
  '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ...axes.map((axis) => summaryRow(axis, raw.records.filter((record) => record.axis === axis))),
  summaryRow('Total selected inputs', raw.records),
  '',
  '## Exact inputs',
  '',
  '| Axis / family | Role | Exact class set | 4.1.13 CSS | 4.3.3 CSS | Browser | Source |',
  '| --- | --- | --- | --- | --- | --- | --- |',
  ...raw.records.map((record) => `| ${record.axis} / ${record.family} | ${record.role} | \`${record.classes.join(' ')}\` | ${record.statusV4_1_13} | ${record.statusV4_3_3} | ${record.browserStatus} | [Tailwind](${record.source}) |`),
  '',
  '## Unmeasured axes',
  '',
  '| Axis | Topic | Status | Source |',
  '| --- | --- | --- | --- |',
  ...coverageBacklog.map(({ axis, topic, status, source }) => `| ${axis} | ${topic} | ${status} | [Tailwind](${source}) |`),
  '',
  '## Reproduce',
  '',
  'Use Node 22.22.0 and pnpm 10.11.0. From the repository root:',
  '',
  '```sh',
  'pnpm install --frozen-lockfile',
  'pnpm --filter @barocss/kit exec vitest run tests/compat/coverage.test.ts',
  'pnpm --filter @barocss/kit exec vite-node --script tests/compat/export-broad-output.ts ../../docs/verification/tailwind-4.1.13-4.3.3-broad-output.json',
  'pnpm --filter @barocss/kit exec vite-node --script tests/compat/export-broad-report.ts ../../docs/verification/tailwind-4.1.13-4.3.3-broad-output.json ../../docs/verification/tailwind-4.1.13-4.3.3-broad-coverage.generated.md',
  '```',
  '',
  'The test compares all raw CSS strings and structure fingerprints with the checked-in records. Review any changed record before accepting it.',
];
writeFileSync(outputPath, `${lines.join('\n')}\n`);

export type CompatibilityCase = {
  id: string;
  origin: 'tailwind' | 'barocss';
  barocssIntroducedVersion: string | 'unverified';
  family: string;
  pattern: string;
  sampleRole: 'representative' | 'boundary' | 'combination';
  input: string;
  cssStructure: 'match' | 'different' | 'unsupported' | 'unverified' | 'out-of-scope';
  browser: {
    status: 'verified' | 'different' | 'unverified' | 'out-of-scope';
    version?: string;
    recheckVersion?: string;
    scenario?: string;
    evidence?: string;
  };
  requiredBaroDeclarations?: ReadonlyArray<{ prop: string; value: string }>;
  evidenceIds: ReadonlyArray<string>;
  collision?: {
    kind: 'collision' | 'intentional-difference';
    reason: string;
    evidence: string;
  };
};

export const compatibilityBaseline = {
  id: 'tailwind-4.1.13-baro-6df9af9',
  tailwindVersion: '4.1.13',
  barocssCommit: '6df9af9',
  measuredOn: '2026-09-23',
  environment: {
    node: '22.22.0',
    pnpm: '10.11.0',
    vitest: '3.2.4',
    browser: 'Chromium 153.0.8010.53',
  },
  settings: {
    tailwindInput: `
@theme inline {
  --spacing: 0.25rem;
  --color-red-500: #ef4444;
  --breakpoint-md: 48rem;
}
@tailwind utilities;
`,
    baroContext: {
      preflight: false,
      theme: { colors: { red: { 500: '#ef4444' } }, breakpoints: { md: '48rem' } },
    },
  },
  evidence: {
    C1: 'docs/verification/tailwind-4.1.13-output.json',
    B1: 'https://github.com/barocss/barocss/issues/67#issuecomment-5787601039',
  },
  cases: [
    { id: 'display-block', origin: 'tailwind', barocssIntroducedVersion: 'unverified', family: 'display', pattern: 'block', sampleRole: 'representative', input: 'block', cssStructure: 'match', browser: { status: 'unverified' }, evidenceIds: ['C1'] },
    { id: 'display-hidden', origin: 'tailwind', barocssIntroducedVersion: 'unverified', family: 'display', pattern: 'hidden', sampleRole: 'representative', input: 'hidden', cssStructure: 'match', browser: { status: 'unverified' }, evidenceIds: ['C1'] },
    { id: 'layout-overflow', origin: 'tailwind', barocssIntroducedVersion: 'unverified', family: 'layout', pattern: 'overflow-<mode>', sampleRole: 'representative', input: 'overflow-hidden', cssStructure: 'match', browser: { status: 'unverified' }, evidenceIds: ['C1'] },
    { id: 'type-align', origin: 'tailwind', barocssIntroducedVersion: 'unverified', family: 'typography', pattern: 'text-<alignment>', sampleRole: 'representative', input: 'text-center', cssStructure: 'match', browser: { status: 'unverified' }, evidenceIds: ['C1'] },
    { id: 'spacing-padding', origin: 'tailwind', barocssIntroducedVersion: 'unverified', family: 'spacing', pattern: 'p-<scale>', sampleRole: 'representative', input: 'p-4', cssStructure: 'different', browser: { status: 'unverified' }, requiredBaroDeclarations: [{ prop: 'padding', value: 'calc(var(--spacing) * 4)' }], evidenceIds: ['C1'] },
    { id: 'spacing-negative-margin', origin: 'tailwind', barocssIntroducedVersion: 'unverified', family: 'spacing', pattern: '-mt-<scale>', sampleRole: 'boundary', input: '-mt-4', cssStructure: 'different', browser: { status: 'unverified' }, requiredBaroDeclarations: [{ prop: 'margin-top', value: 'calc(var(--spacing) * -4)' }], evidenceIds: ['C1'] },
    { id: 'color-theme', origin: 'tailwind', barocssIntroducedVersion: 'unverified', family: 'color', pattern: 'bg-<theme-color>', sampleRole: 'representative', input: 'bg-red-500', cssStructure: 'match', browser: { status: 'unverified' }, evidenceIds: ['C1'] },
    { id: 'color-arbitrary', origin: 'tailwind', barocssIntroducedVersion: 'unverified', family: 'arbitrary-color', pattern: 'bg-[<color>]', sampleRole: 'representative', input: 'bg-[#ff0000]', cssStructure: 'match', browser: { status: 'unverified' }, evidenceIds: ['C1'] },
    { id: 'variant-focus', origin: 'tailwind', barocssIntroducedVersion: 'unverified', family: 'state-variant', pattern: 'focus:<utility>', sampleRole: 'representative', input: 'focus:block', cssStructure: 'different', browser: { status: 'unverified' }, requiredBaroDeclarations: [{ prop: 'display', value: 'block' }], evidenceIds: ['C1'] },
    { id: 'variant-hover', origin: 'tailwind', barocssIntroducedVersion: 'unverified', family: 'state-variant', pattern: 'hover:<utility>', sampleRole: 'representative', input: 'hover:block', cssStructure: 'different', browser: { status: 'verified', version: '153.0.8010.53', scenario: 'desktop hover before/after; touch tap; viewport unrecorded', evidence: 'https://github.com/barocss/barocss/issues/67#issuecomment-5787601039' }, requiredBaroDeclarations: [{ prop: 'display', value: 'block' }], evidenceIds: ['C1', 'B1'] },
    { id: 'variant-md', origin: 'tailwind', barocssIntroducedVersion: 'unverified', family: 'responsive-variant', pattern: 'md:<utility>', sampleRole: 'boundary', input: 'md:block', cssStructure: 'different', browser: { status: 'verified', version: '153.0.8010.53', scenario: 'viewport 767/768/769px', evidence: 'https://github.com/barocss/barocss/issues/67#issuecomment-5787601039' }, requiredBaroDeclarations: [{ prop: 'display', value: 'block' }], evidenceIds: ['C1', 'B1'] },
    { id: 'grid-columns', origin: 'tailwind', barocssIntroducedVersion: 'unverified', family: 'grid', pattern: 'grid-cols-<count>', sampleRole: 'representative', input: 'grid-cols-2', cssStructure: 'match', browser: { status: 'unverified' }, evidenceIds: ['C1'] },
    { id: 'inset-ring', origin: 'tailwind', barocssIntroducedVersion: 'unverified', family: 'effects', pattern: 'inset-ring-<width>', sampleRole: 'representative', input: 'inset-ring-2', cssStructure: 'different', browser: { status: 'verified', version: '153.0.8010.53', recheckVersion: '153', scenario: '100×100 probe, color #1246b4 with currentcolor ring; viewport unrecorded', evidence: 'https://github.com/barocss/barocss/pull/71#issuecomment-5788063380' }, requiredBaroDeclarations: [{ prop: '--baro-inset-ring-color', value: 'currentcolor' }, { prop: 'box-shadow', value: 'var(--baro-inset-shadow, 0 0 #0000), var(--baro-inset-ring-shadow), var(--baro-ring-offset-shadow, 0 0 #0000), var(--baro-ring-shadow, 0 0 #0000), var(--baro-shadow, 0 0 #0000)' }], evidenceIds: ['C1', 'B1'] },
    { id: 'field-sizing', origin: 'tailwind', barocssIntroducedVersion: 'unverified', family: 'forms', pattern: 'field-sizing-<mode>', sampleRole: 'representative', input: 'field-sizing-content', cssStructure: 'match', browser: { status: 'unverified' }, evidenceIds: ['C1'] },
    { id: 'mask-linear-from', origin: 'tailwind', barocssIntroducedVersion: 'unverified', family: 'effects', pattern: 'mask-linear-from-<percent>', sampleRole: 'representative', input: 'mask-linear-from-50%', cssStructure: 'different', browser: { status: 'verified', version: '153.0.8010.53', recheckVersion: '153', scenario: '100×100 probe, 50% mask position; viewport unrecorded', evidence: 'https://github.com/barocss/barocss/pull/71#issuecomment-5788063380' }, requiredBaroDeclarations: [{ prop: '--tw-mask-linear-from-position', value: '50%' }, { prop: 'mask-composite', value: 'intersect' }], evidenceIds: ['C1', 'B1'] },
  ] satisfies CompatibilityCase[],
};

export const compatibilityFollowup = {
  id: 'tailwind-4.1.13-baro-7c0568f-followup-5',
  tailwindVersion: '4.1.13',
  barocssCommit: '7c0568f',
  measuredOn: '2026-09-23',
  environment: {
    node: '22.22.0',
    pnpm: '10.11.0',
    vitest: '3.2.4',
  },
  settings: compatibilityBaseline.settings,
  evidence: {
    C2: 'docs/verification/tailwind-4.1.13-followup-output.json',
  },
  cases: [
    { id: 'spacing-padding-zero', origin: 'tailwind', barocssIntroducedVersion: 'unverified', family: 'spacing', pattern: 'p-<scale>', sampleRole: 'boundary', input: 'p-0', cssStructure: 'different', browser: { status: 'unverified' }, requiredBaroDeclarations: [{ prop: 'padding', value: 'calc(var(--spacing) * 0)' }], evidenceIds: ['C2'] },
    { id: 'spacing-padding-pixel', origin: 'tailwind', barocssIntroducedVersion: 'unverified', family: 'spacing', pattern: 'p-px', sampleRole: 'boundary', input: 'p-px', cssStructure: 'match', browser: { status: 'unverified' }, evidenceIds: ['C2'] },
    { id: 'spacing-padding-arbitrary', origin: 'tailwind', barocssIntroducedVersion: 'unverified', family: 'spacing', pattern: 'p-[<length>]', sampleRole: 'boundary', input: 'p-[3px]', cssStructure: 'match', browser: { status: 'unverified' }, evidenceIds: ['C2'] },
    { id: 'variant-md-hover', origin: 'tailwind', barocssIntroducedVersion: 'unverified', family: 'combined-variant', pattern: 'md:hover:<utility>', sampleRole: 'combination', input: 'md:hover:block', cssStructure: 'different', browser: { status: 'unverified' }, requiredBaroDeclarations: [{ prop: 'display', value: 'block' }], evidenceIds: ['C2'] },
    { id: 'important-suffix', origin: 'tailwind', barocssIntroducedVersion: 'unverified', family: 'important-modifier', pattern: '<utility>!', sampleRole: 'boundary', input: 'bg-red-500!', cssStructure: 'unsupported', browser: { status: 'unverified' }, evidenceIds: ['C2'] },
  ] satisfies CompatibilityCase[],
};

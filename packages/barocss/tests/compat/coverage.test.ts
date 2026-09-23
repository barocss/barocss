import { describe, expect, it } from 'vitest';
import { compile as compileV4_1_13 } from 'tailwindcss';
import { compile as compileV4_3_3 } from 'tailwindcss-v4-3';
import raw from '../../../../docs/verification/tailwind-4.1.13-4.3.3-broad-output.json';
import { coverageCases } from './coverage-catalog';
import { buildCoverageCase, coverageRun } from './coverage-harness';
import { browserEvidenceV4_3_3, unverifiedBrowser } from './browser-evidence';

describe('broad Tailwind CSS version comparison', () => {
  it('scopes bare blur evidence to the explicit --blur theme token', async () => {
    for (const compile of [compileV4_1_13, compileV4_3_3]) {
      const withoutToken = await compile('@tailwind utilities;');
      const withToken = await compile('@theme inline { --blur: 8px; } @tailwind utilities;');
      expect(withoutToken.build(['blur'])).not.toContain('.blur {');
      expect(withToken.build(['blur'])).toContain('--tw-blur: blur(8px);');
    }
  });

  it('keeps every measured input unique, sourced, and bound to the pinned run', () => {
    expect(coverageCases.length).toBeGreaterThan(200);
    expect(new Set(coverageCases.map(({ id }) => id)).size).toBe(coverageCases.length);
    expect(new Set(coverageCases.map(({ classes }) => classes.join(' '))).size).toBe(coverageCases.length);
    expect(raw.run).toEqual(coverageRun);
    expect(raw.records.map(({ id }) => id)).toEqual(coverageCases.map(({ id }) => id));
    for (const entry of coverageCases) {
      expect(entry.source).toMatch(/^https:\/\/tailwindcss\.com\//);
    }
  });

  it('reproduces both versions and BaroCSS for every raw CSS record', async () => {
    for (const [index, entry] of coverageCases.entries()) {
      const actual = await buildCoverageCase(entry.classes);
      const recorded = raw.records[index];
      expect(actual.tailwindV4_1_13, entry.id).toContain('/*! tailwindcss v4.1.13');
      expect(actual.tailwindV4_3_3, entry.id).toContain('/*! tailwindcss v4.3.3');
      expect(recorded, entry.id).toEqual({
        ...entry,
        browserV4_1_13: unverifiedBrowser,
        browserV4_3_3: browserEvidenceV4_3_3(entry.classes),
        ...actual,
      });
    }
  });

  it('limits browser conclusions to seven exact Tailwind 4.3.3 inputs', () => {
    const verified = raw.records.filter(({ browserV4_3_3 }) => browserV4_3_3.status === 'verified-match');
    expect(verified.map(({ classes }) => classes.join(' '))).toEqual(['scrollbar-gutter-stable', 'scrollbar-gutter-auto', 'scrollbar-gutter-both', 'zoom-75', 'zoom-125', 'tab-2', 'tab-[12px]']);
    expect(raw.records.every(({ browserV4_1_13 }) => browserV4_1_13.status === 'unverified')).toBe(true);
  });
});

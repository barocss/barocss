import { describe, expect, it } from 'vitest';
import raw from '../../../../docs/verification/tailwind-4.1.13-4.3.3-broad-output.json';
import { coverageCases } from './coverage-catalog';
import { buildCoverageCase, coverageRun } from './coverage-harness';

describe('broad Tailwind CSS version comparison', () => {
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
      expect(recorded, entry.id).toEqual({ ...entry, browserStatus: 'unverified', ...actual });
    }
  });
});

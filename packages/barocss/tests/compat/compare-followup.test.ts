import { describe, expect, it } from 'vitest';
import postcss from 'postcss';
import approved from './approved-followup-structures.json';
import { compatibilityFollowup } from './catalog';
import { buildCssPair } from './harness';
import { normalizeCss, structureFingerprint } from './normalize';
import raw from '../../../../docs/verification/tailwind-4.1.13-followup-output.json';

type ApprovedStructure = { fingerprint: string; nodes: unknown[] };
const approvedStructures = approved as Record<string, { tailwind: ApprovedStructure; barocss: ApprovedStructure }>;
const rawRecords = raw.records as Array<{ candidate: string; expected: string; tailwindCss: string; baroCss: string }>;

describe('Tailwind CSS 4.1.13 follow-up comparison', () => {
  it('keeps five new catalog, raw, and approved inputs aligned', () => {
    const inputs = compatibilityFollowup.cases.map(({ input }) => input);
    expect(inputs).toHaveLength(5);
    expect(new Set(inputs).size).toBe(5);
    expect(rawRecords.map(({ candidate }) => candidate)).toEqual(inputs);
    expect(Object.keys(approvedStructures).sort()).toEqual([...inputs].sort());
    expect(raw.tailwindVersion).toBe(compatibilityFollowup.tailwindVersion);
    expect(raw.barocssCommit).toBe(compatibilityFollowup.barocssCommit);
    for (const entry of compatibilityFollowup.cases) {
      expect(entry.browser.status).toBe('unverified');
      for (const evidenceId of entry.evidenceIds) {
        expect(compatibilityFollowup.evidence[evidenceId]).toBeTruthy();
      }
    }
  });

  it.each(compatibilityFollowup.cases)('$input: $cssStructure', async (entry) => {
    const current = await buildCssPair(entry.input);
    const recorded = rawRecords.find(({ candidate }) => candidate === entry.input);
    expect(recorded).toBeDefined();
    // Preserve the 7c0568f output after the important suffix was implemented.
    const { tailwindCss, baroCss } = entry.id === 'important-suffix' ? recorded! : current;
    if (entry.id === 'important-suffix') {
      expect(current.tailwindCss).toBe(tailwindCss);
      expect(current.baroCss).toContain('background-color: #ef4444 !important;');
      expect(normalizeCss(current.tailwindCss)).toEqual(normalizeCss(current.baroCss));
    }
    const tailwindNodes = normalizeCss(tailwindCss);
    const baroNodes = normalizeCss(baroCss);
    const status = tailwindNodes.length === 0 ? 'no-tailwind-rule'
      : baroNodes.length === 0 ? 'unsupported'
      : JSON.stringify(tailwindNodes) === JSON.stringify(baroNodes) ? 'match' : 'different';
    expect(tailwindCss).toContain('/*! tailwindcss v4.1.13');
    expect(status).toBe(entry.cssStructure);
    expect({ candidate: entry.input, expected: status, tailwindCss, baroCss }).toEqual(rawRecords.find(({ candidate }) => candidate === entry.input));
    expect(structureFingerprint(tailwindCss)).toBe(approvedStructures[entry.input].tailwind.fingerprint);
    expect(structureFingerprint(baroCss)).toBe(approvedStructures[entry.input].barocss.fingerprint);
    expect(tailwindNodes).toEqual(approvedStructures[entry.input].tailwind.nodes);
    expect(baroNodes).toEqual(approvedStructures[entry.input].barocss.nodes);

    if (entry.cssStructure === 'different') {
      const declarations: Array<{ prop: string; value: string }> = [];
      postcss.parse(baroCss).walkDecls(({ prop, value }) => declarations.push({ prop, value }));
      expect(entry.requiredBaroDeclarations?.length).toBeGreaterThan(0);
      for (const required of entry.requiredBaroDeclarations ?? []) {
        expect(declarations).toContainEqual(required);
      }
    }
    if (entry.cssStructure === 'unsupported') {
      expect(tailwindNodes.length).toBeGreaterThan(0);
      expect(baroNodes).toHaveLength(0);
    }
  });
});

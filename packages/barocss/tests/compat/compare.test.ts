import { describe, expect, it } from 'vitest';
import postcss from 'postcss';
import approved from './approved-structures.json';
import { compatibilityBaseline } from './catalog';
import { fixtures } from './fixtures';
import { buildCssPair } from './harness';
import { normalizeCss, structureFingerprint } from './normalize';

type ApprovedStructure = { fingerprint: string; nodes: unknown[] };
const approvedStructures = approved as Record<string, { tailwind: ApprovedStructure; barocss: ApprovedStructure }>;

async function compare(candidate: string) {
  const { tailwindCss, baroCss } = await buildCssPair(candidate);
  const tailwindNodes = normalizeCss(tailwindCss);
  const baroNodes = normalizeCss(baroCss);
  const result = tailwindNodes.length === 0 ? 'no-tailwind-rule'
    : baroNodes.length === 0 ? 'unsupported'
    : JSON.stringify(tailwindNodes) === JSON.stringify(baroNodes) ? 'match' : 'different';
  return { result, tailwindCss, baroCss };
}

describe('Tailwind CSS 4.1.13 output comparison', () => {
  it('keeps the catalog and approved output keys aligned', () => {
    const inputs = fixtures.map(({ candidate }) => candidate);
    expect(new Set(inputs).size).toBe(inputs.length);
    expect(Object.keys(approvedStructures).sort()).toEqual([...inputs].sort());
    expect(compatibilityBaseline.cases).toHaveLength(15);
    const evidence = compatibilityBaseline.evidence as Record<string, string>;
    for (const entry of compatibilityBaseline.cases) {
      expect(entry.pattern).toBeTruthy();
      expect(entry.barocssIntroducedVersion).toBeTruthy();
      for (const evidenceId of entry.evidenceIds) expect(evidence[evidenceId]).toBeTruthy();
      if (entry.browser.status === 'verified') {
        expect(entry.browser.version).toBeTruthy();
        expect(entry.browser.scenario).toBeTruthy();
        expect(entry.browser.evidence).toBeTruthy();
      }
      if (entry.origin === 'barocss') expect(entry.cssStructure).toBe('out-of-scope');
    }
  });

  it.each(fixtures)('$name: $candidate', async ({ candidate, expected }) => {
    const output = await compare(candidate);
    expect(output.tailwindCss).toContain('/*! tailwindcss v4.1.13');
    expect(output.result, `Tailwind:\n${output.tailwindCss}\nBaroCSS:\n${output.baroCss}`).toBe(expected);
    expect(structureFingerprint(output.tailwindCss)).toBe(approvedStructures[candidate].tailwind.fingerprint);
    expect(structureFingerprint(output.baroCss)).toBe(approvedStructures[candidate].barocss.fingerprint);
    expect(JSON.stringify(normalizeCss(output.tailwindCss))).toBe(JSON.stringify(approvedStructures[candidate].tailwind.nodes));
    expect(JSON.stringify(normalizeCss(output.baroCss))).toBe(JSON.stringify(approvedStructures[candidate].barocss.nodes));

    const entry = compatibilityBaseline.cases.find(({ input }) => input === candidate);
    expect(entry).toBeDefined();
    if (entry?.cssStructure === 'different') {
      expect(entry.requiredBaroDeclarations?.length).toBeGreaterThan(0);
      const declarations: Array<{ prop: string; value: string }> = [];
      postcss.parse(output.baroCss).walkDecls(({ prop, value }) => {
        declarations.push({ prop, value });
      });
      for (const required of entry.requiredBaroDeclarations ?? []) {
        expect(declarations).toContainEqual(required);
      }
    }
  });

  it('detects a changed rule even when it would still be classified different', async () => {
    const { tailwindCss, baroCss } = await buildCssPair('p-4');
    const changedBaroCss = baroCss.replace('var(--spacing) * 4', 'var(--spacing) * 5');
    expect(changedBaroCss).not.toBe(baroCss);
    expect(JSON.stringify(normalizeCss(tailwindCss))).not.toBe(JSON.stringify(normalizeCss(changedBaroCss)));
    expect(structureFingerprint(changedBaroCss)).not.toBe(approvedStructures['p-4'].barocss.fingerprint);
  });

  it('ignores comments at every CSS nesting level', () => {
    const plain = '.x { color: red; display: block } @media (hover: hover) { .x { display: block } }';
    const commented = '.x { /* before */ color: red; /* between */ display: block } @media (hover: hover) { /* nested */ .x { display: block /* last */ } }';
    expect(normalizeCss(commented)).toEqual(normalizeCss(plain));
    expect(structureFingerprint(commented)).toBe(structureFingerprint(plain));
  });

  it('emits a usable standalone mask rule while global property support differs', async () => {
    const { baroCss } = await compare('mask-linear-from-50%');
    expect(baroCss).toContain('--tw-mask-linear-from-position: 50%;');
    expect(baroCss).toContain('--tw-mask-linear: linear-gradient(var(--tw-mask-linear-stops));');
    expect(baroCss).toContain('var(--tw-mask-radial, linear-gradient(#fff, #fff))');
  });

  it('uses current color and defined shadow fallbacks for inset rings', async () => {
    const { baroCss } = await compare('inset-ring-2');
    expect(baroCss).toContain('--baro-inset-ring-color: currentcolor;');
    expect(baroCss).toContain('var(--baro-inset-shadow, 0 0 #0000)');
    expect(baroCss).not.toContain('rgb(59 130 246 / 0.5)');
  });

  it('uses the same md breakpoint value on both sides', async () => {
    const { tailwindCss, baroCss } = await compare('md:block');
    expect(tailwindCss).toContain('(width >= 48rem)');
    expect(baroCss).toContain('(min-width: 48rem)');
  });
});

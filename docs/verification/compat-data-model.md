# Compatibility catalog: measured local slices

The [catalog](../../packages/barocss/tests/compat/catalog.ts) is the source for the [generated case table](tailwind-compatibility-cases.generated.md). The original slice preserves 15 Tailwind CSS 4.1.13 inputs. A separate follow-up records five additional exact inputs without changing the original baseline. Neither slice establishes a supported Tailwind version or an overall compatibility rate.

Each run holds the exact Tailwind version, BaroCSS commit, comparison settings, environment, date, and evidence paths. Each case holds its origin, syntax family and pattern, representative, boundary, or combination role, exact input, BaroCSS introduction status, CSS structure status, browser behavior status, required BaroCSS declarations when structures differ, and evidence IDs. The 20 recorded cases have `origin: tailwind`. No BaroCSS-only syntax has yet been verified for this catalog. Its introduction version remains `unverified` rather than inferred from the current package version.

Future BaroCSS-only cases use `origin: barocss`. They get their own feature verification and do not count as Tailwind differences or unsupported Tailwind cases. If the same syntax has different meanings in both systems, add a `collision` record with both outputs, reason, example, and evidence. Do not mark such a case as a compatibility pass.

The original [approved structures](../../packages/barocss/tests/compat/approved-structures.json) and [follow-up approved structures](../../packages/barocss/tests/compat/approved-followup-structures.json) store normalized PostCSS nodes and SHA-256 fingerprints for each engine and exact input. Normalization removes comments and formatting only. The comparison tests check both approved structures, both fingerprints, the structure status, and essential BaroCSS declarations for each known difference. A new output cannot pass merely because its broad status is still `different`. The [original raw CSS](tailwind-4.1.13-output.json) and [follow-up raw CSS](tailwind-4.1.13-followup-output.json) remain separate review artifacts. Browser behavior is a separate status; all five follow-up inputs are unverified in a browser.

## Reproduce and review

Use Node 22.22.0 and pnpm 10.11.0. From the repository root:

```sh
pnpm --filter @barocss/kit exec vitest run tests/compat/compare.test.ts
pnpm --filter @barocss/kit exec vitest run tests/compat/compare-followup.test.ts
pnpm --filter @barocss/kit exec vite-node --script tests/compat/export-output.ts /tmp/tailwind-4.1.13-output-new.json
diff -u docs/verification/tailwind-4.1.13-output.json /tmp/tailwind-4.1.13-output-new.json
pnpm --filter @barocss/kit exec vite-node --script tests/compat/export-followup-output.ts /tmp/tailwind-4.1.13-followup-new.json
diff -u docs/verification/tailwind-4.1.13-followup-output.json /tmp/tailwind-4.1.13-followup-new.json
```

If the raw output changes, inspect both CSS outputs and the behavior risk before approving it. Only after that review, replace the tracked raw output and regenerate the approved structures and table:

```sh
pnpm --filter @barocss/kit exec vite-node --script tests/compat/export-approved-structures.ts ../../docs/verification/tailwind-4.1.13-output.json tests/compat/approved-structures.json
pnpm --filter @barocss/kit exec vite-node --script tests/compat/export-approved-structures.ts ../../docs/verification/tailwind-4.1.13-followup-output.json tests/compat/approved-followup-structures.json
pnpm --filter @barocss/kit exec vite-node --script tests/compat/export-summary.ts ../../docs/verification/tailwind-compatibility-cases.generated.md
pnpm --filter @barocss/kit exec vitest run tests/compat/compare.test.ts
pnpm --filter @barocss/kit exec vitest run tests/compat/compare-followup.test.ts
```

Changes to browser behavior status require a separate browser check with the browser version, viewport, state, theme, output, and evidence recorded. A CSS structure change alone does not establish a behavior change or behavior parity.

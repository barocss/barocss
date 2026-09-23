# Generated compatibility case summary

Source: [catalog.ts](../../packages/barocss/tests/compat/catalog.ts). Baseline: `tailwind-4.1.13-baro-6df9af9`.
Tailwind CSS `4.1.13`; BaroCSS commit `6df9af9`; measured 2026-09-23.
CSS environment: Node 22.22.0, pnpm 10.11.0, Vitest 3.2.4. Browser evidence is recorded per input.
Exact Tailwind input and BaroCSS context settings are in the catalog. Preflight is off in this baseline.

Patterns classify syntax; they do not claim support for every value in a family. This first slice has no combination fixture. `verified` browser results apply only to the named scenario. This table is not an overall compatibility rate.

| Origin | Family | Pattern | Role | Exact input | BaroCSS introduced | CSS structure | Browser behavior | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tailwind | display | `block` | representative | `block` | unverified | match | unverified | [C1](tailwind-4.1.13-output.json) |
| tailwind | display | `hidden` | representative | `hidden` | unverified | match | unverified | [C1](tailwind-4.1.13-output.json) |
| tailwind | layout | `overflow-<mode>` | representative | `overflow-hidden` | unverified | match | unverified | [C1](tailwind-4.1.13-output.json) |
| tailwind | typography | `text-<alignment>` | representative | `text-center` | unverified | match | unverified | [C1](tailwind-4.1.13-output.json) |
| tailwind | spacing | `p-<scale>` | representative | `p-4` | unverified | different | unverified | [C1](tailwind-4.1.13-output.json) |
| tailwind | spacing | `-mt-<scale>` | boundary | `-mt-4` | unverified | different | unverified | [C1](tailwind-4.1.13-output.json) |
| tailwind | color | `bg-<theme-color>` | representative | `bg-red-500` | unverified | match | unverified | [C1](tailwind-4.1.13-output.json) |
| tailwind | arbitrary-color | `bg-[<color>]` | representative | `bg-[#ff0000]` | unverified | match | unverified | [C1](tailwind-4.1.13-output.json) |
| tailwind | state-variant | `focus:<utility>` | representative | `focus:block` | unverified | different | unverified | [C1](tailwind-4.1.13-output.json) |
| tailwind | state-variant | `hover:<utility>` | representative | `hover:block` | unverified | different | verified: Chromium 153.0.8010.53; desktop hover before/after; touch tap; viewport unrecorded | [C1](tailwind-4.1.13-output.json), [B1](https://github.com/barocss/barocss/issues/67#issuecomment-5787601039) |
| tailwind | responsive-variant | `md:<utility>` | boundary | `md:block` | unverified | different | verified: Chromium 153.0.8010.53; viewport 767/768/769px | [C1](tailwind-4.1.13-output.json), [B1](https://github.com/barocss/barocss/issues/67#issuecomment-5787601039) |
| tailwind | grid | `grid-cols-<count>` | representative | `grid-cols-2` | unverified | match | unverified | [C1](tailwind-4.1.13-output.json) |
| tailwind | effects | `inset-ring-<width>` | representative | `inset-ring-2` | unverified | different | verified: Chromium 153.0.8010.53; recheck 153; 100×100 probe, color #1246b4 with currentcolor ring; viewport unrecorded | [C1](tailwind-4.1.13-output.json), [B1](https://github.com/barocss/barocss/issues/67#issuecomment-5787601039), [browser recheck](https://github.com/barocss/barocss/pull/71#issuecomment-5788063380) |
| tailwind | forms | `field-sizing-<mode>` | representative | `field-sizing-content` | unverified | match | unverified | [C1](tailwind-4.1.13-output.json) |
| tailwind | effects | `mask-linear-from-<percent>` | representative | `mask-linear-from-50%` | unverified | different | verified: Chromium 153.0.8010.53; recheck 153; 100×100 probe, 50% mask position; viewport unrecorded | [C1](tailwind-4.1.13-output.json), [B1](https://github.com/barocss/barocss/issues/67#issuecomment-5787601039), [browser recheck](https://github.com/barocss/barocss/pull/71#issuecomment-5788063380) |

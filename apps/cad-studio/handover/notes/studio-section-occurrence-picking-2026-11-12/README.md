# D772 — Verify Studio section clipping and occurrence picks

P4 B10-03, rows 05, 16 and 20. SMALL qualification. Parent `c068f6805cbfbc41b9d91204fd61aa1fec293944`. [B10 v1 evidence ledger](../../roadmap-tracks/17-b10-evidence-ledger.md) · [D720](../notes/thin-section-span-2026-11-12/README.md).

- **PASS** — Studio opens two identical 30 × 12 × 6 mm occurrences. Both accept public pointer selection before the cut. Section across X keeps the right occurrence and clips the left at X = 45 mm. Flip exchanges their roles. Clicks select the visible occurrence and leave selection empty at the clipped occurrence. Turning off Section restores both picks.
- **PASS** — Fixed desktop projection. At the two projected centres, the 5 × 5 pixel averages change from [196,199,210] and [195,199,209] to [34,36,39] only on the clipped side. The visible side is pixel-identical. Removing the cut restores both original samples, the exact accepted document, history and clean status. Five actual Studio states and eight public pointer actions. Reviewed the right-side selected state.
- **PASS** — Independent Python classifies the translated native bounds against the plane. Each occurrence has volume 2160 mm³ at relative tolerance 1e-9. Both source bounds stay 15 mm clear of the plane. The run retains 797 frozen files and reports zero page errors, console errors or downloads.
- **PASS** — Studio 25/25 focused checks, Model type check, driver syntax and diff check.
- **FAIL** — None in this run.
- **NOT_RUN** — Generated cap picking, nested placements, CPU/WebGL section, other devices, full suites, builds and mobile.

```sh
D772_SOURCE_FROZEN=1 node apps/cad-studio/test/section-instance-picking-browser.mjs "$EVIDENCE/studio-first"
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test section-span section-planes section-view section-cutout section-hatch selection-edge
pnpm --dir packages/barocss-cad-model type-check
node --check apps/cad-studio/test/section-instance-picking-browser.mjs
git diff --check
```

B10 is pending at 3/7. Initial scenarios remain 7/10. Whole CAD and core readiness remain **NOT_MEASURED**. D773 checks Viewer resize, replacement and resource ownership.

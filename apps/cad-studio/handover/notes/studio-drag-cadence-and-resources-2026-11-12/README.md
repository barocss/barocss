# D774 — Measure Studio drag cadence and retained geometry

P4 B10-05, rows 05, 16 and 20. SMALL qualification. Parent `c14a2bbf4fa4801c5b0f7c327262b384bfccd643`. [B10 v1 evidence ledger](../../roadmap-tracks/17-b10-evidence-ledger.md) · [D515 slow drag](../slow-drag-cadence-current-2026-11-04/README.md).

The workload is the in-repo 60 × 40 × 20 mm Box with two holes and two top fillets. Use one 36-move warmup, then three measured repeats. Each sends 36 real pointer moves of 2 CSS pixels along the width handle, with a nominal 16 ms interval and 900 ms hold. Capture screenshots after the timed interval. Escape cancels each edit and keeps the exact accepted document.

## Observed result

Apple M3 Max, 14 CPU cores, arm64, Darwin 24.6.0, Headless Chrome 157.0.0.0 and the active Studio GPU device's reported Apple Metal 3 architecture. Desktop 1440 × 1000 at DPR 1, canvas 1140 × 1000. One-minute host load was 28.5 before and 26.8 after.

| Repeat | Browser frame intervals | Frame median / p90, ms | Worker reply median / p90, ms | Width change median, ms | Retained geometry samples |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 52 | 16.7 / 16.7 | 15.9 / 20.1 | 133.4 | 53 at 4 |
| 2 | 50 | 16.7 / 16.7 | 15.6 / 19.4 | 133.3 | 51 at 4 |
| 3 | 50 | 16.7 / 16.7 | 15.2 / 16.0 | 133.3 | 51 at 4 |

- **PASS** — All 108 measured pointer moves reach Studio. All 21 measured preview requests return the whole part. Each drag shows integer width values 60 through 66 mm. None of the 152 measured browser frame intervals exceed 50 ms. Geometry stays at four objects across 155 measured read-only Core samples. The table reports browser animation callbacks, Worker round trips and HUD value changes as separate measurements.
- **PASS** — Five measured desktop states and seven ordinary regression states. Reviewed one released preview. Both runs retain 332 frozen files and report zero page errors, console errors or downloads. Studio 37/37 focused tests, Model type check, driver syntax and diff check.
- **FAIL** — None in these runs.
- **NOT_RUN** — Physical display presentation latency, VRAM bytes, broader scene or hardware performance, full suites, production builds and mobile. The result establishes one workload baseline without a product-wide speed target.

```sh
D774_MEASURE=1 DRAG_TIMING_SOURCE_FROZEN=1 node apps/cad-studio/test/drag-preview-timing-browser.mjs "$EVIDENCE/studio-measured-first"
DRAG_TIMING_SOURCE_FROZEN=1 node apps/cad-studio/test/drag-preview-timing-browser.mjs "$EVIDENCE/ordinary-regression"
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test command-drag-wall stop-work-ownership
pnpm --dir packages/barocss-cad-model type-check
node --check apps/cad-studio/test/drag-preview-timing-browser.mjs
git diff --check
```

B10 is pending at 5/7. Initial scenarios remain 7/10. Whole CAD and core readiness remain **NOT_MEASURED**. D775 checks CAD React props A→B→A in the existing Viewer and edits the exact returned Doc in Studio.

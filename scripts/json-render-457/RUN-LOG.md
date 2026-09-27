# #457 run chronology

- `c03f58e1`: first baseline freeze. `d916140b`: 12 cases drafted after that freeze.
- `251b08eb`: radius correction to 14px; Review accepted this baseline only. The eight-cell smoke established equal initial computed styles across arms and viewports.
- First 192-cell diagnostic attempt on manifest `d3ad115d…` exposed a missing per-component prop validation check. Its raw row file and screenshots were overwritten before a retention request; `evidence/diagnostic-attempt-1.json` preserves only actual console summary, negative probes and four known row IDs, and explicitly lists missing original artifacts. It is excluded from final denominators.
- Strict per-component Zod validation was added before rendering/preloading without changing cases, catalog vocabulary, CSS inventories, dependencies or viewports. Manifest `b5c47fbd…` refroze the corrected adapter. Baseline smoke again passed eight equal cells.
- The second 192-cell run with the corrected adapter and manifest is preserved in `evidence/corrected-pre-delta/`. It passed all frozen-supported cells and rejected three invalid values. It did not yet record generated CSSOM rule/byte deltas and is not the final decision dataset.
- The authoritative primary run uses the same corrected manifest and a runner that records CSSOM deltas, six policy negatives, and independent frozen-support and observed-requirement fields. Its output is stored separately under `evidence/primary-b5c47fbda88f/`; the runner refuses to overwrite an existing result. Final denominators and conclusions use only this dataset after verification.

The first attempt's four build-control one-column computed matches are real observations: an absent `grid-cols-1` token removed the compiled `grid-cols-2` rule, leaving the browser default of one grid column. Rule support stays false; observed layout satisfaction stays true. This is not evidence of a generated rule.

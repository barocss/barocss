# #458 saved Codex JSON corpus: bounded result

This is a redacted report for the private profile-form prototype. The raw Codex responses, CLI events, and screenshots remain in the private V3 evidence directory. No model output or screenshot is embedded here. The renderer package remains in [`packages/barocss-render/`](../../packages/barocss-render/); this directory contains the study runner.

## Provenance and coverage

- Frozen generation task commit: `e3d5c0d266ec3c7e7d5240ef83f31a8f614d019b`.
- Frozen plan SHA-256: `13b3237609e19d5dbc76c980a9d04606781b95741ef31c4edd1efc3ef0565a04`.
- Private corpus manifest SHA-256: `654072ba9f47a4e1e85b267587ebdf09a38e0cd53d2f2a14fd76515fe1800155`.
- Private replay report SHA-256: `e58b0187bba5958f08db1dfcb931f657448c71a177f1d105e8d6d3e8377df5ec`.
- The [independent pre-launch Review](https://github.com/barocss/barocss/issues/458#issuecomment-5863072912) accepted the exact generation commit and plan before collection. Saved lineage and comparison still require final independent Review.

The aggregate allowance was 20 CLI dispatches. Four were already consumed by #460: one stopped startup attempt without a usable final, one prompt-v1 schema-invalid final, and one valid prompt-v2 two-turn proof. The #458 runner then reserved and completed 16 new dispatches, in eight independent sessions, with no automatic retry. All 16 new finals passed the shared schema and frozen initial/next semantic checks. The corpus therefore contains nine valid two-turn pairs when the accepted #460 prompt-v2 calibration pair is included. Row 10 was not attempted because the aggregate ceiling was reached. The two earlier #460 attempts are counted but are not presented as prompt-v2 corpus samples.

| Row | Frozen request focus | Initial | Next | Replay and requested content |
| --- | --- | --- | --- | --- |
| 01 | #460 calibration form, Bea | Valid | Valid | Both arms; save, exact name, layout passed |
| 02 | Korean light form, 서연 | Valid | Valid | Both arms; Korean script check passed; short labels read naturally in manual review |
| 03 | Exact English heading and labels, Zoë | Valid | Valid | Both arms; exact text checks passed |
| 04 | Dark form, O'Neil | Valid | Valid | Both arms; dark form card and exact name passed |
| 05 | Single column, spacious padding, Alex Chen | Valid | Valid | Both arms; form layout and exact name passed |
| 06 | Responsive form and separate help card, Morgan | Valid | Valid | Both arms; two cards and narrow layout passed |
| 07 | Compact fractional spacing, A | Valid | Valid | Both arms; spacing and exact name passed |
| 08 | Dark, wide gaps, spacious padding, Jean-Luc | Valid | Valid | Both arms; combined style checks passed |
| 09 | Exact Korean heading and labels, 민수 Kim | Valid | Valid | Both arms; exact text and mixed-script name passed |
| 10 | Explanatory help text, Avery Taylor Morgan | Ceiling skip | Ceiling skip | No model or renderer result |

Each valid pair was replayed from the same saved `specJson` string in both the private renderer and the installed official json-render adapter. Neither arm generated new JSON. At 1200px and 390px, all 9 pairs had a recorded input/save action, preserved name state, visible exact name in the next screen, and no horizontal overflow or page error. The replay produced 72 private screenshots. All 72 screenshot digests matched the report; the 36 paired stage/viewport comparisons recorded equal screenshot bytes, layout measurements, and state for this run. The two-card narrow screenshot was also visually inspected. No adapter failure or renderer defect was observed in this supported sample. Invalid generated outputs would remain in the generation denominator; none occurred in the 16 new turns.

## Separate timings

These figures are descriptive single-run observations, not a speed or superiority claim. They use nine valid samples per stage, including the #460 calibration. CLI generation elapsed time includes process and model work. JSON read/parse/shared validation and browser render apply are separate measurements.

| Stage / measure | Samples | Minimum | Median | Maximum |
| --- | ---: | ---: | ---: | ---: |
| Initial CLI generation | 9 | 8,138 ms | 10,095 ms | 10,827 ms |
| Next CLI generation | 9 | 7,123 ms | 8,058 ms | 10,351 ms |
| Initial read, parse and validation | 9 | 0.04 ms | 0.05 ms | 0.34 ms |
| Next read, parse and validation | 9 | 0.03 ms | 0.04 ms | 0.10 ms |
| Private renderer initial apply | 9 | 2.5 ms | 2.7 ms | 2.9 ms |
| Official adapter initial apply | 9 | 3.8 ms | 4.3 ms | 4.6 ms |
| Private renderer next apply | 9 | 0.6 ms | 0.6 ms | 0.7 ms |
| Official adapter next apply | 9 | 0.5 ms | 0.6 ms | 0.7 ms |

The browser timings above are apply measurements; they are not full user-perceived latency. #460 separately observed first-visible and action-to-next-visible times for its single live browser proof. The update granularity here is one complete JSON response per turn, not streaming.

## Limits and reproduction

All requests were synthetic profile forms inside the fixed five-component contract. The result does not measure arbitrary UI, unsupported components, real persistence, payment, or a general model or renderer advantage. The Korean-language manual check covered the short visible labels in row 02; it is not a broad localization evaluation. Row 10 needs a separate authorized cohort if its explanatory content matters. No request in the attempted rows required vocabulary outside the frozen contract.

On the original V3 host, run the no-model `verify.mjs --claim` and `replay.mjs --claim` commands in [README](README.md) to inspect private lineage and saved-data replay. The accepted generation claim cannot be run again. Screenshots and raw results must remain private. Final independent Review, local `develop` integration, and Issue closure are separate steps.

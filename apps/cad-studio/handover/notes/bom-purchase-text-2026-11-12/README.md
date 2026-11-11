# D732 — Preserve purchase labels as spreadsheet text

P0, rows 10 and 16, B05. FEATURE qualification. Parent `90837bfb29a5d40f34f1e12f41cc0719e75ace27`. [#2428](https://github.com/barocss/barocss/issues/2428).

Studio, the agent output and `Assembly.purchaseCsv` continue to use one generator. It adds one apostrophe inside a quoted cell for formula-like text, including ASCII and full-width prefixes after leading whitespace, controls or apostrophes. Leading control and format characters also trigger protection. Commas, semicolons, quotes, tabs, CR and LF stay inside quoted cells. Number values keep their numeric serialization. BOM JSON and the native document retain exact authored values. A plain CSV parser returns the protective apostrophe as part of the exported cell. This qualification covers initial import. A spreadsheet can remove protection when it writes a new CSV. [MITRE CWE-1236](https://cwe.mitre.org/data/definitions/1236.html), [OWASP CSV Injection](https://owasp.org/www-community/attacks/CSV_Injection).

## Qualification

- **FAIL (parent)** — The Studio purchase CSV contained the eight authored labels as raw text. Calc read `B2` as formula `1+1` with cached value 2. The baseline browser passed the reproduction and matched generator, agent and public API bytes. It intercepted the generated Blob at the download anchor.
- **PASS** — Actual Studio still shows all eight original labels. Bought-only export contains the header because the fixture has only made parts. With made parts included, the Studio Blob matches generator, agent and public API byte-for-byte. Python's strict CSV parser reads eight rows of nine cells and finds the expected prefix in six cells. It reads nine cells per row in a separate three-row matrix with size, row, catalogue, source, prefix controls, full-width signs and embedded separators. The native document, history and BOM JSON labels stay identical. Revision `fa7bbed8177aad456b6df7b740ef963122c24c46b354f1745bab63aa7ce8f6ca`. Two Studio states over 1,005 frozen sources, zero page errors, console errors and browser downloads.
- **PASS** — Installed LibreOfficeDev Calc `26.8.0.0.alpha0 2c87e51eeaa2b413ff4ae097b2705eea1995d8e5` reads both current CSV files with UTF-8, comma separator, double-quote delimiter, US English 1033, standard columns, formula evaluation enabled and quoted-field-as-text disabled. Both converted sheets contain zero formula elements. Protected cells have string type and quantities have number type. Calc's standard-column detection converts `00123` to numeric 123 and normalizes CR to LF within cells. The CSV parser and BOM JSON retain the original lexical content. [LibreOffice CSV filter options](https://help.libreoffice.org/latest/en-US/text/shared/guide/csv_params.html).
- **PASS** — D707 and D706 desktop replays passed eight and six states, including currentness, failure recovery and native project reopen. Model 50/50 and Studio 12/12, both type-checks, affected lint, driver syntax, production build and diff check passed. The first combined Model run exposed an inherited assertion about six output tools. A bundle with the parent purchase implementation reproduced the failure. The test now names the seven registered tools, including requirement evidence, and checks stale revision refusal for each.
- **NOT_RUN** — Excel, Numbers, other Calc locales, spreadsheet re-export, OS browser download, full suites and mobile. B05 remains unadjudicated as a whole.

| Input or output | Bytes | SHA-256 |
| --- | ---: | --- |
| Native assembly | | `13399ea50649882370ca59d6d6fd52e2950ba94844a4c4f7b85f86362ae2258d` |
| Parent Studio CSV | 230 | `02c4f5adbe2f12459065ac90e6f3c4b9c73980bc1a2ca338d89f989301d29fa0` |
| Current Studio CSV | 248 | `850734ebcea0cb41504982bfd74b3cc4a1bbbe2b92e33a89c722726dc41fb7af` |
| Current metadata CSV | 245 | `002a69259840babc52f452833430f9a99890b97d97aace7992e79807e0d36d17` |

Node 22.19.0, existing Chrome and Playwright. Run serially under the heavy gate and keep evidence outside Git. Use separate output directories for the parent and current Calc runs. Check `xl/worksheets/sheet1.xml` and `xl/sharedStrings.xml` with Python's ZIP and XML readers.

```sh
D732_SOURCE_FROZEN=1 node apps/cad-studio/test/bom-purchase-text-browser.mjs "$EVIDENCE/baseline-valid" --baseline
D732_SOURCE_FROZEN=1 node apps/cad-studio/test/bom-purchase-text-browser.mjs "$EVIDENCE/studio-final"
D707_SOURCE_FROZEN=1 node apps/cad-studio/test/bom-nested-currentness-browser.mjs "$EVIDENCE/d707-replay"
D706_SOURCE_FROZEN=1 node apps/cad-studio/test/bom-currentness-browser.mjs "$EVIDENCE/d706-replay" --expect=project
TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test bom chat-outputs api-outputs
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test bom-linked-ui bom-nested-ui
pnpm --dir packages/barocss-cad-model type-check
pnpm --dir apps/cad-studio type-check
pnpm exec eslint packages/barocss-cad-model/src/{api/assembly,bom/bom,chat/outputDefinitions}.ts packages/barocss-cad-model/test/{bom-purchase-text,chat-outputs}.test.ts
node --check apps/cad-studio/test/bom-purchase-text-browser.mjs
pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/studio-dist"
soffice --headless "-env:UserInstallation=file://$EVIDENCE/lo-current" '--infilter=Text - txt - csv (StarCalc):44,34,76,1,,1033,false,true,false,false,false,0,true' --convert-to xlsx --outdir "$EVIDENCE/consumer-current" "$EVIDENCE/studio-final/purchase.csv" "$EVIDENCE/studio-final/purchase-metadata.csv"
git diff --check
```

Next D733 checks whether the DXF profile reader projects LINE endpoint Z or LWPOLYLINE elevation into an unintended editable XY region. [#2297](https://github.com/barocss/barocss/issues/2297). Initial scenarios remain 5/10. Whole CAD and core readiness remain **NOT_MEASURED**.

# D731 — Refuse coincident DXF bulge endpoints

P0, rows 13 and 16. FEATURE qualification. Parent `42a59a82c8ffc5a7b5df459f6f565e550af5c26f`. [#2434](https://github.com/barocss/barocss/issues/2434).

LWPOLYLINE and POLYLINE group 42 encode the signed arc between successive vertices. A nonzero bulge needs a chord of positive length. Both profile and block-underlay paths now use the same decoder and return `DXF_MALFORMED` for an exact duplicate endpoint pair. The exact chord check precedes the existing small-angle straight-segment cutoff. The D725 endpoint joining tolerance stays separate. The decoder also refuses nonfinite derived chord or center and nonfinite or zero radius. The consumers refuse a nonfinite measured bulged loop or a nonfinite transformed arc sample. [Autodesk LWPOLYLINE](https://help.autodesk.com/cloudhelp/2020/ENU/AutoCAD-DXF/files/GUID-748FC305-F3F2-4F74-825A-61F04D757A50.htm), [Autodesk VERTEX](https://help.autodesk.com/cloudhelp/2016/ENU/AutoCAD-DXF/files/GUID-0741E831-599E-4CBF-91E1-8ADBCFD6556D.htm).

## Qualification

- **FAIL (parent)** — A bundled reader counted nonfinite numbers before JSON serialization in all four authored inputs. The two profile reads each returned three nonfinite values, and the draft had two. The two block reads each returned ten and passed all ten into the draft or underlay. Actual Studio adopted all four. Both block imports raised `GEOMETRY_INVALID` from viewport overlay construction. The first browser attempt timed out after the underlay error prevented Undo. An isolated run captured all four cases over 794 frozen inputs and exited 1 on the two real page errors.
- **PASS** — Current Model and desktop Add drawing return the same typed refusal for the four fixtures. The accepted document, draft, underlay, body list, history, pending Redo and dirty indicator stay identical. An ordinary two-bulge hole has independently expected area 4π mm² inside a 200 mm² rectangle. Studio extrudes it 3 mm at 562.3008881569228 mm³ against the analytic 600−12π mm³. Undo, Redo, browser-project Save and fresh Open preserve the exact accepted state and body. Eight desktop states over 795 frozen inputs, zero page errors, console errors and downloads. Native SHA-256 `6fc047482b01c145c477782582f311132da18ae3673713f78698cfbaf0500fd1`.
- **PASS** — Model 38/38. The focused tests cover both polyline encodings, either sign, a sub-cutoff nonzero bulge, open and closing segments, standalone and neighboring geometry, and block-only and mixed imports. Closed-form semicircles, quarter-circle area, complete holes, a 2e-6 mm profile chord and a 2e-9 mm block chord retain their geometry. Tests also cover inches, metres, reflected nonuniform rotated block placement, straight duplicates, chord and radius overflow, radius underflow, profile area overflow and nonfinite transformed samples. A Sol High source and numeric review supplied independent expectations before implementation.
- **PASS** — D730 and D725 desktop replays passed ten and nine states. Studio 38/38, both type-checks, affected lint, driver syntax, production build and diff check passed.
- **NOT_RUN** — Full suites, mobile, third-party DXF applications, extreme-coordinate rendering qualification beyond the recorded derived-value guards, and other curve families.

The same authored fixture bytes were used for parent and current runs.

| Fixture | SHA-256 |
| --- | --- |
| LWPOLYLINE profile | `42e43dd4fc52c897c7a9a5584093bad780ed7fa45499d957af17c6edf5cc4fcf` |
| R12 profile beside a valid rectangle | `c637abafcb93bd52c63526a3a271382eb5385f8918da216631d200eddd401ed0` |
| LWPOLYLINE block-only | `8df5227daf53f7fec6b27296a40a2ef8ffdbfcd27d5dc0f4089ebfd5cdbd494a` |
| R12 block beside a valid rectangle | `82b3c3e9b6e253c91256a61e9a903909ae4574382f05bf673e5138858f4d25d9` |
| Valid two-bulge hole control | `c3def93da91e3656c92a9ac3f3831defbbfc061e4001f2a0c5fa202b676c1ad5` |

Node 22.19.0, existing desktop Chrome and Playwright. Run serially under the heavy gate and use an external evidence directory.

```sh
D731_SOURCE_FROZEN=1 node apps/cad-studio/test/dxf-zero-chord-browser.mjs "$EVIDENCE/baseline-matrix" --baseline
D731_SOURCE_FROZEN=1 node apps/cad-studio/test/dxf-zero-chord-browser.mjs "$EVIDENCE/studio"
D730_SOURCE_FROZEN=1 node apps/cad-studio/test/dxf-visibility-browser.mjs "$EVIDENCE/d730-replay"
D725_SOURCE_FROZEN=1 node apps/cad-studio/test/dxf-local-gap-browser.mjs "$EVIDENCE/d725-replay"
TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test dxf drafts
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test draft project-open-ownership
pnpm --dir packages/barocss-cad-model type-check
pnpm --dir apps/cad-studio type-check
pnpm exec eslint packages/barocss-cad-model/src/sketch/dxf{Bulge,Read,Underlay}.ts packages/barocss-cad-model/test/dxf-zero-chord.test.ts
node --check apps/cad-studio/test/dxf-zero-chord-browser.mjs
pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/studio-dist"
git diff --check
```

Next D732 checks whether purchase CSV can reinterpret an accepted part name as a spreadsheet formula. [#2428](https://github.com/barocss/barocss/issues/2428). Initial scenarios remain 5/10. Whole CAD and core readiness remain **NOT_MEASURED**.

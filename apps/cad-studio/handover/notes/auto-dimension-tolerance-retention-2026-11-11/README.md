# D696 — Keep authored tolerances when Auto-dimension runs again

P2 B06, row 11. [#2365](https://github.com/barocss/barocss/issues/2365). FEATURE verification for drawing annotation ownership. Parent `02114daba2bf1bd38c1569dee88dae31486b5c05`.

## Decision

Keep an existing dimension when it was placed manually or it has a tolerance, a basic mark or an attached feature control frame. Keep its ID, source references and `auto` provenance. Both Auto-layout and the issue fix use this rule. View selection and front orientation also respect retained dimensions. The existing dependency check suppresses equivalent linear dimensions. Pitch-circle identity includes its member references. A lost measurement keeps its annotation and the existing lost-reference issue. Auto never transfers its tolerance to a new dimension. None clears the tolerance and allows an otherwise unprotected auto dimension to be regenerated. Escape clears an uncommitted field value.

## Actual desktop Studio

**PASS.** Chrome WebGPU at 1440 × 1000. Open a 40 × 12 × 6 mm plate and run Auto. Author ±0.05 on front width `d2`, remove one unedited control, then rerun Auto. The control returns and exactly one width keeps its source references and ±0.05. The first Undo restores the two-dimension document and the first Redo restores the three-dimension document. Capture native Save bytes, close the browser context and Open those bytes in a fresh context. The restored document matches the accepted document.

Escape restores ±0.05 after a draft 0.07. Enter rejects −1 and leaves the document exact. Tab and Enter commit +0.10/−0.02. Rerun retains those values and then H7. None followed by Auto leaves all dimensions without tolerances. Edit the original sketch width from 40 to 48 mm through the feature editor. The original width resolves to 48 before Auto and remains unique at 48 ±0.05 after Auto. The existing hidden-line issue is visible on the resized drawing.

**PASS.** The standalone SVG and DXF 2000 bytes come from the reopened 40 mm document. ElementTree and ezdxf 1.4.5 read three dimensions each and exactly one 40 ±0.05. DXF audit reports zero errors and zero fixes. Its millimetre dimension stores measurement 40 and has the correct display text in its block. The literal source width and authored tolerance give 39.95–40.05 mm.

## Verification

- **PASS.** With Node 22.19.0, existing Chrome, Playwright and ezdxf, run `D696_SOURCE_FROZEN=1 node test/auto-tolerance-browser.mjs "$EVIDENCE"` from Studio under the heavy gate. The final receipt SHA-256 is `f553a5058d70d8d510a9ad6876f95b54153a91e89a3cbc19eb97dde7b0d4a4df`. All 326 frozen paths match through cleanup. Zero page errors, console errors, watched source changes or browser downloads.
- **PASS.** `pnpm --filter @barocss/cad-model test auto-dimension auto-layout reorient drawing-standalone-frame-consumer drawing-issues drawing-tolerance-printable` passed 53/53. The cases cover both automatic entry points, a manual control, repeated and resized measurements, the original lost reference, an equal-size hole with a distinct source ID, an accepted basic/frame reference and an authored pitch-circle tolerance. `pnpm --filter @barocss/cad-studio-app test drawing-commit-roundtrip` passed 4/4. Model and Studio type checks, driver syntax, scoped ESLint and Git whitespace passed.
- **FAIL, original product.** Auto regenerated `d2` with the same measurement and discarded ±0.05. Receipt `ab279062a8d3129d23a38fa5976286fca7e61b704992e9ef9449991d3c913a1f`. Before the field fix, Escape left 0.07 in the draft field. Receipt `355e12e37957a131c28583caf0530dd996c0481d49bf3926ac42e97c5c0097fb`.
- **FAIL, interim verification.** The first distinct-hole fixture did not identify the intended separate target. The final fixture uses a distinct source node. The first Model type check and scoped lint found test declaration errors that the final checks clear. One desktop runner used the same evidence name for the input and Save bytes. The final runner uses exclusive writes and a separate output name. Interim receipt `15aa385196fa6b54b5674fdac10912eec602e6063b984d46cae97393e3248f68`.
- **FAIL, parent comparison.** The expanded Model command using `tolerance` instead of `drawing-tolerance-printable` passed 57/61. The four R14.4 suggestion-layout cases reported `TEXT_OVER_LINES`. Rebundling the unmodified suggestion tests with the three drawing source files from the exact parent reproduced the same four failures. Parent output SHA-256 `48d5de4ab1bebff94eb542ac3bcbacff76db923ef60589beb9857ea59ce43e7b`.
- **NOT_RUN.** Full suites, PDF, DXF R12 and browser-managed downloads. The issue is bounded to retaining authored controls through automatic regeneration. Whole B06 remains unadjudicated. The initial scenarios remain 5/10 accepted. Whole CAD and core readiness remain NOT_MEASURED.

Next D697 checks Auto-layout when every candidate fails. Reproduce the first failure, verify explicit refusal and preserve the current drawing. [#2406](https://github.com/barocss/barocss/issues/2406)

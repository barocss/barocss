# Standalone Text browser evidence — 2026-10-28

Source checkpoint: `0f836e8f2`. Actual desktop Chrome/WebGPU, viewport 1440x900, DPR 1.
These are automated browser actions, not manual acceptance or complete glyph/font certification.

- Flow 34: ABeeZee ` A ` at em 10/height 2 → volume 29.7594; edit to ` AA ` → 59.5188. A later independent Box
  remains. Undo/Redo and raw-TTF BCADPACK Save/Open followed by text editing pass.
- Flow 35: Nanum Gothic and Nanum Myeongjo `가한` at em 20/tolerance 0.002/height 2 create and reopen from `.bcad`.
- `text-korean-myeongjo-reopened.png` is an unchanged copy of
  `/tmp/barocss-text-browser/35a-text-korean-myeongjo-reopened.png`, 261007 bytes. It exceeds the public SHOTMAX,
  so it is retained here without image transformation.
- The unchanged Latin image `/tmp/barocss-text-browser/34a-text-applied.png`, 178171 bytes, is also copied to
  `apps/library-docs/docs/public/shots/studio/features/text-applied.png` for `/how/text`.

Composition-Enter guards were checked with synthetic events only. Native operating-system IME input was NOT RUN.
This evidence does not cover shaping, kerning, bidi, normalization, emboss/engrave, wrap, arbitrary fonts, all glyphs,
WebGL2/mobile/GPU fault cases or the full browser suite. The same runtime checkpoint passes full kernel1981/0/6 skips
(1987 total), Model1792/1792 and Studio364/364, with types/lint and generated/docs checks passing (68 pages,51 shots,
838 labels). D293–D295 record the complete boundary. The image pixels are unchanged.

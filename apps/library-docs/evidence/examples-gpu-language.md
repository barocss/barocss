# Bounded GPU language example receipt

Source pin: `5f5ad866205a21510ac69552e704cc162fa253b5`.

Native execution: Node `v22.22.0`, existing esbuild, own public package imports, 222 own source inputs and 0 own dist inputs.

```sh
node apps/library-docs/scripts/run-example.mjs apps/library-docs/scripts/snippets/gpu-language-example.ts
```

Exit status: 0.

Observed assertion results:

- Source0 cascade radii `[0.5,2]`: ID specificity and later type declaration behavior.
- Source1 SDF schema version2: `sphere`, `box`, `cylinder`, `capsule`, `rounded-box`, `torus` in declaration order.
- `blend`, `pulse`, `ease`, `shape`, `angle` materials compiled and lowered.
- Their original uniform layouts: `amount`, `timeSeconds`, `amount`, `amount`, `angleDegrees`.
- Wrong box `radius` was refused with `VALIDATION`.
- Declared mix ratio range-1..1 was refused with `RANGE`.

The saved input uses smoothstep, RGB literals, sin, pow, min/max, radians and abs. This receipt covers the exact saved programs and assertions. It is a CPU-only check. It does not draw, establish all expression combinations, emitted types, currentRoot integration or publication. Actual scene/material screenshots and browser edit/refusal checks are recorded separately by the portal's visual evidence.

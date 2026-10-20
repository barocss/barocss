# Conformance fixtures

Implementation-independent cases for the CAD kernel: each is an input (a part document, the public
`barocss-cad-part` JSON format) and the outputs any implementation must produce. They are the spec's
executable half: a fresh implementation passes when it reproduces every expectation here. They also serve
as goldens for the robustness track (RB). Not published with the package.

Every roadmap step (R… / RB…) adds its cases under a folder named after it, together with a decision record in
`apps/cad-studio/handover/decisions.md`. `test/conformance.test.mjs` checks every case against this kernel.

## Case format (`<step>/<name>.json`)

```jsonc
{
  "id": "r2-sewn-cube",               // unique, matches the file name
  "step": "R2",                       // the roadmap step that added it
  "decisions": ["D14"],               // decision records it pins (decisions.md)
  "about": "one sentence: what it checks",
  "input": { "partDocument": { "format": "barocss-cad-part", "version": 1, ... } },
  "expect": {
    // Either the outputs (in order), or the error the document is refused with.
    "outputs": [{
      "volumeMM3": { "value": 1000, "relTol": 1e-9 },     // optional "absTol" (mm³): a floor for tiny volumes
      "centroidMM": { "value": [5, 5, 5], "absTol": 1e-9 },
      "areaMM2": { "value": 600, "relTol": 1e-9 },  // optional: the surface area over the exact surfaces
      "bodies": 1,                                  // separate solid bodies in this output
      "topology": [{ "shells": 1, "genus": 0 }],    // per body: closed shells and genus (Euler–Poincaré)
      "faceNames": ["s.surface0", "..."],           // optional: distinct face names, "#k" numbering removed, sorted
      "faceNamePattern": "^m\\.facet\\d+$",         // optional instead: every face name matches
      "tessellation": { "segmentsPerQuarter": 8, "watertight": true },  // optional: every edge in exactly two triangles, by exact position
      "decimate": { "trianglesAtMost": 12, "hausdorffMMAtMost": 1e-9 },  // optional: a decimated mesh's report (R9): its triangles, its measured distance both ways
      // optional: a sheet-metal body's rules and its bends in order (R12): names, angles and allowances θ(R + K·T) to absTol
      "sheet": { "thicknessMM": 2, "bendRadiusMM": 3, "kFactor": 0.4, "absTol": 1e-9, "bends": [{ "name": "c.bend1", "angleDegrees": 90, "allowanceMM": 5.969 }] }
    }],
    "error": { "code": "GEOMETRY", "messageIncludes": "not closed" },
    // Optional: all outputs written to one STEP file and read back are strictly valid (names unique) and
    // keep their total volume and area to relTol.
    "stepRoundTrip": { "relTol": 1e-6 },
    // Optional: a SubD feature's promises (D78/D79) on its cage, as bounds: G1 between faces along smooth edges,
    // the seams closed, the caps' largest distance from the Catmull–Clark limit, and no degenerate point
    // (|Su × Sv| against its cap's median) or fold (the turn between neighbouring normals on a 33 × 33 grid) in a cap.
    "subd": { "feature": "clamp", "g1MaxAngleDeg": 1e-5, "maxGapMM": 1e-12, "capDeviationMaxMM": 0.02, "minJacobianRatio": 0.05, "maxNormalTurnDeg": 15 }
  },
  "oracle": "how the expected values were obtained (closed form, an independent tool, or this kernel)",
  "notes": "optional: known open items the case shows, with their numbers (not checked)",
  // Optional: a later step changed what this case pins (a refusal it now builds). Kept as the record; not run.
  "supersededBy": { "step": "R7", "why": "…" }
}
```

Rules:
- Tolerances are part of the spec. A relative volume tolerance applies to |actual − expected| / |expected|,
  with the volume's optional absTol (mm³) as a floor (a sliver's volume is known absolutely, to rounding);
  other absTol values are in mm.
- Every output must pass the strict L0 validation (topology; edges on their surfaces; loops that do not
  cross or touch; no slivers; tolerances under 1e-3 of the model's size).
- Face and edge counts are not compared: kernels may split faces differently. Names, volumes, centroids,
  body and shell counts and the genus are compared.
- Values from this kernel alone are marked so in `oracle`. Where an exact or independent value exists, it
  is used and the tolerance reflects the method's error.

## DXF cases (`r11b/<case>/`, R11b, O1)

The DXF writer's cases are folders, not part documents (the runner above skips them): `case.json` (`id`, `step`,
`decisions`, `about`, `input.document` or `input.documentFile`, `input.options` — one run each, a run may name its own
`documentFile` or say `withoutSolidHatches` — and `oracle`), the expected file of each run `expected.<version>.dxf`
(the writer must reproduce it byte for byte), and an independent reader's reading of it `oracle.<version>.json`
(ezdxf, `scripts/dxf-oracle.py`, run outside the product). `test/dxf-writer.test.mjs` checks them: a clean audit, and
every input entity, layer, line type, unit, text and coordinate (to 1e-9) found in the reading. After a deliberate
change: `pnpm build:library && DXF_ORACLE_PYTHON=~/.cache/barocss-ezdxf/bin/python node scripts/dxf-fixtures.mjs`.

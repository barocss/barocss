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
      "volume": { "value": 1000, "relTol": 1e-9 },         // optional "absTol" (mm³): a floor for tiny volumes
      "centroid": { "value": [5, 5, 5], "absTol": 1e-9 },
      "area": { "value": 600, "relTol": 1e-9 },     // optional: the surface area over the exact surfaces
      "bodies": 1,                                  // separate solid bodies in this output
      "topology": [{ "shells": 1, "genus": 0 }],    // per body: closed shells and genus (Euler–Poincaré)
      "faceNames": ["s.surface0", "..."],           // optional: distinct face names, "#k" numbering removed, sorted
      "faceNamePattern": "^m\\.facet\\d+$",         // optional instead: every face name matches
      "tessellation": { "segmentsPerQuarter": 8, "watertight": true },  // optional: every edge in exactly two triangles, by exact position
      "decimate": { "trianglesAtMost": 12, "hausdorffMMAtMost": 1e-9 },  // optional: a decimated mesh's report (R9): its triangles, its measured distance both ways
      // optional: a sheet-metal body's rules and its bends in order (R12): names, angles and allowances θ(R + K·T) to absTol
      "sheet": { "thickness": 2, "bendRadius": 3, "kFactor": 0.4, "absTol": 1e-9, "bends": [{ "name": "c.bend1", "angle": 90, "allowance": 5.969 }] },
      // optional: a structural member's report (FR1): its section's area and centroid, length, the section's x and y (and "upFallback"), to absTol
      // ("derived": the dimensions derived by a geometric rule and how, or null for none — a tube's concentric bore radius)
      // ("ends": a frame member's ends at its corners in order — end, kind, point, and the cut's angle from square, FR3a)
      "member": { "area": 420.82, "length": 394.46, "centroid": [0, 0], "xAxis": [0, 1, 0], "yAxis": [0, 0, 1], "derived": { "innerRadius": "concentric: ro − t" }, "ends": [{ "end": "start", "kind": "mitre", "point": 0, "angle": 45 }], "absTol": 1e-9 },
      // optional: a weldment plate's report (FRk1): a gusset's or an end cap's area and its seam lengths ("seams") or seam ("seam"), to absTol
      "plate": { "kind": "gusset", "area": 5887.5, "seams": [105, 85], "absTol": 1e-9 },
      // optional: a weld bead's report (FRk2): its leg, seam length, the part of it flush, the members it meets, to absTol
      "bead": { "leg": 3, "seam": 160, "flush": 0, "meets": [0], "absTol": 1e-9 },
      // optional: its flat pattern (R12.2): area, box, loops, bends (sorted by name) — or `error` {code, messageIncludes};
      // `options` as flatPattern takes them (with `thickness`: the kernel's flatPattern of a body made without the rules)
      "flat": { "area": { "value": 2308.65, "relTol": 1e-9 }, "box": { "value": [94.36, 25], "absTol": 1e-9 }, "loops": 2, "bends": [{ "name": "c.bend1", "direction": "down", "angle": 90 }] }
    }],
    "error": { "code": "GEOMETRY", "messageIncludes": "not closed" },
    // Optional: a frame's cut list over its member outputs (FR4a): rows in order (quantity, pieces, axis length, long
    // point, from volume or not, each end's kind with its mitre and bevel angles, mass each) and totals, at a density.
    // (MMGS: density in g/cm³, mass in g.)
    "cutList": { "density": 7.85, "absTol": 1e-9, "rows": [{ "quantity": 2, "pieces": ["f/0", "f/2"], "axisLength": 600, "longPoint": 640, "fromVolume": false, "ends": [{ "kind": "mitre", "mitre": 45, "bevel": 0 }], "mass": 1970 }], "totals": { "quantity": 4, "axisLength": 2000, "mass": 6970 } },
    // Optional: fits between outputs (R12c.2): the tables (the user's rows, as fitTableProblem takes them), a hole face and a
    // shaft face { output, face, class } — the kind, clearance [least, greatest] µm, the overlap at MMC and LMC (mm³) to
    // absTol, contradicted or not; or `error` {code, messageIncludes}.
    "fitChecks": [{ "tables": [{ "id": "t", "sources": [{ "id": "S", "label": "…" }], "rows": [{ "class": "H7", "over": 30, "upTo": 50, "upper": 0.025, "lower": 0, "source": "S" }] }], "hole": { "output": "r", "face": "bore.side0#1", "class": "H7" }, "shaft": { "output": "s", "face": "s.side0#1", "class": "k6" }, "kind": "transition", "clearanceUM": [-18, 23], "mmcOverlapMM3": 28.2794, "lmcOverlapMM3": 0, "contradicted": false, "absTol": 1e-6 }],
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

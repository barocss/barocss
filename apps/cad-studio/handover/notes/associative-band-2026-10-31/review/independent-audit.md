# D369 independent audit (claude-opus-5-5 sub-agent, 2026-10-31)

The audit was read-only, on 2e7e97d61 plus the B1 diff. The probes are in [../audit](../audit):
- `geo.ts`, an independent support-function oracle;
- `p1.ts`, a random sweep;
- `p2.ts`, edge cases including the F1 and F2 repros;
- `p3.ts`, downstream references;
- `p4.ts`, associativity paths;
- `p5.ts`, kernel checks with and without the tie check (`band.notie.ts`);
- `muts.mjs` with the `muts` results.

Process note: the auditor's first mutation run wrote temporary `*.out.mjs` files next to the test files. They were deleted when each run ended, the auditor moved its output into its scratch folder and reran, and `git status` was clean afterwards.

**Verdict: CHANGES_REQUIRED.** The geometry was exact and associativity worked on every path checked.

## Holds

- **Geometry.** 5,634 random accepted bands (plus about 900 earlier) were checked. Each has support equal over 6,000 directions, supporting lines at both ends, and arcs on r + d. Each is CCW with total turn 2π, G1 when d > 0, and has unique tags. 186 extruded volumes equal area × height to 1e-6.
- **Refusal boundaries.** All are exact and every message names the band:
  - touching at 1e-4;
  - minimum strip width and arc radius 0.01;
  - ±10000 accepted at exactly 10000.
- **Topology change.** When a source stops winning twice, a reference to a removed tag is refused, not rebound.
- **Regeneration.** The band is fresh through:
  - `evaluateDoc`, `toPartDocument`, `partSnapshot` and mass;
  - parameters, configurations, and parameter rename and removal;
  - rings, middle, loft sections and DXF;
  - editFields, and Save/Open with reopen → Finish → rebind.

  Other sketch readers refuse or catch.
- **Construction ids.** Construction shapes in existing sketches gain ids once at their next Finish. There is no downstream effect.

## Findings and root disposition

- **F1 (medium): fixed.** Repeated-piece tags `_0`/`_1` swapped under a continuous rotation with no topology change, so a reference to one face moved to the other face of the same circle. They are now named by the preceding source (`b1_e1-e2`; `-` avoids a collision with tangent names), and a duplicate is refused. A 361-step rotation test checks continuity.
- **F2 (medium-low): fixed.** A midpoint tie check refused valid inputs carrying 1e-10..1e-7 of coordinate noise when an unrelated breakpoint created a tiny interval. A real shared outline cannot happen past the 1e-4 separation check, so the check was removed: ties go to the lower source index, and intervals under 1e-12 rad are merged.
- **F3 (low): fixed by root after run01.** Picked shapes were not highlighted, because ids were not stored at pick time.
- **F4 (low): fixed.** The guided loft checked holes before resolving a band strip.
- **F5 (low): fixed.** Malformed band data threw TypeErrors; it now gives refusals.
- **Mutants.** 24/33 were killed. The 6 real survivors are now covered: reopen with a bound offset/width, previews, DXF, the ambiguous holder, tiny-arc collapse, and the tie check. The other 3 are equivalent.

## Side notes

- On a clockwise polygon, the vertex arc is named by the previous point's id.
- In-sketch Ctrl+Z does not undo Make/Remove band; document Undo does.
- An id containing a space reports "longer than 32 characters".

# F0 facet faces — per-module impact audit (read-only)

Worktree `barocss-cad-gpu-review-efbb2c`, branch `review/cad-gpu-engine-2026-10-14`. Paths relative to
`packages/barocss-cad/src` unless prefixed `studio/` (= `apps/cad-studio/src`).

**Live path.** Here "live" means reachable by import from `part-model.ts` (the studio's only kernel
entry, through `evaluateCadPart`) plus the studio's direct `@barocss/cad` imports (tessellateBrep,
projectBrepHiddenLines, faceGeometry, revolutionOf, exportStep, readStl/readObj, encodeBinaryStl,
surfaceDomain/surfaceEvaluator, curve helpers). That gives 51 kernel files.
- Of the 27 `brep-core` importers, 23 are live. The other four are `brep-euler`, `brep-adapters`,
  `brep-sweep` and `index`.
- Of the 91 evaluateSurface-family files, 11 are live: analytic-boolean, brep-core,
  brep-mass-quadrature, brep-tessellate, derivatives, extruded-profile-solid, general-shell, math,
  sew-solid, thicken-solid and surface-isocurve.

**Assumed type.** `BrepFace.surface: Surface | FacetPatch`, with `FacetPatch.kind = 'facets'`.
`Surface.kind` is already `'surface'` (`mesh-brep.ts:126`), so the union narrows by `kind`.
- Widening the type makes `tsc` flag every `.controlPoints`, `.degreeU` and `evaluateSurface(face.surface)`
  site in this audit. That is safer than adding an optional new field.
- `sense` keeps its meaning relative to triangle winding ('reversed' = outward is minus the winding
  normal). Then `transformBrep` and `withCavities` can flip `sense` without rewriting index arrays.
- Polyline edges are degree-1 B-spline `Curve`s with a knot at each mesh vertex. Every edge consumer
  (evaluateCurve, the STEP B_SPLINE_CURVE writer, transform, bounds) then works unchanged.

Classes: **A** unchanged · **B** needs a facet branch · **C** refuse in F0 · **D** not on a live path.

## 1. Core / topology
| file | face.surface use | class | change |
|---|---|---|---|
| brep-core.ts | type `:29`, `BrepFaceInput :233`. `buildBrep` stores the surface by reference (`:262`). `surfaceNormalAtCentre :57-59` | B | Widen the types. `buildBrep` takes its tolerance scale from vertices only (`:245-247`); also take it from the patch bounding box, because a facet body has few vertices. `mergeBreps :285` is fine (references only). |
| brep-core.ts `checkBrep` | `validateSurface(f.surface) :105`; pcurve check `:169-173` (skipped: facet coedges have `pcurve: null`, `:164`); orientation `:197` `surfaceNormalAtCentre(f.surface)` | B | `:105`: run `validateFacetPatch` instead (finite values, indices in range, no degenerate triangles). `:197`: compare the loop's vector area with the summed triangle vector area, or skip. Add a check that each polyline edge's control points are consecutive boundary vertices of its region (one pass with numeric edge keys). Euler–Poincaré (`:203-210`) is unchanged. |
| brep-transform.ts | `surface()` maps `controlPoints` (`:16`, `:20`) | B | For facets: a new `Float64Array` of mapped positions. Normals use the inverse-transpose, or are dropped and recomputed. Keep `indices` shared. When det<0, flip `sense` only. Skip the copy for identity maps (`part-model.ts:611,1018,1057` call it with identity just to rename). |
| brep-glue.ts | `faceGeometry` plane test `:19`; passes `f.surface` through `:55,:94` | A | Works once `faceGeometry` returns non-plane (or plane, see §11) for facets. `withCavities` flips sense, which is valid under winding-relative sense. |
| part-model.ts | `planarBrep :228` (reads `surface.degreeU/controlPoints`); `representation :229`; sweep `box :939` (internal pieces only, A); chamfer `wedgeChamfer :1263-1265` (`s.degreeU`, `s.controlPoints`); mesh feature `:715-720`; import `:602-614`; `bounds :233-238` (vertices + edge poles) | B/C | `planarBrep`: return false for facets. `representation`: add `'faceted'`. `:720`: call the new `facetBrepFromTriangles`. `bounds`: include the patch bounding box (a one-region closed mesh has no vertices). `wedgeChamfer`: refuse explicitly. The guards for boolean, finish, shell and draft are in §5-§7. |
| brep-euler.ts, brep-adapters.ts, brep-sweep.ts | build faces from `Surface` (`brep-euler :133,147`; `brep-adapters :20-73`) | D | Exported by index (`index.ts:574-577`), but nothing on the part-model or studio path imports them. No change beyond the widened type (they only produce `Surface`). |
| index.ts | barrel | A | Export the new facet types and `facetBrepFromTriangles`. |

## 2. Tessellation & display
| file | use | class | change |
|---|---|---|---|
| brep-tessellate.ts | pre-passes `planar(face.surface) :289`, `cylinderFrame(face.surface) :290`, `flat/ruledFrame :297-300`; main loop `:348` `planar(face.surface)`; `isSmoothPatch/surfaceTriangles/surfaceEvaluator :371-373`; `polesOf :598`; `surfaceTriangles :657` | B | Skip facet faces in both pre-passes. In the main loop, for each facet face, emit the patch's triangles in the face's region directly: positions, given or area-weighted normals, winding flipped when `sense === 'reversed'`. Bypass `emit`'s per-vertex string-key smoothing (`:340-342`), which is O(V) string allocations. Add `'facet'` to `BrepMeshFace.kind` (`:22`). |
| brep-tessellate.ts `edgeParameters :64-89` | samples non-circle curves uniformly in t (`:82-88`) | B | **Required for watertightness.** For a degree-1 curve with more than 2 poles, return exactly its distinct knots, so the edge samples equal the facet boundary vertices. Uniform samples would leave cracks or T-junctions. |
| studio/engine/mesh.ts `bodyMesh` | `faceGeometry(face) :85` (caught); **`revolutionOf(face.surface, 100) :86`** reads `controlPoints` and crashes on a facet; `kind :80`; `planeOf :56` | B | Skip the radius probe for facet faces. Map the mesh kind `'facet'` to DisplayFace kind `'curved'` or a new `'mesh'`. Region names become the display face names. Perf: `groups.set(r,[...spread]) :68` and `edges.find` mate search `:111-112` are quadratic; `normalAt :92` scans every vertex of a face for each edge. All are fine for a few hundred regions, but use maps if region counts grow. |
| studio/engine/evaluate.ts | `meshOf/bodyOf :32-42`; `samePlacedBody/boxOf :122-140` (vertex box only) | A/B | Works. `boxOf` over a facet body with no vertices gives ±Infinity, and NaN comparisons make `samePlacedBody` return true. Use the patch bounding box. |
| studio/viewport/gpuRenderer.ts | picks by `faceOfVertex` (`:143,:283-288,:455`) | A | Only uses the DisplayMesh. Face picking resolves to a region. |
| stl.ts, mesh-brep `readStl/readObj` | none | A | — |

## 3. Mass
| file | use | class | change |
|---|---|---|---|
| solid-mass.ts `brepMassProperties` | `curved = faces.some(f => f.surface.degreeU>1…) :53`; divergence theorem over `tessellateBrep` triangles `:63-73` | B | Treat facets as not curved, so a facet-only body takes the exact triangle sum at `:63-73`. Label it `'planar-exact'`, or add `'facet-exact'` to `method :17`. |
| brep-mass-quadrature.ts | `surfaces` map `:109`; `face.kind === 'planar'` branch `:124`; `inverter(S)`/`surfaceEvaluator(S)` `:135-137` | B | Reached only for mixed bodies. Add `if (face.kind === 'facet') { add flat; continue; }` before `:124`, because the flat triangle sum is exact for facets. |
| part-model `volumeOfSolid :857`, output `massProperties :1317` | via the two modules above | A | — |

## 4. Classification / point containment
No public B-rep point-in-solid exists on the live path. Classification is internal to the Booleans
(`analytic-boolean.ts:799 classify`, `:841 rayHits` on NURBS; `polyhedral-boolean.ts:109-126`).
Upright solids use `prismaticContains`. The studio Point test (`studio/App.tsx:1745`, `pointInBody`)
runs on the DisplayMesh and is **A**. A BVH ray-cast `facetContains` belongs to F1, alongside the
facet Booleans.

## 5. Booleans
| file | use | class | change |
|---|---|---|---|
| analytic-boolean.ts `booleanAnalytic` | `facesOf` → `surfaceOf(face) :152-160` (`evaluateSurface`, `S.controlPoints`); bbox `:340` `face.surface.controlPoints` | C | At the top of `booleanAnalytic :890`, refuse when either operand has a facet face, with `BrepError('GEOMETRY','analytic Boolean: faceted (mesh) faces are not supported yet')`. `part-model.ts:808` already maps "not supported yet" to CAPABILITY. |
| analytic-boolean.ts `faceGeometry :879` | `surfaceOf` | B | Shared classifier with 9 callers (mesh.ts:85, assembly/faces.ts:33, section.ts:41, hidden-line:80, glue:19, edge-finish:42, general-shell:41, step.ts:84, part-model:1003). Return early for facets with `{kind:'other'}`, or optionally `'plane'` for an exactly coplanar region (§11). Never throw. |
| polyhedral-boolean.ts | Never reads `face.surface`. Uses only straight edges (`:64` throws on a non-2-pole edge) and exact vertex rings with a Newell normal (`:66-70`), so it assumes **planar** faces | C (F0) | Not reached, because `planarBrep` is false for facets. **Regression to avoid:** an imported STL can be unioned or differenced today, because brepFromTriangles gives planar faces and `part-model.ts:803` sends them to booleanPolyhedra. F0 option: in `boolean()` (`part-model.ts:793-810`), when an operand is faceted, re-run the existing `brepFromTriangles` on its triangles and send the result to booleanPolyhedra. That keeps today's behaviour and cost (≤100k triangles). Otherwise refuse with CAPABILITY. In F1, booleanPolyhedra can take each triangle as a PFace directly. |
| curved-arrangement.ts, prismatic-solid.ts `booleanPrismatic` | 2D regions / upright solids; no BrepFace | A | — |
| part-model features via `boolean()`: hole `:490`, split `:740`, draft `:616` | — | C/B | Inherit the guard or explode fallback above. Section view (`studio/drawing/section.ts:24` uses split) then shows the CAPABILITY message for a mesh body. |

## 6. Edge finishing
| file | use | class | change |
|---|---|---|---|
| edge-finish.ts `finishBrepEdges :37`, `faceReach :304` | `faceGeometry :42,:357`; then `booleanAnalytic` | C | Refuse at entry when a named edge borders a facet face: "fillet/chamfer on mesh faces: not supported yet". `faceReach :358` returns 0 for 'other', which would silently mis-size, so guard it too. |
| part-model `finishEdges :1169`, `wedgeChamfer :1257` | `:1263-1265` `s.degreeU`, `s.controlPoints` | C | Guard before indexing. Today a facet reads as `undefined`, so `!(…===1)` already refuses, but only by accident. |

## 7. Shell / thicken / sew
| file | use | class | change |
|---|---|---|---|
| general-shell.ts | `faceGeometry :41` (caught); **`revolutionOf(f.surface) :107`**; `endFace.surface.controlPoints :127,:194`; `f.surface.knotsU` + `evaluateSurface :159-160` | C | Refuse up front when any face is a facet: "shell of a mesh body: not supported yet". (`revolutionOf` would throw a TypeError on missing `controlPoints`, not a clean refusal.) |
| part-model `shellPart/shellOf :954-1022`, `shellRevolved`, `shellSwept` | prismatic and B-rep paths | C | Same guard in `shellOf`. |
| sew-solid.ts | Input is `Surface[]` from the document (`:72-139`). Never sees a BrepFace | A | — |
| thicken-solid.ts | Input is a `Surface` (`:27-45`). Outputs via `brepFromTriangles :59` | A | Keep it on the **planar** brepFromTriangles. The same goes for `thread-solid.ts:81` and `sweep-solid.ts:74`, whose outputs are Boolean'ed today (e.g. threads). Add facets only to the import path (`facetBrepFromTriangles`), or opt in by flag. |
| loft, revolve, drafted-extrusion, prismatic-solid, thread-helical, extruded-profile-solid | Producers that write `Surface` only (`thread-helical :226`, `prismatic :341`) | A | — |

## 8. Hidden-line / drawing
| file | use | class | change |
|---|---|---|---|
| brep-hidden-line.ts | `faceGeometry` cached `:77-81` (catches to 'other'); everything else is tessellation-driven (`meshOf :84`, occluder `:109-127`); face silhouettes `:250-300` skip `f.kind==='planar'` (`:252`); mesh-facet joints found by **name regex `FACET = /\.facet\d+$/` `:51,:177`** | B | Since F0 region boundaries are the only B-rep edges, replace the name regex with a face-kind test (`surface.kind==='facets'`). For facet faces, take silhouettes from interior mesh edges whose two triangles face opposite ways to the view. That is exact for meshes and cheaper than the `smoothNormal` crossing at `:259-270`. The occluder needs nothing. Edges arrive as polylines from `mesh.edges` (needs §2's `edgeParameters` fix). |
| studio/drawing/project.ts `:17`, section.ts `cutRings :35-58` | `projectBrepHiddenLines`, `faceGeometry :41` (caught → skipped) | A | Inherits the hidden-line change. Section cuts are refused through split (§5). |
| studio/assembly/faces.ts `:29-36` | `faceGeometry` → mate table | A/B | Works without a crash, but mesh faces stop being mateable (today they are, as planar facets). §11's planar-region return keeps them mateable. |

## 9. STEP / IGES / STL I/O
| file | use | class | change |
|---|---|---|---|
| step.ts `exportStep` | **`S.degreeU/S.controlPoints` read before `faceGeometry` `:84`**, `S.controlPoints[1][0] :87`, `bsplineSurface(S) :89`. Schema is AP214 (`:113`) | B | F0: write a facet face as one planar ADVANCED_FACE per triangle (or per coplanar group), under a cap. That is what the current planar mesh B-rep exports, and `importStep` reads it back. Better in F1: AP242 `TESSELLATED_SHAPE_REPRESENTATION`/`TRIANGULATED_FACE`, which needs `FILE_SCHEMA` AP242 and an importer branch. At minimum, refuse cleanly rather than throwing a TypeError at `:84`. |
| step-import.ts | Produces only parametric faces. `TRIANGULATED_FACE` etc. are refused by name at `:324` | A | (F1: read AP242 tessellated faces into facet faces.) |
| part-model `stl() :1322-1324` → `encodeBinaryStl` | through tessellation | A | Works once §2 emits facets. |
| IGES | `exportIGES/importIGES` (studio/engine/direct.ts:10) apply to direct-modelling `CadDocument` surfaces, not B-reps | A | — |

## 10. Checks / validation and the rest of the studio
- mesh-brep.ts: `brepFromTriangles :24-106` is the 1-face-per-coplanar-group builder (planeSurface `:99`,
  `buildBrep :102`, `assertValidBrep :104`). **B**. Add a sibling `facetBrepFromTriangles`. Reuse the
  weld, closedness and outward-flip code at `:31-58`, but switch to numeric keys (see risks).
  Grow regions by normal angle instead of exact coplanarity (`:60-73`). Region boundaries become
  polyline edges, and names become `<id>.region<k>`.
- studio/engine/direct.ts, trim.ts, ui/DirectPanel.tsx, App.tsx:1483-1488: direct-modelling surfaces
  (`CadDocument`), never BrepFace. **A**.
- studio/app/measure.ts:122, app/threads.ts:40, viewport/Viewport.tsx:429: read `DisplayFace.kind/radius`.
  **A**, because facet regions have no radius.
- studio/engine/meshImport.ts, doc.ts:72, part.ts:34: the mesh node keeps `positions/indices: number[]`. **A**. Keep them as JSON numbers (see risks).
- The legacy evaluateSurface modules (80 files: `own-*`, `xy-*`, `*-preview`, `coplanar-face-boolean*`,
  `paired-surface-*`, `vlinear-*`, `surface-*` edits, `three-section-loft`, `multi-section-loft`,
  `translated-surface-*`, `z-axis-*`, `box-shell`, `axis-box-boolean`, `face.ts`, `cad-surface-area`, …):
  **D**. All are exported by `index.ts`, but none is reachable from part-model or the studio. None imports
  `brep-core`, so they never see a BrepFace and are unaffected by the union.
- Live evaluator primitives (math, derivatives, surface-isocurve, surface-revolution `revolutionOf :33`,
  surface-intersection, extruded-profile-solid): **A**. They take a `Surface`, so a call site must
  narrow first.

## (i) Minimum F0 touch set
For an imported mesh body to display, pick, measure mass, save/reopen and export STL/STEP:
1. `types.ts` / `brep-core.ts`: `FacetPatch` type and union; `buildBrep` scale; `checkBrep` facet
   branch (`:105`, `:197`, plus a polyline-on-boundary check).
2. `mesh-brep.ts`: `facetBrepFromTriangles` (regions, polyline edges, stable names).
3. `part-model.ts`: mesh feature `:720` uses it; `planarBrep`/`representation`; `bounds`; refusal guards
   in `boolean()` (or the explode fallback), `finishEdges`/`wedgeChamfer`, `shellOf`, draft.
4. `analytic-boolean.ts`: `faceGeometry` facet early-return (no throw); `booleanAnalytic` entry refusal.
5. `brep-tessellate.ts`: facet pass-through, the `'facet'` kind, and the polyline `edgeParameters` fix.
   This one change carries display, pick, STL, mass and hidden-line occlusion.
6. `brep-transform.ts`: facet positions (placement, patterns, mirror, scale).
7. `solid-mass.ts:53` (plus the one-line `brep-mass-quadrature.ts:124` guard).
8. `step.ts:84`: facet branch (exploded planar faces) or a clean refusal.
9. `brep-hidden-line.ts:51,177`: kind test instead of the name regex (drawings of mesh bodies).
10. Studio `engine/mesh.ts:86` (skip `revolutionOf`), `engine/evaluate.ts boxOf`.

Save/reopen needs **no** B-rep serialization. `.bcad` stores the mesh node's arrays
(`studio/App.tsx:933`, `doc.ts:72`), and reopening re-evaluates part-model's mesh feature.

## (ii) Refuse facet faces in F0 (handled in F1/F2)
- `booleanAnalytic` (F2).
- `booleanPolyhedra` and all of part-model's `boolean()` users: union, intersect, difference, hole,
  split/section, draft (F1 mesh Boolean). Or keep today's behaviour with the explode-to-planar fallback.
- `finishBrepEdges`, `faceReach`, `wedgeChamfer`.
- `generalShell` and `shellOf`.
- STEP export, if the exploded-planar writer is not done.
- Future `facetContains`.

## (iii) Risks
- **Typed arrays vs freezing/JSON.** `Object.freeze(new Float32Array(n))` throws ("Cannot freeze array
  buffer views with elements"; checked with node). `part-model.ts:349,371 deepFreeze` deep-freezes the
  admitted document and features, so facet arrays must never live in the document or features. Brep
  outputs are only shallow-frozen (`:1315`), which is safe; keep it that way. `extruded-profile-solid.ts:371`
  has a second `deepFreeze`.
  `JSON.stringify(Float32Array)` gives `{"0":…}`, and `Array.isArray` is false. That breaks `admit`'s
  `JSON.parse(JSON.stringify(doc))` (`part-model.ts:256`), the cache key at `:324`, the mesh feature's
  `Array.isArray(P)` check at `:717`, and `copyCadData` (`data-copy.ts:2-5`), which turns a typed array
  into a plain object. That code is not on the B-rep path today, so never route patches through it.
- **Big documents.** Every evaluation runs, over the mesh node's `number[]`: `admit` deep copy
  (`:256`), the cache key `JSON.stringify` (`:324`), and `deepFreeze` (`:349`). The studio also runs
  `JSON.stringify(doc)` comparisons and hashes (`App.tsx:130`, `drawing/types.ts:41`,
  `DrawingWorkspace.tsx:77`, `editCommand.ts:121`, `assembly/faces.ts:41`) and writes recovery to
  localStorage (`recovery.ts:18`, about 5 MB quota). 200k triangles is about 4-6 MB of JSON per pass.
  `CadPartLimits.meshTriangles` is 100_000 (`part-model.ts:196`). The F0 target needs a binary or
  base64 mesh store, or a content-hash key, not just facet faces.
- **Copy cost.** `transformBrep` copies the patch for every placement (patterns allow 64 copies:
  `CadPartLimits.copies`). Identity calls (`:611,1018,1057`) copy needlessly. Store Float64 for the
  kernel and convert to Float32 only in `bodyMesh`.
- **`controlPoints` assumptions.** These dereference without a kind check and crash with a TypeError
  rather than refusing:
  - brep-core `:105,:197`, part-model `:228,:939,:1265`
  - analytic-boolean `:152-160,:340`, general-shell `:107,:127,:159,:194`, step `:84-89`
  - tessellate `:262,:290,:300,:417,:437,:489-510,:598-613,:657`, quadrature `:135`
  - studio `mesh.ts:86`
  
  The union type makes `tsc` list them.
- **String-key hashing at scale.** `mesh-brep.ts:31,48` (`"x,y,z"` weld keys and `"a>b"` directed-edge
  keys: about 600k strings for 200k triangles) and `brep-tessellate.ts:340`. Use numeric keys
  (`a*nV+b` in a Map<number>, or sort pairs in a Uint32Array).
- **Name stability.** Existing `.bcad` files may reference mesh faces as `<id>.facet<k>` (sketch on
  face, mates via `assembly/faces.ts`, hidden-line `FACET`). Changing the mesh node's output renames
  them. Version the node (`representation: 'facets'` on new imports only) so old documents keep
  planar facets.
- **Capability regression.** Booleans, shell and chamfer on imported STLs work today through
  planar faces (`part-model.ts:803`). Refusing them is a visible loss unless the explode fallback is kept.
- **Empty-topology regions.** A closed mesh grouped into one region has no loops, edges or vertices.
  Tessellate's `face.loops.find(outer)!` (`:349`), `bounds`, `boxOf` and `buildBrep`'s scale all assume
  vertices or loops exist. Either force at least 2 regions (split by a seam) or handle loopless facet
  faces explicitly.

## (11) Optional
`faceGeometry` could return `{kind:'plane'}` for an exactly coplanar facet region (all triangle
normals equal and every vertex on the plane). That keeps sketch-on-face, mates, glue and section rings
working. Any `'plane'` consumer that then reads `surface.controlPoints` (step.ts:87, part-model:1265)
must narrow first.

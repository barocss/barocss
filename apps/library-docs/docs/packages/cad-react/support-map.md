# CAD Model to React support map

CAD React is the first adapter subset, not a complete React facade over CAD Model. Its twelve logical elements are six operation adapters (Extrude, Revolve, Union, Difference, Translate, Rotate), two profile producers (Rectangle, Circle) and four structural elements (Part, Target, Tools, Definitions). This count is not a CAD-completeness percentage.

All three packages currently identify as `0.0.0-experimental`. This map reads `packages/barocss-cad-model/src/engine/doc.ts` (`ModelNode = ModelNodeBase & NodeExtras`), current React `src/index.ts`/`components.tsx`/`compiler.ts`, and the existing public tests. The exact Model source SHA256 is `b35d4dedc69cb4921489084cd1c52e6fe0770b03916fd5000553b6728fdbe799`. A source AST inventory finds 75 distinct top-level ModelNode kind strings. That is a schema inventory, not 75 independently runtime-qualified capabilities. It excludes nested path/parameter tags from the count.

## Read the status correctly

- ADAPTER: a named current React element lowers to the existing operation. It does not extend backend support or independently qualify all parameters.
- PARTIAL: only a bounded part of a Model node's input vocabulary is exposed.
- UNEXPOSED: the Model declaration exists, but no current public React component lowers it. This does not mean the CAD backend feature is absent.
- GATED: a relevant existing owner HOLD still applies. Unexposed features are not all automatically held, and this document does not authorize an implementation or release a HOLD.

`Part`, `Target`, `Tools` and `Definitions` are logical structure, not extra native feature kinds. Rectangle/Circle are profiles lowered into sketch storage; there is no public Sketch-only prop or `<Sketch>` component. Conversely, a normal user function returning geometry is React composition, not an additional shipped element.

## Complete current ModelNode-kind inventory

Every top-level kind appears exactly once below. Source locations refer to the current `packages/barocss-cad-model/src/engine/doc.ts`; they identify declarations, not validation receipts.

| Model family | Existing Model kinds | React bridge | Boundary / missing contract | Declaration lines |
|---|---|---|---|---|
| Profile storage | `sketch` | PARTIAL | Rectangle/Circle expose only two profile producers; polygon/loop/band, constraints, plane/face association and other SketchNode fields are not React inputs. | `doc.ts:358` |
| Current operation adapters | `extrude`, `revolve`, `union`, `difference`, `translate`, `rotate` | ADAPTER | Current Extrude/Revolve/Union/Difference/Translate/Rotate lower these existing nodes. Revolve adds selected rectangle/y-axis/omitted-origin 90/180/360 actual evidence; broader parameters remain outside physical qualification. Native limits and finite evidence remain separate. | `doc.ts:383, 385, 400, 402, 386, 388` |
| Other profile solids | `sweep`, `sweep-curve`, `loft` | UNEXPOSED | No current component export. A bridge needs explicit profile/path/section/source/refusal contracts; existing backend is not missing. | `doc.ts:410, 412, 415` |
| Other Boolean/body operations | `intersect`, `mirror`, `scale`, `split`, `separate` | UNEXPOSED | No current component export. Preserve existing output cardinality and body/reference identity before adding a bridge. | `doc.ts:401, 389, 391, 408, 652` |
| Body patterns | `linear-pattern`, `circular-pattern` | UNEXPOSED | No current array/pattern component. Counts, placement, skipped occurrences and identity need a defined adapter contract. | `doc.ts:392, 399` |
| Feature patterns | `linear-feature-pattern`, `fill-feature-pattern`, `curve-feature-pattern`, `rectangular-feature-pattern` | UNEXPOSED | Reference/selection-driven feature patterns require their own producer and ownership contract; existing typed refusal boundaries stay. | `doc.ts:394, 395, 396, 397` |
| Finishing and holes | `thread`, `shell`, `chamfer`, `draft`, `full-round`, `face-fillet`, `face-thread`, `split-face`, `fillet`, `hole` | UNEXPOSED | No React selection-based finishing component. Edge/face source authority, rematch/refusal and current native support must be addressed; no fake handle/query is available. | `doc.ts:430, 432, 434, 639, 641, 643, 645, 647, 649, 660` |
| Profile/detail text operations | `rib`, `rectangular-relief`, `text`, `text-relief`, `cylindrical-wrap` | UNEXPOSED | No current component or portable font/face-selection adapter. Backend/model declarations do not automatically expose these inputs. | `doc.ts:404, 406, 83, 85, 216` |
| Imported/mesh data | `import`, `mesh`, `decimate` | UNEXPOSED | No source-file/mesh/import component. File/blob ownership, IO, provenance and display-vs-native authority remain separate. | `doc.ts:418, 424, 658` |
| Sheet metal | `sheet-base`, `sheet-contour`, `sheet-corner-relief`, `sheet-flange` | UNEXPOSED | No current sheet component. Manufacturing and independently held workflows are not activated by a JSX adapter. | `doc.ts:441, 442, 448, 449` |
| Frames and skeletons | `skeleton`, `frame`, `frame-member` | UNEXPOSED | No current structural graph component. These existing Model records are not ordinary React wrapper functions. | `doc.ts:463, 468, 469` |
| Advanced surfaces | `band-surface`, `thicken`, `subd`, `sew` | UNEXPOSED / GATED | No current component. In particular #2258 public-thicken/fitter and #2266 widening remain held; this inventory releases neither gate. | `doc.ts:477, 478, 635, 637` |
| Library and generated mechanical parts | `library`, `rack`, `internal-gear`, `bevel-gear`, `worm-wheel`, `spring`, `cam`, `sprocket`, `pulley`, `belt`, `coupling`, `shaft`, `oring-gland`, `oring`, `connector-opening`, `connector-body`, `gusset`, `end-cap`, `bearing`, `key`, `keyway`, `retaining-ring`, `pin`, `worm`, `gear` | UNEXPOSED | No current catalog/generator component. Existing generator versions, estimates, assembly/engineering claims and owner gates retain their own boundaries. | `doc.ts:501, 510, 516, 529, 546, 556, 566, 575, 576, 577, 578, 584, 603, 604, 611, 612, 619, 620, 621, 622, 623, 624, 625, 626, 627` |

The sketch kind has rectangle/circle/polygon/loop/band variants; current JSX exposes only Rectangle/Circle's numeric profile inputs. The React package also does not expose general Model parameters (`Dim`), NodeExtras suppression/held/rematch fields or a source-code restoration system. Assemblies, mates, BOM, drawings, versions and robot settings are additional document APIs outside this ModelNode table; their existence is not a React API.

## Proposed bridge backlog, not new exports

The existing D445 order remains C1 everyday parts, C2 ordinary robustness, C3 handoff, C4 static assemblies, then later/gated breadth. A reproduced C1/C2 blocker can change the order. The following is source-grounded selection guidance, not a promise to implement all candidates now.

| Order | Candidate existing capability | Why it is useful / required adapter work |
|---|---|---|
| Delivered subset | Revolve | The existing-node adapter has declaration/types/lint checks and a current real React rectangle90/180/360/Reset 90 workflow plus returned-document Studio Open. This does not qualify arbitrary profiles, axes, origins or downstream combinations. |
| 2 | Ordinary finishing: Hole, Chamfer, Shell, Fillet | C1/C2 daily tasks already exist (`doc.ts:660/434/432/649`). Define Hole parent/center/depth inputs and, where required, Chamfer/Fillet edge and Shell open-face selection sources with reference ownership. Current handles contain kind only; no new native Face/UV/query API is implied. |
| 3 | Ordinary Sweep and Loft | Existing copied path/section workflows (`doc.ts:410/415`, `part/part-profile-solid.ts`). Define typed path/section frames, ordering, copied-source semantics and refusal before JSX surface. Curve sweep and broad surface/general-guide variants are separate. |
| 4 | Body patterns, then feature patterns | C2 repetition requires stable occurrences, count/skip/placement/history and source refs. Body patterns (`doc.ts:392/399`) are a smaller boundary than selection-driven feature patterns (`394–397`). Do not treat an ordinary `.map()` of JSX as already implementing a native pattern feature. |
| 5 | Other ordinary body/Boolean adapters | Intersect, Mirror and Scale already exist (`doc.ts:401/389/391`). Define exact solid inputs, output cardinality and retained native parameters rather than inventing new JSX math or implicit geometry equivalence. |

The unexposed candidates describe possible bridges, not current exports. Revolve is now an export with the narrower qualification status stated above. Select the next bridge through the CAD roadmap and source audit after the present item; ordinary implementation is already authorized. Existing HOLD releases and gated downloads retain their specific owner requirements. There is no authority here to create dozens of placeholder components or call source inspection a runtime PASS.

## Holds and proof limits

#2258 public-thicken/fitter, #2266 widening, manufacturing P2/PG11, new Physics/Motion, schema widening, browser CI, downloads and release retain their recorded gates. Existing accepted workflows and research history stay intact. The owner-authorized React example inspector does not lift the separate Studio UI redesign hold.

Current React physical evidence includes the original Bracket widths 80/100, the selected W80 cardinal transforms and the selected rectangle Revolve 90/180/360, each with its recorded returned-document Studio Open boundary. It does not qualify all ModelNode kinds, angles, faces, profiles or generator families. Read [current support limits](/packages/cad-react/limits), the [component catalog](/packages/cad-react/components), the broader [CAD Model](/packages/cad-model/) API and [CAD modeling](/packages/cad/modeling) documentation for their separate contracts.

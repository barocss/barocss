# Reference review — CADCraft, SolidCraft and CadXStudio

Reviewed 2026-11-04 for D520. [Current roadmap](../roadmap.md) · [First product baseline](04-product-baseline.md)

## Identity and evidence limits

This is a primary-source desk review, not a hands-on benchmark. No competitor was installed, no model or binary was downloaded, and no login, paid generation, browser model session or numerical comparison was run. A documented feature is a supplier claim, not independent correctness or release qualification. Sources can change after this date.

Two unrelated products use the CADCraft name. The principal drafting reference here is **ArtCraft CADCraft**, whose official site links to `storytold/cadcraft`. The **getcadcraft.com** suite is a separate reference; its parametric product is **PartCraft**. Do not combine their features or progress numbers, and do not use lookalike installer repositories as upstream evidence. [ArtCraft official page](https://getartcraft.com/apps/cadcraft), [official repository](https://github.com/storytold/cadcraft), [separate suite lineup](https://getcadcraft.com/apps).

CadXStudio's main page returned no readable body to the web reader. Its own company profile supplies the claims below; implementation detail and actual model acceptance remain unknown. [CadXStudio](https://cadxstudio.in/), [company profile](https://www.linkedin.com/company/cadxstudio/).

## What each reference contributes

| Reference | Documented emphasis | Boundary and lesson for BaroCSS |
| --- | --- | --- |
| ArtCraft CADCraft | Precise 2D input, snaps, editable constraints, annotations, drawing layouts and agent-accessible commands | Use complete drafting/plotting tasks as acceptance. A menu or file extension is insufficient. Do not redefine our model-linked drawing system as full AutoCAD/DWG parity. [Product](https://getartcraft.com/apps/cadcraft) |
| CADCraft upstream planning | Distinguishes feature presence from practitioner readiness, identifies failing workflow gates and keeps a ranked gap ledger | Keep capability inventory, current acceptance and implementation queue separate. Its percentages and agent-hour estimates belong to its own target and dated evidence; do not import them. [Roadmap](https://github.com/storytold/cadcraft/blob/main/ROADMAP.md) |
| CADCraft upstream gaps | Lists save-loss and real-file validation gaps before breadth | Preserve originals, report losses, qualify recovery, and validate outputs with independent readers. Current status must be checked against dated gap entries rather than headline claims. [Gaps](https://github.com/storytold/cadcraft/blob/main/docs/gaps.md) |
| SolidCraft | Parametric parts, editable history, named parameters/configurations, assemblies and exchange | Use resize/rebuild/history/reopen scenarios, with operation-specific support limits. It is the closest functional reference for everyday parametric parts in this set. [Features](https://solidcraft.io/features/) |
| SolidCraft constraints | Plane/face sketch ownership, constraint feedback, expressions, precise input and selection rules | Qualify the same authored sketch across edit, Cancel, Undo and saved reopen. Input ergonomics are separate from constraint-solver correctness. [Sketch guide](https://docs.solidcraft.io/guide/sketching.html), [parameters](https://docs.solidcraft.io/guide/parameters.html) |
| SolidCraft solids and assemblies | Editable solid operations and component/occurrence ownership with declared unsupported cases | A feature name does not promise arbitrary geometry. Test shared versus copied occurrences and references, and retain typed refusal for unsupported blends. [Solid guide](https://docs.solidcraft.io/guide/features.html), [assembly guide](https://docs.solidcraft.io/guide/assemblies.html) |
| SolidCraft sheet and exchange | Rule-based bends/flat patterns; native history versus geometry versus mesh distinctions | Add a finite sheet-geometry case and explicit per-format loss table. Flat DXF does not certify fabrication or a general DXF editor. [Sheet guide](https://docs.solidcraft.io/guide/sheet-metal.html), [exchange guide](https://docs.solidcraft.io/guide/files.html) |
| SolidCraft automation | Editor and agent share a command engine; inspection and revision accompany creation | Test build→inspect→revise→check→save with the existing BaroCSS CLI/MCP, including transaction failure and Undo. Do not add another modeling engine or infer browser-agent support. [MCP](https://solidcraft.io/mcp/) |
| CadXStudio | Company describes browser text-to-CAD, manual parameter editing, drawing generation, assemblies and STEP/STL/OBJ export | Treat AI generation as a starting Doc that must remain editable and inspectable. Manufacturing-ready/DFM claims are unverified here; they do not release our manufacturing HOLD. [Company description](https://www.linkedin.com/company/cadxstudio/) |
| Separate CadCraft/PartCraft suite | Separates drafting, parametric parts and other disciplines; labels current/next/later work | Use task-specific workspace/navigation and explicit product boundaries. Do not expand BaroCSS into BIM/civil/estimating or adopt Rust/WASM because this suite does. [Lineup](https://getcadcraft.com/apps), [PartCraft](https://getcadcraft.com/apps/partcraft), [roadmap](https://getcadcraft.com/roadmap) |

## Crosswalk to our implementation and plan

The following is planning judgment informed by those sources and D519, not a comparative performance result.

| User task | Existing BaroCSS evidence / boundary | Roadmap effect |
| --- | --- | --- |
| Make and resize a constrained part | D447/D448 and later retained feature workflows; whole-family acceptance open | P1/B01–B03; upstream dimensions must retain downstream references, history and persisted editability |
| Make an enclosure, sweep/loft or bent bracket | Existing modeled families and recorded limits; not all ordinary combinations qualified | P1/B02/B04; measure missing supported combinations, leave general surface algorithms in P5 |
| Deliver an engineering drawing | Existing model-linked dimensions, views and notes; PDF golden mismatch deferred | P2/B06; add a bounded drawing/plot acceptance profile without declaring general DWG authoring or standards compliance |
| Exchange a current assembly | Existing STEP loss preview and independent readers; P0-R03/R11 remain | P0/P2/B07; no stale/missing instances, truthful geometry/history/mesh loss and independent read-back |
| Edit linked or repeated parts | D456–D459/D493/D511–D513 bounded assembly proofs | P3/B05; definition versus occurrence identity, material/BOM and source revision must agree |
| Trust Save/Open and recovery | Existing project/version mechanisms; new P0-R01/R02 guard gaps | P0/B08 first; retention and recovery precede cosmetic or uncommon geometry breadth |
| Use an agent without losing manual control | Existing CLI/MCP/chat/proposal/history surfaces; no new paid live proof in this review | Independent automation track/B09; same typed core, inspected results, transactional failure and editable saved Doc |
| Reuse CAD in React and an external Viewer | Existing CAD React→Model/Worker→Viewer, current bounded D509 proof | Separate React/P4/B10; actual props updates, failure state, returned Doc and consumer lifecycle |
| Work in a professional desktop viewport | Existing native-edge selection/cadence proof; P0-R04/R05 gaps | P4; exact displayed-input ownership, recovery, workload budgets and later owner UX discussion |

## Explicit non-adoptions

- No copying competitor code, installing its engine, adding WASM/runtime dependencies or running a cloud AI service follows from this review.
- No feature-count race or comparison percentage follows. We have not established that any competitor is generally more accurate, more complete or faster.
- Native geometry and parametric history must remain authoritative through manual, script, AI and React entry points. A screenshot or AI explanation is not physical validation.
- The first ten-scenario baseline is a declared BaroCSS scope. Full AutoCAD/SolidWorks/Fusion parity, arbitrary engineering certification, production CAM and real dynamics remain outside that denominator.
- UI grouping, Problems/history visibility and fewer persistent notices are planning inputs for the later owner discussion; the existing redesign HOLD remains.

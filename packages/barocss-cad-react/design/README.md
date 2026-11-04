# CAD React domain design

Status: domain design with B1 Polygon implemented and qualified only for the selected case. All remaining proposed components are unexported unless the current package API states otherwise. The design does not certify their implementation or runtime support. Polygon has current controlled/type/lint and selected width-60/80 pentagon native/Worker/Viewer/Studio evidence. Exact source inventories and raw hash evidence stay outside the repository.

## Architecture

Keep ordinary React, the committed ReactDOM registry, CompositionCompiler, injected ModelHost/EnginePort, and ExistingViewerHost. React calls user functions and hooks. The compiler reads realized CAD entries. It must never call function components or use raw JSX child count to infer geometry. Do not add a GPU renderer or custom reconciler.

Use domain modules when a real implemented batch needs them: profiles, sketch, selections, features, assembly, drawing, resources. A domain module must own validation and lowering. It must not accept arbitrary ModelNode JSON. Keep the current entry points and current Extrude.profile contract. Add narrower source types and exclusive source props as each producer becomes functional.

The design has separate output kinds: profile, wire, sketch entity, region set, planar-face selection, analytic face/edge selection, datum frame/axis/point, solid, solid set, part definition, occurrence, drawing, drawing annotation and display resource. A kind is not a promise that every operation accepts it. Each operation has a capability check.

## Composition grammar

Current Part remains a synchronous root with Definitions and exactly one declared logical Model output. A logical output can contain multiple native B-rep pieces; it does not promise one connected solid. D507 measured this existing contract for two disjoint boxes under one Union output b4, with the original EnginePort reply reporting pieces: 2. This bounded result does not qualify all compound geometry. Future Assembly and DrawingDocument are separate document roots; they do not nest as solid operands. PartDefinition contains one complete Part recipe and can be placed by Instance. A Part cannot consume its own occurrence or an ancestor definition.

Closed producers can be used directly as an operation child. Profile can combine one Outer, zero or more Voids and zero or more Regions. Each slot receives compatible realized closed loops or tokens. Profile is an explicit composition, not an inferred union of arbitrary sketch entities. Keep boundaries and their declared identities. Native admission decides intersection/contact/containment. Do not implement new geometric repairs or tolerance rules in React.

Sketch is a separate authoring scope. It owns entities, local entity/point/segment tokens, construction flags, constraints, and an explicit profile result. Wire contains an ordered open chain and cannot be passed to solid Extrude. An open Bezier is a wire/entity only. The existing Studio spline/ellipse workflow stores polygon/arc outlines plus metadata; an Ellipse component cannot claim an exact general NURBS profile from that fact.

In this design, the current solid child/token and SolidHandle identify one declared logical Model result, which can contain multiple native pieces. A consumer that needs one connected solid must declare that narrower capability and check the actual native authority. Boolean Union/Intersection accept two or more ordered operands; Difference keeps Target/Tools. A future SolidSetHandle represents multiple named Model outputs, not the native pieces within one logical output. SelectBody selects an explicitly identified named output and must refuse ambiguity. Each proposed producer needs an audited output-cardinality contract; never infer a set solely from native piece count or silently take the first output from Split, Separate, Mirror or patterns. Ordinary keyed React arrays are repeated declarations; native BodyPattern and InstancePattern have distinct histories and outputs.

DrawingDocument owns Sheet/View/Section/Detail/Break and annotations. Geometry comes from an owned current Part/Assembly result. A sheet coordinate is not a model coordinate. Drawing units affect printed values; model units remain mm. Viewer belongs to the application integration and consumes a current result; it does not turn annotations or display triangles into native selections.

## Operation source capabilities

| Consumer | Initial admitted source | Existing engine bound |
|---|---|---|
| Extrude | Closed profile, including explicit holes/regions after their batch | Signed nonzero distance; native plane; nonzero draft rejects holes/regions |
| Revolve | One closed outer, optional holes after their batch | No additional regions; current React axis x/y and explicit angle remain |
| Sweep | One closed loop and ordered straight/bend path | No holes/regions; 1..64 steps |
| CurveSweep | Copied native curve resource and compatible profile | Different engine path; no regions; existing holes path is source-visible, unqualified React |
| Loft | Ordered profile sections | 2..64; ordinary z sections on same plane and increasing z; no holes/regions |
| FaceExtrude | Dedicated same-owner planar face producer | Separate source and revision contract; no automatic FaceUV or arbitrary mesh-face admission |
| Hole | Solid plus local center/radius/axis/side/depth | First slice excludes face picks, tap rows and cosmetic thread; countersink later |
| Fillet/Chamfer/Shell/Draft | Solid plus operation-compatible native selections | Names/signatures/held/rematch policy required; no mesh indices |

The source inventory is retained as temporary evidence. Declaration references below are source facts, not product evidence.

## Identity and references

Refs are optional React object tokens. Normal reusable functions, props, state, Fragments, stable keys and forward refs remain the composition model. Automatic feature IDs remain private. A mounted/keyed declaration keeps its identity on supported updates/reorders; remount creates a new identity. Ref objects do not restore source identity after page reload.

All dependency refs belong to one model/document scope. Resolve forward refs from the complete committed registry. Reject missing, duplicate, wrong-kind, cross-scope or cyclic dependencies. Topologically lower dependencies; retain declared operand order where order has meaning. Stage IDs and all derived data; commit them only if the whole graph validates. Reorder tests must check IDs and references, not just shape equality.

Selection handles must carry an opaque producer token, owner scope, source feature/body identity, source declaration version/fingerprint, native semantic name and supported geometry class. An operation validates that envelope against the current parent. Explicit source entity/side tags can name a declared edge. Native names and signatures are evidence for a bounded selection; they are not a guarantee that topology survives every edit. Missing or ambiguous names refuse or enter the existing held/rematch flow. Never refresh an old signature merely because the current name exists. Never expose a display face/triangle/vertex index as persistent topology.

Add capability-branded internal handles without changing existing kind fields first. Public ProfileRef can widen to new closed producers. Narrow consumers still validate capabilities at runtime. Do not make current Extrude accept a union of unsupported source categories merely to advertise breadth. Add an exclusive face prop only with a working FaceExtrude source adapter; keep profile prop backward compatible.

## Units, defaults and ownership

Lengths/points are mm, angles are degrees, model coordinates are Z-up. Preserve omitted native values as omitted. Dense finite tuples are required. No silent inch/model conversion, snapping, healing or default topology selection. New defaults must be listed on the component page and match the existing backend. Resource references include version/content identity and an explicit borrowed/owned disposal policy.

The application owns Worker URL/CSP, mass-provenance integration, files, fonts, library rows, engine lifetime and Viewer canvas. Resources accept person-supplied bytes/rows; components do not download defaults or invent supplier data. Tapped positive lifecycle remains NOT_RUN because no eligible person-loaded row exists. Do not ship made-up fastener rows.

Current synchronous admission remains. Resolve async inputs before mounting the complete Part. A future StagedModel controller can keep a whole pending declaration outside the active root, validate resource completeness, then replace the active checkpoint atomically. This is an explicit app transaction; it must not claim to detect hidden Suspense/Offscreen intent. No StagedModel export before cancellation/version/dispose and mixed-resource tests plus real Viewer evidence exist.

On dirty/invalid/detached state retain the last accepted immutable document but retire its freshness. Current native request, mass merge, rendered frame and readback all need the same owner envelope. Old geometry can remain visible; it must not be reported ready or used by new selection queries. Native evaluation can refuse after declaration acceptance; host status must preserve the prior display and current failure honestly.

## Representative compositions

The first example below is a proposed API. Profile/Outer/Voids are NOT current exports. Polygon is now a current export with the selected D504 pentagon evidence. Profile, Outer and Voids in this proposed composition remain unexported. It shows a multi-loop plate without manual native IDs. Current Rectangle/Circle/Extrude remain valid.

```tsx
function MountProfile({ width, ref }: { width: number; ref?: ProfileRef }) {
  return <Profile ref={ref}>
    <Outer><Polygon points={[[0,0],[width,0],[width,50],[10,50],[0,40]]}/></Outer>
    <Voids>{[15,45].map(x => <Circle key={x} center={[x,20]} radius={4}/>)}</Voids>
  </Profile>;
}
function Mount({ width }: { width:number }) {
  const outline=React.useRef<ProfileHandle|null>(null);
  return <>
    <Definitions><MountProfile ref={outline} width={width}/></Definitions>
    <Extrude distance={8} profile={outline}/>
  </>;
}
// MountProfile is an ordinary user component that forwards its ref to Profile.
```

The next composition is a later target, not executable/current API. A reusable FlangedBearing PartDefinition can contain a revolved closed section, mounting-plate profile, ordered Union and native Hole operations. Assembly places housing/shaft/spacer definitions, grounds the housing, and applies explicit Coincident/Concentric/Distance mates using origin planes or verified native face selections. InstancePattern repeats person-supplied fasteners. The mate solver's remaining freedom must be observed; no dynamic/physics result is implied.

```tsx
<Assembly lifecycle={assemblyHost}>
  <PartDefinitions>
    <PartDefinition ref={housing}><FlangedHousing bore={24}/></PartDefinition>
    <PartDefinition ref={shaft}><SteppedShaft diameter={24}/></PartDefinition>
  </PartDefinitions>
  <Instance ref={fixed} definition={housing} grounded/>
  <Instance ref={moving} definition={shaft}/>
  <Concentric a={verifiedHousingBore} b={verifiedShaftCylinder}/>
  <DistanceMate a={verifiedShoulder} b={verifiedSeat} distance={3}/>
</Assembly>
```

A linked drawing target uses DrawingDocument source={assemblyResult}, explicit assembly geometry scope, two Sheets, front/top/iso Views, Section A, Detail B, edge-bound diameter/linear dimensions, person-supplied revision metadata, datums and a BOM Table. Source revision changes must mark the drawing stale until explicit revision acceptance. Printing/export retains current PDF mismatch and download holds.

## Delivery

Read [component catalogue](./component-catalogue.md), [Model kind catalogue](./model-kind-catalogue.md) and [implementation batches](./implementation-batches.md). The catalog is a design inventory, not placeholder exports. Native storage kinds are only one part of the surface. Each real exported component gets its own docs page/sidebar entry, props, exclusive inputs, output kind, native limits, runnable current example and finite evidence statement. Proposed components stay in design artifacts until functional/native/Viewer proof exists.

Existing HOLDs remain: Studio UI redesign, nonzero-cone STEP offsets, #2258 public-thicken/fitter, #2266 widening, NURBS breadth, new Physics/Motion, manufacturing P2/PG11, PDF mismatch, browser CI, schema/download/release. No component count or percentage follows from 75 storage kinds.

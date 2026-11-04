# @barocss/cad-react

Experimental, private, versioned-in-Git CAD components for React19.2.3. This package composes profile and solid geometry, lowers it to the existing CAD document model, and connects an injected existing engine to the existing `@barocss/viewer`. It contains no Worker implementation or graphics renderer. It is not published.

```tsx
function Plate({width}: {width:number}) {
  return <Extrude distance={6}>
    <Rectangle min={[0,0]} max={[width,60]}/>
  </Extrude>;
}

<Part units="mm" admission="synchronous" lifecycle={host}>
  <Difference>
    <Target><Plate width={width}/></Target>
    <Tools>
      <Extrude from={-1} distance={8}>
        <Circle center={[10,10]} radius={3}/>
      </Extrude>
    </Tools>
  </Difference>
</Part>
```

React runs normal function components and hooks. Committed hidden DOM markers provide parent membership and sibling order; they add no visible UI. Layout-effect leases schedule validated model checkpoints automatically after props or leaf state changes. The compiler does not invoke user functions or infer their rendered geometry from `React.Children`. A separate descriptor check rejects directly supplied known unsupported builtins; it does not execute components.

## Geometry inputs and references

`Rectangle`, `Circle` and `Polygon` produce closed planar profiles. `Extrude` takes exactly one realized profile child or `profile={profileRef}`, never both. Its `distance` maps once to the existing native height; `from` remains an optional local coordinate. The public contract describes profile geometry, not a Sketch-only reference. Internal Sketch nodes are storage lowering. Other region/selection/face producers need their own admitted source capability; existing native planar-face extrusion in Studio is not automatically exposed here. Unsupported face/region/open-wire source descriptors refuse instead of using old displayed geometry or a mesh approximation.

`Union` explicitly joins at least two solid outputs. `Difference` requires one `Target` and one nonempty `Tools` group, applying tools in declared order. `Target` accepts one solid child or `solid={solidRef}`. A normal wrapper can return a compatible output; runtime checks operate on realized outputs rather than raw JSX element count.

Manual native IDs and refs are not required. Optional refs let one branch reuse geometry declared in `Definitions`, without an extra Part output:

```tsx
function SharedProfile() {
  const profile=React.useRef<ProfileHandle|null>(null);
  return <>
    <Definitions><Circle ref={profile} center={[0,0]} radius={4}/></Definitions>
    <Extrude profile={profile} distance={20}/>
  </>;
}
```

Pass the object as a token, not `.current`. Forward it through ordinary components when needed. Handles expose profile/solid kind only; they provide no synchronous geometry. Callback refs are not dependency tokens. Bindings are scoped to one Part; missing/wrong-kind/duplicate/cyclic refs and incompatible operands refuse. Current host identity and normal React keys preserve mounted feature IDs under supported changes. Remounts create new identity. Ref objects and automatic IDs do not reconnect source code to a saved document after reload.

## Rigid transforms

`Translate` and `Rotate` accept exactly one realized solid child or `solid={solidRef}`. They also expose an optional typed solid ref for reuse through Definitions. Profile tokens, mixed ref/child inputs and missing or cyclic solid references refuse through the existing compiler contract.

```tsx
<Translate offset={[30,40,5]}>
  <Rotate axis="z" angle={90} pivot={[0,0,0]}>
    <Bracket width={80}/>
  </Rotate>
</Translate>
```

The nested Rotate lowers before its outer Translate, using existing Model nodes and solid parent refs. Offset and optional pivot require three finite mm coordinates, including each explicit array index; sparse arrays refuse. Axis is x/y/z, angle is finite degrees within the existing absolute3600 limit, and zero is allowed. An omitted pivot stays omitted and uses the existing backend origin default. No transform matrix, trigonometry, tolerance, Worker or renderer is implemented here. Mounted identities/keys retain native IDs; rejected declarations preserve the last accepted document and retire its freshness through the existing lifecycle.

`examples/TransformApp.tsx` supplies desktop Translation X/Rotation Z inputs around the original W80 Bracket. D497 passes 34 controlled tests, package/API types and lint. Its four selected ready states (30/90,50/90,50/180,returned30/90) use the current Worker/Viewer, and the exact returned document opens in Studio. Three new native captures/three physical oracles and two exact-A subproof reuses bind five current consumers. Final saved-data review passes 7959 checks, separate from product tests. The D495 checkpoint below describes the original App. See the [CAD React documentation](../../apps/library-docs/docs/packages/cad-react/index.md) and [D497 qualification](../../apps/cad-studio/handover/notes/cad-react-transforms-docs-2026-11-04/README.md). A global translation followed by automatic framing can produce identical pixels, so frame freshness and world geometry must be checked separately. General native Face/UV producers, async admission and persistent source-code reconnection remain outside this addition.

## Engine and Viewer ownership

Create `ModelHost` after React commit, call `connect()`, and provide it as Part's lifecycle. Its constructor starts no Worker or subscription. Inject an existing client with exclusive evaluation use and a provenance-aware mass merger:

```ts
const host=new ModelHost({
  engine: existingEngineClient,
  ownership: 'borrowed',
  massPolicy: {merge: (bodies,patches) => existingWithMasses(
    bodies,new Map(patches.map(p=>[p.ref,p.fields]))
  )},
  sink: existingViewerSink,
  ownsSink: false,
});
host.connect();
// In the owning effect cleanup:
host.dispose();
```

`existingWithMasses` must retain the existing native provenance checks; merging by numeric massRef alone is not sufficient. The caller owns Worker URL/build/CSP and wire caches. The package neither imports Studio application code nor duplicates its protocol. Borrowed engines/sinks are not restarted/disposed implicitly. Owned resources are released on disposal, and subscriptions are removed for either policy. `examples/App.tsx` shows a consumer that borrows the injected engine and owns a newly created Viewer sink.

The host separates declaration ownership, native request revisions, mass readiness and rendering. Dirty/invalid/detached declarations block old native freshness, including old replies when no new evaluation is submitted. Equivalent valid checkpoints can reuse the current request/result. Previous visible geometry may remain while stale. The Model reader performs its existing output-key normalization; source IDs and references remain authored by the compiler.

`ExistingViewerHost` sends Worker render-only triangles to public `Viewer.loadDisplayMeshes`. All existing mm/Z-up conversion, copy/budget/type guards, Presenter rendering, camera and disposal stay in Viewer. Separate mounted/frame owners authenticate asynchronous readback. `EngineAdapter.freshPresentation` is not Viewer evidence when no transactional presentation port is used. Render meshes provide no native Face/UV authority. The sink's readback metadata is a frame-completion observation, not a physical oracle.

## Supported React boundary

`admission="synchronous"` is an explicit caller contract. Ordinary synchronous wrappers, props, hooks, Fragments, keyed arrays and the measured StrictMode lease lifecycle are supported. Portaled CAD geometry and directly supplied Suspense/lazy/other unsupported async builtins refuse. Nested Parts must be separate model roots.

A user wrapper can hide an internal Suspense boundary whose null fallback leaves a structurally valid smaller Tools graph. The ordinary registry cannot universally detect that intent. Internal Suspense/Offscreen/async transitions are unsupported even if a wrapper hides them; resolve async inputs outside the whole Part before mounting it. This package does not claim whole-intent atomicity for arbitrary React work. No custom reconciler is installed to hide that limit.

Closed profile primitives/extrusion, the declared Boolean composition and existing Model rigid Translate/Rotate lowering form the current capability set. Sketch constraints/multiple-region selection, surface extrusion, general planar-face producers, topology queries, native Face/UV picks, general Suspense, persistent source identity, STEP/STL export convenience, mobile, CI and release are separate work. Native geometry/refusal/budgets remain the existing CAD engine's authority.

## Validation boundaries

This source was ported from preserved local prototypes associated with D483. D483's actual JSX80→100→80/Worker/Viewer and two-width physical evidence belongs to that prototype. It is not current package proof. New compiler/ReactDOM/controlled-adapter/sink/type tests are provided; results must be recorded separately after execution. Controlled replies and fake Viewer readbacks prove ownership logic, not a real Worker, GPU or physical shape.

Available local commands, after the root's source freeze is released and serial gate is assigned:

```sh
node --test tests/*.test.mjs
node ../../node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
node ../../node_modules/typescript/bin/tsc --noEmit -p tests/types/tsconfig.json
```

Use the installed Node22.19.0 and existing dependencies. This private source package uses local workspace paths for type checks; its controlled test loader resolves current Model source explicitly because no new dependency installation or root lockfile update is performed. Distribution output and a standalone packaged Worker are not part of this slice. The manifest declares only the already installed/locked exact React, ReactDOM, type, jsdom, esbuild and TypeScript versions. Root owns the new lockfile importer; no install/download is performed. There is no distribution build script: type-check validates private TypeScript source exports with no emitted package output. A current actual package-consumer Bracket run and independent native volume/centroid/bounds checks require the root's separate gated flow. No broader readiness or release claim follows from source preparation.


### Current measured checkpoint

[D495 qualification](../../apps/cad-studio/handover/notes/cad-react-package-2026-11-04/README.md) records24 unique controlled tests, package/API-example types, lint and final Model types PASS. The current package App/Bracket passes actual props80→100→80 with the existing Worker/Viewer, exact Doc/frame restoration, a separate public Studio Open and independent native physics at both widths. Two captures/two physical-oracle runs and two exact80 physical-subproof reuses bind four current consumers. The preserved fixture/type and Studio preflight failures, recovery-only execution, source custody and finite sampling limits remain explicit there. This is the private source-package checkpoint; distribution/install/dist output, general async/Face-UV and release remain unqualified.

### Current example inspector and documentation

The desktop App and TransformApp now share a right inspector with real numeric controls, collapsible groups, actual host status and Reset. Fresh Width80→100→Reset80 and TransformA→B→C→ResetA flows pass with exact returned Doc/frame, current native/render/frame ownership,1000×700 buffer/10:7 display and no overflow. Collapse/reopen and1200ms idle do not change geometry requests/checkpoints/owners. Status polling lives in the inspector child and is cleaned up on unmount. Seven fresh UI consumers reuse seven exact eligible saved native physical subproofs; no native/oracle/Studio replay is claimed for this presentation change. Observed Transform ready revisions1/2/3/4 and Width1/2/3 are measurements, not a one-request-per-prop guarantee.

The [CAD React documentation category](../../apps/library-docs/docs/packages/cad-react/index.md) contains component-by-component pages and a [full Model-to-React support map](../../apps/library-docs/docs/packages/cad-react/support-map.md). The existing Model backend is broader than these first adapters. Future bridges follow roadmap/source audit; the map does not create exports or release existing HOLDs. Current docs checks and local route verification are recorded with the final delivery receipt, separately from native and package tests.

### Existing Revolve bridge

D499 adds the existing Model Revolve operation as a closed-profile child/ref adapter with sketch x/y axis, explicit angle `(0,360]`, optional finite2D origin and SolidRef output.44 unique controlled tests, package/API-example types and lint pass:43 prior passing cases are retained and one same-key cardinality fixture is corrected and rerun. No native algorithm, tolerance, Worker or renderer API changes.

Actual RevolveApp rectangle `[10,20]..[20,50]`, stored y and omitted origin passes90°/180°/360°/public Reset90°, collapse/reopen/idle and exact returned-document public Studio Open/Frame all. Three native captures and two exact90° physical-subproof reuses bind five fresh consumers. Partial genus0/two radial caps and full genus1/no radial caps are independently checked at1e-9 native budgets. The x axis,Circle,explicit origin,arbitrary angle and downstream combined geometry have no broader physical certificate. High final review passes41014 saved checks plus five post-write64hex document checks, distinct from product tests.

The [Revolve component page](../../apps/library-docs/docs/packages/cad-react/components/revolve.md) gives props and a complete current API example. The new actual Markdown fence types, current 92-page site check/build and 19-page category documentation pass. The final navigation proof passes seven tests and 37 desktop checkpoints: 10 top menus, 26 category-owned topics and the overview, with one active owning menu. Original anchor-checker failure is preserved. This README prose is updated after High finished original execution/cleanup/audit custody; old full4399-source-pin equality is historical. Runtime/example/test modules remain unchanged. No install,publish,distribution,mobile,FaceUV,hidden-async or release promise follows.



### Polygon and full domain design — D504 selected checkpoint

Polygon adds an ordered closed-profile producer with optional ProfileRef, 3..1024 dense finite points and existing native polygon storage. Extrude.profile remains compatible. PolygonApp uses the existing Worker/Viewer integration and Width/Reset inspector. The current 57 controlled tests, package/API-example types and lint pass. Selected convex pentagon widths 60/80 at height 8 pass current Worker/Viewer, independent native checks, invalid recovery, Reset and exact returned-document Studio Open. Two native captures and three exact-document reuses bind five positive consumers. A separate settled Error/coordinate-alert observation retains the previous frame without an extra request; its two Ready antecedents add no physical capture or binding.

The [domain design](./design/README.md), [component catalogue](./design/component-catalogue.md), [Model kind catalogue](./design/model-kind-catalogue.md) and [implementation batches](./design/implementation-batches.md) define the broader profile/wire/region/sketch/constraint/selection/datum/assembly/drawing/resource/view surface. B1 Polygon is a current export with that selected evidence. B2 now adds the six explicit profile elements described below. Other proposed names remain unexported. The 75 Model storage kinds are a source inventory, not a completion count or percentage. Existing geometry/refusal limits and owner HOLDs remain.

All 24 actual Markdown examples pass type checking against the widened current API, and seven navigation tests pass. This declaration proof is separate from native physical evidence. Final site verification receipts are recorded in the handover, rather than treated as package API behavior. This README and final design/library prose are post-audit deltas: the original full execution/cleanup/audit pins describe that recorded checkpoint, not equality after these prose edits. Runtime, examples, tests and navigation source remain unchanged.

## D509 explicit profile composition

D509 implements Loop, LineSegment, ArcSegment, Profile, Outer and Voids. The existing thirteen logical elements remain; the package now has nineteen. The 76 source-checkpoint controls (65 reused with unchanged inputs and 11 newly run), package/API types, lint and four semantic mutation controls pass. The selected all-six SegmentedProfiledPlate passes four original Viewer states and native proof. Returned-document Studio Open/F and the separate compound-metadata consumer pass at their saved source checkpoints. Current-source Studio continuation and fresh documentation verification are recorded separately from geometry evidence.

The measured canonical case is a60×40×8 mm plate: one Loop of four LineSegments as Outer and one Loop with a full CCW ArcSegment as Voids, centered at[30,20], radius6→8→Reset6. All six new elements are realized. Two native captures and two exact-Doc reuses bind four original GUI consumers; one native body/one shell/genus1 is proved only for these states. Blank NaN input waits for visible Error and finite-coordinate alert, submits no extra engine call, retires freshness and retains the preceding radius8 frame. Collapse/reopen/idle/Reset also pass. Recorded Studio Open/F and its fresh Worker binding pass for the exact returned document at that source checkpoint, with source and cleanup verification. Full viewport fitting and raster precision are NOT_MEASURED; the Studio palette can occlude the plate. No general topology, face/UV, NURBS, arbitrary-hole, release or mobile qualification follows.

Loop and Profile produce closed-profile data. Outer/Voids and LineSegment/ArcSegment are structural descriptors, not extra native features. Extrude.profile, old Rectangle/Circle/Polygon lowerings and staged identities remain compatible. Exact circle conversion uses the existing helper with no sampling. Regions, arbitrary plane/face inputs, constraints and Sweep/Loft adapters remain unexported. Holed Revolve keeps its own native admission and remains physically unqualified by this Extrude case. No universal contact/containment repair or refusal is promised. Part remains one logical Model result that can contain multiple native pieces. Optional ModelHost.native.pieces copies a present original field and preserves absence. Its controlled metadata cases pass; the new actual two-piece metadata consumer also passes.

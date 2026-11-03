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

`Rectangle` and `Circle` produce closed planar profiles. `Extrude` takes exactly one realized profile child or `profile={profileRef}`, never both. Its `distance` maps once to the existing native height; `from` remains an optional local coordinate. The public contract describes profile geometry, not a Sketch-only reference. Internal Sketch nodes are storage lowering. Other region/selection/face producers need their own admitted source capability; existing native planar-face extrusion in Studio is not automatically exposed here. Unsupported face/region/open-wire source descriptors refuse instead of using old displayed geometry or a mesh approximation.

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

Closed profile primitives/extrusion and the declared Boolean composition are the initial capability set. Sketch constraints/multiple-region selection, surface extrusion, general planar-face producers, topology queries, native Face/UV picks, general Suspense, persistent source identity, STEP/STL export convenience, mobile, CI and release are separate work. Native geometry/refusal/budgets remain the existing CAD engine's authority.

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

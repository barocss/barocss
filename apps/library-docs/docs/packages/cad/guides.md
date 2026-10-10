# CAD guides

## Construct an XY profile

Choose a builder when you have typed geometric intent:

```ts
import { buildXYProfile, buildXYArc, evaluateCurve } from '@barocss/cad';

const rectangle = buildXYProfile({
  kind: 'rectangle', id: 'outline', origin: [4, -3], width: 7, height: 5,
});
const circle = buildXYArc({ kind: 'circle', id: 'rim', center: [4, -3], radius: 10 });
console.log(evaluateCurve(circle.curve, 0));
```

These return actual source0, Model, Curve and report. Rectangle poles run CCW in XY, start/end coordinates coincide and the degree1 domain is `[0,4]`. Circle geometry uses a degree2 rational representation with nine poles and four original spans over `[0,4]`. A circle pole polygon is not the circle's sampled outline.

Builders copy their own output occurrences. Keep the generated source for editing. Endpoint closure does not certify a topological wire, region or Solid. `buildXYProfile` also supports a line and an open polyline; a crossing open polyline is not a simple-region validator.

## Build a bounded rectangle extrusion

```ts
import { buildAxisRectangleExtrusion } from '@barocss/cad';

const part = buildAxisRectangleExtrusion({
  bodyId: 'part',
  profile: { kind: 'rectangle', id: 'footprint', origin: [4, -3], width: 7, height: 5 },
  distance: 6,
});
console.log(part.solidReport.volumeMM3); // 210
console.log(part.solidReport.areaMM2); // 214
```

This builder requires integer-mm origin, width, height and positive distance within its exact axis-box domain. It returns source2, the original profile, six planar faces, shell, native model and separate solid report. The profile report remains `regionCertified:false`; the shell report is distinct from the qualified solid report.

After editing source parameters, compile again and reconstruct/revalidate the actual new faces and shell. The old solid report cannot certify new geometry. An IGES export of the Curve and six Surfaces remains geometry entities, not a serialized closed Solid.

## Query original parameters and derivatives

Use `curveDomain` or `surfaceDomain` before querying. Do not assume every domain is `[0,1]`:

```ts
import { curveDomain, evaluateCurveD1 } from '@barocss/cad';

const [a, b] = curveDomain(rectangle.curve);
const d1 = evaluateCurveD1(rectangle.curve, a + (b - a) / 8);
console.log(d1.point, d1.derivative);
```

`rectangle` comes from the first example. The query lies inside the first span. Derivatives use mm per original dimensionless parameter and are not normalized. `evaluateSurfaceD1(surface,u,v)` returns point, `du` and `dv`. Endpoints use the interior one-sided span. Exact interior knots refuse D1 when degree minus multiplicity is less than one. Point queries can still succeed there. A finite zero derivative does not certify regularity or define a unit normal.

## Sample a Surface for display

Call `tessellateSurface(surface,{countU,countV,revision})` after native validation. It samples uniform original U/V parameters including endpoints and returns `{packet,report}`. The host supplies revision; it records provenance, not freshness. Packet arrays use U-major rows and preserve native XYZ in mm under the declared right-handed Y-up convention.

Normals come from area-weighted incident triangles. They are preview normals rather than exact derivative normals. The five probes per cell report `maxSampledDeviationMM` with `certified:false`. Increasing the grid can improve a sampled display but cannot turn this report into a global error bound. Collapsed triangles and inconsistent normals refuse; no repair silently changes the packet.

Follow [the complete plane example](./examples#sample-a-plane-and-prepare-gpu-buffers) and [GPU conversion guide](../gpu/guides#display-a-cad-surface). Keep native data independently from the mesh.

## Persist intent rather than pixels

Use the exported serializer/parser pair for the specific native document family you use. The public API includes rectangle features, polygon prisms, circle feature graphs, driven sketches, assemblies and additional bounded families. Each has its own version, ID/reference rules and error domain. Read [the exact export inventory](./api#public-root-inventory) to choose the operation.

Do not use a display GLB as an editable-document format. Do not serialize an IR or operation report as a universal CAD file merely because it is JSON data. Preserve source, native document, owning IDs and reports separately. Failed edits must leave the previously accepted host document available.

---

Source snapshot: local Git `5f5ad866205a21510ac69552e704cc162fa253b5`. `packages/barocss-cad/package.json` (Manifest; local source), [public root](/packages/cad/reference#declarations-f921e035f2c3), `packages/barocss-cad/README.md` (package README; local source). Source references identify that fixed snapshot. This native source commit is local-only; public declaration references open in this portal. Local source is the authority for this manual.

[Overview](./) · [Quickstart](./quickstart) · [Guides](./guides) · [API](./api) · [Examples](./examples) · [Limits](./limits)

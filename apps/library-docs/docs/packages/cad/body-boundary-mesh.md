# Mesh a qualified Body boundary

A boundary mesh approximates the **occupied portions** of a Body's six Faces. It must follow their trim loops and shared Edges. Sampling each entire Support Surface would include geometry outside the Body and would lose the shared boundary structure.

The experimental `@barocss/cad` API described here is available in provider `29f8934a`. Its packet and report schemas are version 0. The earlier `ded1ef68` [Body provider](./body-1301) supplies the Body constructors, but does not include these mesh functions. The `5f5ad866` provider used by the general reference and existing geometry playground also lacks them. Use a CAD build that includes this newer API; source entries need a TypeScript-capable bundler.

![Numeric projection of the shared Body boundary packet](/examples/body-boundary-mesh.svg)

The image projects the shared packet's native XYZ positions and indexed triangles. It is a numeric geometry view, not a GPU rendering result or a new Solid certificate.

## Load a complete Body and mesh its trimmed Faces

<a :href="withBase('/examples/body-boundary-mesh/main.owned-body.json')" download>Download the complete Body input</a>. This JSON contains the full `main_body` result, including its qualified parents, original sources, two Models, topology and material proof. It is 1,997,294 bytes. Its exact parent volume is 520 mm³; it is a different Body from the smaller examples in other guides.

The following browser application code reads the whole Body, tessellates it and validates the whole mesh result. Serve the downloaded asset at the shown URL in your application. Do not replace it with only its `body`, `models` or `report` field.

```ts
import {
  tessellateQualifiedTranslatedStripBody,
  validateQualifiedTranslatedStripBodyMesh,
  QualifiedTranslatedStripBodyMeshError,
} from '@barocss/cad';
import type {
  QualifiedTranslatedStripBodyResult,
  QualifiedTranslatedStripBodyMeshResult,
} from '@barocss/cad';

let accepted: QualifiedTranslatedStripBodyMeshResult | null = null;

export async function loadBodyBoundaryMesh() {
  const response = await fetch('/examples/body-boundary-mesh/main.owned-body.json');
  if (!response.ok) throw new Error(`Body download failed: ${response.status}`);
  const text = await response.text();
  const fullBody = JSON.parse(text) as QualifiedTranslatedStripBodyResult;

  try {
    const candidate = tessellateQualifiedTranslatedStripBody(fullBody, {
      evaluationId: 'main_mesh_eval',
      meshId: 'main_mesh',
      subdivisionsPerOriginalUSpan: 4,
      subdivisionsT: 4,
      subdivisionsW: 4,
      maximumVertices: 290,
      maximumTriangles: 576,
      maximumNativeSamples: 1104,
    });
    const report = validateQualifiedTranslatedStripBodyMesh(candidate);
    accepted = candidate;
    return { mesh: accepted, report };
  } catch (error) {
    if (error instanceof QualifiedTranslatedStripBodyMeshError) {
      console.error(error.code, error.message);
    }
    throw error;
  }
}
```

The TypeScript assertion does not validate downloaded data. The tessellator validates the complete qualified Body before native sampling. The mesh validator reconstructs the Body mesh and compares every retained field; it returns an independent report. Assignment to `accepted` occurs only after both calls succeed, so a refused replacement retains the previous mesh.

```text
tessellateQualifiedTranslatedStripBody(
  body: QualifiedTranslatedStripBodyResult,
  options: QualifiedTranslatedStripBodyMeshOptions,
): QualifiedTranslatedStripBodyMeshResult

validateQualifiedTranslatedStripBodyMesh(
  input: QualifiedTranslatedStripBodyMeshResult,
): QualifiedTranslatedStripBodyMeshReport
```

The public types also include `QualifiedTranslatedStripBodyMeshPacket`. Supply exactly the eight option fields shown above. All six numeric values are fixed profile values, not adjustable quality settings. `evaluationId` and `meshId` must differ and contain 1..48 ASCII characters: a letter or underscore first, then letters, digits or underscores.

## Read the shared packet and the six display chunks

The complete result has eight fields:

```text
body, options, packet, edgePaths, faceSamples, renderChunks, proof, report
```

`body` retains the complete parent result and unchanged material flags. Its topology has 8 Vertices, 12 Edges, 6 Faces and 24 Uses. Its eighteen geometry objects remain in two source-qualified Models with 16 and 2 objects. `sourceId`, `model.name` and local `objectId` have different roles; resolve `curveRef` and `supportRef` through their owning Model.

`packet` has schema `barocss-qualified-translated-strip-body-mesh`, version 0. Its `positionsMM` is a flat XYZ array tagged `binary64-number`; its flat triangle `indices` is tagged `uint32-number`. These are ordinary number arrays. It also retains vertex provenance, triangle Face/cell memberships, bounds, Body/Shell IDs and the material-certificate ID.

The supplied four-span Body produces these counts:

| Data | Count |
| --- | ---: |
| Shared mesh vertices / triangles / mesh edges | 290 / 576 / 864 |
| Face sample occurrences / Use samples | 390 / 216 |
| Separate faceted chunks / expanded display corners | 6 / 1728 |
| New native evaluation attempts | 1104 |

The chunks follow `lower`, `upper`, `cap`, `base`, `uMin`, `uMax` order. Each has `positionsMM` and `normals` tagged `float32-number`, `parametersUV` tagged `binary64-number`, and `indices` tagged `uint32-number`. `authorityIndices`, `faceSampleIndices` and `triangleIndices` map its expanded corners back to the shared packet and native samples. The arrays contain numbers already rounded to Float32 where tagged; they are not GPU buffers.

XYZ stays in authored mm, with `sourceFrame: 'authored-xyz-no-axis-conversion'`. Native UV is dimensionless and preserves each Surface's chart and original domains. Apply any application axis or scene-unit conversion once, to a display copy. Keep the retained packet, UV and source-qualified data unchanged.

## Keep native normals and facet normals distinct

Each `faceSamples` entry retains its native UV, D0 point, shared anchor and measured gap. The original eight stored corners provide corner authority; canonical World Edge samples supply the shared edge interiors. Each Face retains its own pcurve/UV witnesses at a shared boundary position. This process does not average, weld or snap nearby coordinates.

For this Body, 345 native Surface D1 attempts evaluate and 45 refuse at actual C0 interior knots. A refused entry has `d1.status: 'refused-c0'`, an error name/reason, and `point`, `du`, `dv`, `orientedNormal` and `pointGapMM` all `null`. No smooth native normal is fabricated there.

Display normals instead carry `normalSource: 'approximate-triangle-geometry'`. They come from each triangle's geometry and are checked against outward winding, including the rounded Float32 positions. `quantizationGapsMM` records the position rounding gaps. These facet observations do not replace native D1 states or establish a global approximation error bound.

## Understand what validation establishes

The discrete proof checks two opposite triangle Uses per mesh edge, connected triangle/vertex graphs, one connected oriented link cycle per vertex and Euler characteristic 2. It also checks the CAD Edge/Face memberships and trimmed sample bindings. These establish a closed indexed manifold **structure**.

The parent Body's exact whole material-boundary proof remains separately retained. Mesh validation does not establish geometric embedding of the triangles, exact mesh volume, a global error bound, a new Solid qualification or manufacturing fitness. Renderer and Loader acceptance are separate consumer contracts; a validated CPU result alone does not establish them.

The existing `@barocss/cad-interop/qualified-body` reader admits the complete Body family. It does not admit the complete eight-field mesh wrapper. Reading only `mesh.body` qualifies the retained parent, not the mesh. Pass the whole result to `validateQualifiedTranslatedStripBodyMesh`; a renderer or mesh reader needs its own supported consumer.

## Ownership, limits and refusals

Results and validator reports are independently copied, mutable CPU data. They are not promised to be deeply frozen. Changes to any stored field require complete revalidation; changing a quality flag cannot qualify geometry. They allocate no rendering or event resources. Release application references when no longer needed.

Preserve represented numbers when storing complete data. `JSON.parse` retains numeric `-0`; ordinary `JSON.stringify` changes it to `0`. A complete restored result can refuse if those bits or any provenance, counters, UV, normals or arrays change.

| Resource | Fixed boundary |
| --- | --- |
| Original U spans / stations | 1..4 / at most 17; four divisions per original span |
| T and W divisions | 4 each |
| Vertices / triangles / mesh edges | 290 / 576 / 864 |
| Face samples / Use samples / new native attempts | 390 / 216 / 1104 |
| Expanded render vertices | 1728 |
| Complete mesh request and result | 4194304 UTF-16 units and UTF-8 bytes each, including final newline |
| Retained parent Body request/result | Existing 2097152 UTF-16/UTF-8 limits remain |
| Own values / depth / array elements / record fields | 4194304 / 64 / 8192 / 64 |
| Key / string length | 128 / 262144 characters |
| Endpoint, anchor and D1 point gaps | At most 1e-7 mm |
| Float32 facet-normal unit residual | At most 1e-5 |

Direct native counts exclude work performed inside parent validation. Outside parent validation, direct mesh work performs no source compilation/writing, new Body construction, Curve D1, Surface D2, root solving or adaptive refinement. Fewer spans produce fewer samples; the limits do not authorize a partial mesh.

`QualifiedTranslatedStripBodyMeshError` has `code`, a message bounded to 1024 characters and the actual wrapped `cause` where supplied:

| Codes | Refused condition |
| --- | --- |
| `INPUT`, `BUDGET`, `FILE` | Own-data shape, IDs, fixed resources or complete representation size |
| `BODY`, `SOURCE` | Complete parent validity or source-qualified geometry |
| `TOPOLOGY`, `UV`, `ORIENTATION` | Shared memberships, occupied chart/sample bindings or direction |
| `NATIVE`, `REPRESENTABILITY` | Native evaluation or finite, noncollapsed, consistently wound display arithmetic |
| `OWNED` | Complete reconstruction or comparison of a stored mesh |

Use dense plain own-data arrays and records. Accessors, symbols, hidden fields, cycles and foreign prototypes refuse. A failed call returns no partial mesh and preserves caller data.

[Qualified Body](./body-1301) · [CAD API](./api) · [Geometry examples](./examples)

<script setup>
import { withBase } from 'vitepress'
</script>

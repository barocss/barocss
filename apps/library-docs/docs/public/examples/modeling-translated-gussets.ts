import { cad, type CadModelSnapshot, type CadStlExport } from '@barocss/cad';

/** The measured #1880 recipe; importing this module performs no modeling work. */
export function makeTranslatedGussets(): CadModelSnapshot {
  const model = cad.model(), width = model.parameter('width', 40), height = model.parameter('height', 24);
  const sketch = model.sketch.constrainedPolygon(s => {
    const a = s.point([-0, 0]), b = s.point([width, 0]), c = s.point([width, height]), d = s.point([1, height]);
    s.fixed(a); s.fixed(b); s.fixed(c); s.horizontal(c, d); s.parallelTo(d, a, [1, 3]);
    return [a, b, c, d];
  });
  const gusset = sketch.extrude(8);
  const spacing = model.parameter('spacing', 48), offsetY = model.parameter('offsetY', -0), offsetZ = model.parameter('offsetZ', 0);
  const right = gusset.translate([spacing, offsetY, offsetZ]);
  return model.build({ left: gusset, right });
}

/** A refused exact-coordinate edit leaves the caller's accepted snapshot usable. */
export function spaceTranslatedGussets(accepted: CadModelSnapshot, spacing: number): CadModelSnapshot {
  return accepted.withParameters({ spacing });
}

// In a CAD host: const initial = makeTranslatedGussets();
// const savedText = initial.save(); // Paste into Modeling > Saved model data.
// const wider = spaceTranslatedGussets(initial, 64);
// const reopened = cad.load(wider.save()); // Rebuilds authored intent, not a mesh cache.

/** Export one named convex output. The caller owns saving these returned bytes. */
export function exportRightGusset(accepted: CadModelSnapshot): CadStlExport {
  return accepted.exportStl('right');
}

// const result = exportRightGusset(initial);
// const fileBytes = Uint8Array.from(result.bytes); // Save with your host's file API.
// result.outputName; result.byteLength; result.triangleCount;
// result.maximumVertexDisplacementMM; // Measured Float32 loss, not a tolerance certificate.
// result.details.encoding.vertexLosses; // Original and quantized coordinates.
// Keep initial.save() separately when you need editable CAD intent.

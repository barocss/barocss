// Compile-only public example for #1919. Never execute this file.
import { cad, type CadShape, type CadModelSnapshot, type CadDimension } from '@barocss/cad';
const model = cad.model();
const frontDistance = model.parameter('frontDistance', 1), backDistance = model.parameter('backDistance', 2);
const backY = model.parameter('backY', 24), spacing = model.parameter('spacing', 48);
const blank: CadShape = model.sketch.rectangle({ width: 32, height: 24 }).extrude(8);
const front: CadShape = blank.chamfer(blank.edges({ parallelTo: 'x', at: { y: 0, z: 'max' } }).one(), frontDistance);
const finished: CadShape = front.chamfer(front.edges({ parallelTo: 'x', at: { y: backY, z: 'max' } }).one(), backDistance);
const offset: readonly [CadDimension, CadDimension, CadDimension] = [spacing, -0, 0];
const right: CadShape = finished.translate(offset);
const baseline: CadModelSnapshot = model.build({ left: finished, right });
const wider = baseline.withParameters({ spacing: 64 });
const changed = wider.withParameters({ backDistance: 3 });
const recovered = changed.withParameters({ spacing: -48 });
const reopened: CadModelSnapshot = cad.load(baseline.save());
void recovered; void reopened;
for (const feature of baseline.evidence) {
  if (feature.kind === 'chamfer') {
    const selected: string = feature.native.request.selection.parentSolidId;
    const retained: string = feature.native.lineage.chamferFaceKey;
    void selected; void retained;
  }
  if (feature.kind === 'translate') {
    const volume: string = feature.native.solid.certificate.volumeMM3.numerator;
    const faceCount: number = feature.native.lineage.faces.length;
    const useId: string = feature.native.lineage.uses[0].translated.useId;
    void volume; void faceCount; void useId;
    // @ts-expect-error The native evidence binding is readonly; nested runtime freeze is tested separately.
    feature.native = feature.native;
    // @ts-expect-error No weakened family or bounds-only certificate is exposed.
    feature.native.boundsOnly;
  }
}
// @ts-expect-error A translation has exactly three length components.
finished.translate([spacing, 0]);
// @ts-expect-error Translation accepts no matrix/options overload.
finished.translate(offset, { copy: true });
// @ts-expect-error Authored dimensions do not accept expression strings.
finished.translate(['spacing', 0, 0]);
// @ts-expect-error Returned snapshots remain read-only.
baseline.parameters.spacing = 72;

const named = cad.model(), namedBlank = named.sketch.rectangle({ width: 32, height: 24 }).extrude(8);
const namedFront = namedBlank.chamfer(namedBlank.edges({ parallelTo: 'x', at: { y: 0, z: 'max' } }).one(), 1, { name: 'front' });
const namedCopy = namedFront.translate([48, -0, 0]);
const selected = named.build({ left: namedFront, right: namedCopy }).withSuppression({ front: true });
selected.save();

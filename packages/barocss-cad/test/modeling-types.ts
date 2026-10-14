import { cad, type CadModelSnapshot, type CadShape, type CadParameter, type CadSplit, type CadDimensionExpression, type CadBody, type CadCut, type CadStlExport } from '../src/index.js';
const composedModel = cad.model();
const composedA = composedModel.sketch.rectangle({ width: 32, height: 8 }).extrude(8);
const composedB = composedModel.sketch.rectangle({ width: 8, height: 24 }).extrude(8);
const composedUnion = composedA.union(composedB);
const composedTool = composedModel.sketch.rectangle({ min: [16, 2], max: [24, 6] }).extrude(8);
const composedSnapshot = composedModel.build({ slotted: composedUnion.cut(composedTool) });
for (const feature of composedSnapshot.evidence) if (feature.kind === 'difference') {
  if (feature.composition === 'union-slot') {
    feature.native.left.result.panels; feature.native.panels[0].parentPanels;
    feature.parent.a.source; feature.tool.certificate;
    // @ts-expect-error Composed evidence is not the legacy convex-parent tuple.
    feature.parents;
  } else { feature.parents[0].certificate; feature.native.a.source; }
}
const model = cad.model();
const width: CadParameter = model.parameter('width', 80);
const plate: CadShape = model.sketch.rectangle({ min: [0, 0], max: [width, 60] }).extrude(10);
const result: CadModelSnapshot = model.build({ plate });
const wider = result.withParameters({ width: 100 });
const reopened = cad.load(wider.save());
if (reopened.bodies.plate.family !== 'convex-planar') throw new Error('Expected a convex plate');
reopened.bodies.plate.native.certificate.volumeMM3;
const serial = cad.model(), setback = serial.parameter('setback', 1);
const blank = serial.sketch.polygon([[0,0],[32,0],[32,16],[16,32],[0,32]]).extrude(8);
const tool = serial.sketch.rectangle({ min: [8,-16], max: [16,48] }).extrude(8);
const cut = blank.cut(tool, { axis: 'x' });
const part = cut.positive.chamfer(cut.positive.edges({ parallelTo: 'x', at: { y: 0, z: 'max' } }).one(), setback);
serial.build({ part, other: cut.negative });
// @ts-expect-error Public cut is cardinal through-slab only.
blank.cut(tool, { axis: 'z' });
// @ts-expect-error Scalar parameter values have explicit mm number input.
model.parameter('bad', '8');
const overlapModel = cad.model();
const left = overlapModel.sketch.rectangle({ width: 16, height: 16 }).extrude(8);
const right = overlapModel.sketch.rectangle({ min: [8, 0], max: [24, 16] }).extrude(4);
const overlap: CadShape = left.intersect(right);
const overlapResult: CadModelSnapshot = overlapModel.build({ overlap });
overlapResult.features[4].dependencies;
// @ts-expect-error Intersection accepts a same-model shape handle, not a serialized reference.
left.intersect({ node: 3, side: 'solid' });
const splitModel = cad.model();
const splitHeight = splitModel.parameter('splitHeight', 2);
const splitBlank = splitModel.sketch.rectangle({ width: 16, height: 8 }).extrude(8);
const halves: CadSplit = splitBlank.split({ axis: 'z', at: splitHeight });
const splitResult: CadModelSnapshot = splitModel.build({ lower: halves.negative, upper: halves.positive });
splitResult.withParameters({ splitHeight: 4 }).save();
for (const axis of ['x', 'y'] as const) {
  const m = cad.model(), location = m.parameter('splitAt', 2);
  const parts: CadSplit = m.sketch.rectangle({ width: 16, height: 8 }).extrude(8).split({ axis, at: location });
  m.build({ negative: parts.negative, positive: parts.positive });
}
// @ts-expect-error Split uses a cardinal axis, not an arbitrary plane description.
splitBlank.split({ axis: 'w', at: 2 });
// @ts-expect-error The plane location uses a number or owned dimension handle.
splitBlank.split({ axis: 'z', at: '2' });

const chainModel = cad.model(), frontDistance = chainModel.parameter('frontDistance', 1), backDistance = chainModel.parameter('backDistance', 2);
const chainBlank = chainModel.sketch.rectangle({ width: 32, height: 24 }).extrude(8);
const front = chainBlank.chamfer(chainBlank.edges({ parallelTo: 'x', at: { y: 0, z: 'max' } }).one(), frontDistance);
const finished = front.chamfer(front.edges({ parallelTo: 'x', at: { y: 24, z: 'max' } }).one(), backDistance);
chainModel.build({ finished }).withParameters({ backDistance: 3 }).save();

const reusedFeatureIndices: readonly number[] = reopened.recomputation.reusedFeatures;
const evaluatedFeatureIndices: readonly number[] = reopened.recomputation.evaluatedFeatures;
void reusedFeatureIndices; void evaluatedFeatureIndices;
// @ts-expect-error Recompute diagnostics are immutable derived data.
reopened.recomputation.reusedFeatures.push(0);
// @ts-expect-error There is no caller-supplied reuse/cache parameter.
reopened.withParameters({ width: 80 }, { evidence: [] });

const dividedRail: CadSplit = finished.split({ axis: 'x', at: chainModel.parameter('splitAt', 16) });
chainModel.build({ negative: dividedRail.negative, positive: dividedRail.positive }).withParameters({ splitAt: 8 });

const derivedModel = cad.model(), drivenWidth = derivedModel.parameter('width', 32), offset = derivedModel.parameter('offset', 0);
const midpoint: CadDimensionExpression = derivedModel.dimension.add(derivedModel.dimension.scale(drivenWidth, .5), offset);
const drivenBlank = derivedModel.sketch.rectangle({ width: drivenWidth, height: derivedModel.dimension.add(12, 12) }).extrude(8);
const drivenHalves = drivenBlank.split({ axis: 'x', at: midpoint });
derivedModel.build({ negative: drivenHalves.negative, positive: drivenHalves.positive }).withParameters({ width: 40, offset: 4 });
// @ts-expect-error Scale is a numeric dimensionless factor, not a length handle.
derivedModel.dimension.scale(drivenWidth, drivenWidth);
// @ts-expect-error No expression strings or parser API.
derivedModel.dimension.add(drivenWidth, 'offset');
// @ts-expect-error Expression metadata is readonly, and never editable formula input.
midpoint.kind = 'other';

const miterModel = cad.model(), cutPosition = miterModel.parameter('cutPosition', 24);
const miterBlank = miterModel.sketch.rectangle({ width: 32, height: 24 }).extrude(8);
const miterParts: CadSplit = miterBlank.split({ plane: 'x+y', at: miterModel.dimension.add(cutPosition, 0) });
miterModel.build({ negative: miterParts.negative, positive: miterParts.positive }).withParameters({ cutPosition: 28 });
// @ts-expect-error Axis and plane are mutually exclusive even on a non-literal variable.
const bothPlanes: Parameters<CadShape['split']>[0] = { axis: 'x', plane: 'x+y', at: 24 };
void bothPlanes;
// @ts-expect-error One axis or fixed plane is required.
miterBlank.split({ at: 24 });
// @ts-expect-error Only the fixed x+y plane enum is supported.
miterBlank.split({ plane: 'x-y', at: 24 });
// @ts-expect-error Arbitrary normals are not an admitted plane option.
miterBlank.split({ normal: [1,1,0], at: 24 });

const finishModel = cad.model(), finishBlank = finishModel.sketch.rectangle({ width: 32, height: 24 }).extrude(8);
const finishEdge = finishBlank.edges({ parallelTo: 'x', at: { y: 0, z: 'max' } }).one();
const optionalFinish: CadShape = finishBlank.chamfer(finishEdge, 1, { name: 'frontFinish' });
const finishSnapshot = finishModel.build({ part: optionalFinish });
const configured: CadModelSnapshot = finishSnapshot.withSuppression({ frontFinish: true });
const finishStates: Readonly<Record<string, boolean>> = configured.suppression;
void finishStates; configured.features[2].name; configured.features[2].suppressed;
// @ts-expect-error Finishing states are strict booleans, not numeric dimensions.
finishSnapshot.withSuppression({ frontFinish: 1 });
// @ts-expect-error Configuration is readonly.
finishSnapshot.suppression.frontFinish = true;
// @ts-expect-error Boolean state is not a millimeter parameter value.
finishModel.parameter('enabled', false);
// @ts-expect-error Initial finish options name the feature; they cannot skip initial native validation.
finishBlank.chamfer(finishEdge, 1, { name: 'frontFinish', suppressed: true });

const holeModel = cad.model(), holeRadius = holeModel.parameter('radius', 5);
const holeBlank = holeModel.sketch.rectangle({ width: 80, height: 40 }).extrude(8);
const drilled: CadShape = holeBlank.hole({ center: [holeModel.dimension.add(20, 20), 20], radius: holeRadius });
const holeSnapshot: CadModelSnapshot = holeModel.build({ blank: holeBlank, plate: drilled });
holeSnapshot.withParameters({ radius: 2.5 }).save();
function inspectBody(body: CadBody) {
  switch (body.family) {
    case 'convex-planar': return body.native.certificate.volumeMM3;
    case 'stored-rational-plate-hole': return body.native.certificate.genus;
    case 'orthogonal-cell': return body.native.report.volumeMM3;
    case 'stored-rational-circle-prism': return body.native.certificate.genus;
    default: { const exhaustive: never = body; return exhaustive; }
  }
}
inspectBody(holeSnapshot.bodies.plate);
// @ts-expect-error The one public body contract requires explicit family narrowing and unwrapping.
holeSnapshot.bodies.plate.certificate;
// @ts-expect-error A stored-rational hole does not have a certified analytic cylinder volume.
if (holeSnapshot.bodies.plate.family === 'stored-rational-plate-hole') holeSnapshot.bodies.plate.native.certificate.volumeMM3;
// @ts-expect-error Centre requires exactly two owned dimensions.
holeBlank.hole({ center: [40, 20, 0], radius: 5 });
// @ts-expect-error The bounded feature is through-hole only, without a depth option.
holeBlank.hole({ center: [40, 20], radius: 5, depth: 4 });
// @ts-expect-error Radius is a millimetre dimension, not text.
holeBlank.hole({ center: [40, 20], radius: '5' });

const unionModel = cad.model(), unionWidth = unionModel.parameter('legWidth', 8);
const unionA = unionModel.sketch.rectangle({ width: 32, height: 8 }).extrude(8);
const unionB = unionModel.sketch.rectangle({ width: unionWidth, height: 24 }).extrude(8);
const joined: CadShape = unionA.union(unionB);
const joinedSnapshot = unionModel.build({ bracket: joined });
if (joinedSnapshot.bodies.bracket.family === 'orthogonal-cell') joinedSnapshot.bodies.bracket.native.report.volumeMM3;
joinedSnapshot.withParameters({ legWidth: 12 }).save();
// @ts-expect-error Only an owned shape handle is an operand, not a serialized body reference.
unionA.union({ node: 3, side: 'solid' });

const cutModel = cad.model(), cutDepth = cutModel.parameter('depth', 4);
const cutPlate = cutModel.sketch.rectangle({ min: [-0, 0], max: [32, 24] }).extrude(8);
const cutTool = cutModel.sketch.rectangle({ min: [8, 8], max: [24, 16] }).extrude(cutDepth);
const recessed: CadShape = cutPlate.cut(cutTool);
const cutSnapshot: CadModelSnapshot = cutModel.build({ part: recessed });
cutSnapshot.withParameters({ depth: 8 }).save();
const throughSlab: CadCut = cutPlate.cut(cutTool, { axis: 'x' });
void throughSlab;
// @ts-expect-error Omitted options return one shape, not a pair.
const notPair: CadCut = cutPlate.cut(cutTool);
// @ts-expect-error Explicit axis options return a pair, not a shape.
const notShape: CadShape = cutPlate.cut(cutTool, { axis: 'y' });
// @ts-expect-error Explicit undefined is not omission.
cutPlate.cut(cutTool, undefined);
// @ts-expect-error Empty options are ambiguous and refused.
cutPlate.cut(cutTool, {});
// @ts-expect-error Null is not an axis record.
cutPlate.cut(cutTool, null);
// @ts-expect-error Legacy through-slab has only x/y axes.
cutPlate.cut(cutTool, { axis: 'z' });
// @ts-expect-error No third argument.
cutPlate.cut(cutTool, { axis: 'x' }, true);
// @ts-expect-error An owned shape is required.
cutPlate.cut({ node: 3, side: 'solid' });
void notPair; void notShape;

const round = cad.model(), diameter = round.parameter('diameter', 8);
const post: CadShape = round.sketch.circle({ center: [2, -3], radius: round.dimension.scale(diameter, .5) }).extrude(6);
const roundSnapshot = round.build({ post });
roundSnapshot.withParameters({ diameter: 4 }).save();
// @ts-expect-error Circle requires exact XY center and radius, not a diameter option.
round.sketch.circle({ center: [0, 0], diameter });
// @ts-expect-error Circle center has exactly two owned length dimensions.
round.sketch.circle({ center: [0, 0, 0], radius: 4 });
// @ts-expect-error Radius is not an expression string.
round.sketch.circle({ center: [0, 0], radius: 'diameter/2' });
if (roundSnapshot.bodies.post.family === 'stored-rational-circle-prism') {
  const noVolume: true = roundSnapshot.bodies.post.native.certificate.solid;
  void noVolume;
  // @ts-expect-error The exact stored-rational qualification supplies no ideal volume.
  roundSnapshot.bodies.post.native.certificate.volumeMM3;
}
for (const feature of roundSnapshot.evidence) {
  if (feature.kind === 'sketch') {
    if (feature.profile === 'circle') feature.native.curve.controlPoints;
    else feature.native.solution.points;
  } else if (feature.kind === 'extrude') {
    if (feature.profile === 'circle') feature.native.parent.profile.source;
    else feature.native.solid.certificate;
  }
}

const offsetModel = cad.model(), offsetDepth = offsetModel.parameter('depth', 4);
const offsetSketch = offsetModel.sketch.rectangle({ min: [8, 8], max: [24, 16] });
const offsetTool: CadShape = offsetSketch.extrude(offsetDepth, { from: offsetModel.dimension.add(8, offsetModel.dimension.scale(offsetDepth, -1)) });
const signedOffset: CadShape = offsetSketch.extrude(3, { from: -0 });
void offsetTool; void signedOffset;
// @ts-expect-error Explicit undefined is not omitted extrusion options.
offsetSketch.extrude(3, undefined);
// @ts-expect-error An exact from record is required.
offsetSketch.extrude(3, {});
// @ts-expect-error No third argument.
offsetSketch.extrude(3, { from: -2 }, true);
// @ts-expect-error No expression strings.
offsetSketch.extrude(3, { from: 'height-depth' });
// @ts-expect-error The one option is an absolute start, not an arbitrary transform.
offsetSketch.extrude(3, { from: 2, axis: 'z' });
// @ts-expect-error Null is not an options record.
offsetSketch.extrude(3, null);

import type { XYAffineSketchPrismOffsetCoordinateSpanOptions, XYAffineSketchPrismOffsetCoordinateSpanResult, XYAffineSketchSuccess } from '../src/index.js';
import { buildXYAffineSketchPrism, validateXYAffineSketchPrism } from '../src/index.js';
declare const ownedOffsetSketch: XYAffineSketchSuccess;
const nativeOffsetOptions: XYAffineSketchPrismOffsetCoordinateSpanOptions = { sourceId: 'src', sourceRevision: 0, orderedSegmentIds: ['a','b','c','d'],
  heightMM: 3, capChart: { originXY: [-3,2], spanXY: [3,5] }, chartPolicy: { version: 1, kind: 'coordinate-span' }, solidId: 'solid', resultIdPrefix: 'prism', fromMM: -2 };
const qualifiedOffset: XYAffineSketchPrismOffsetCoordinateSpanResult = buildXYAffineSketchPrism(ownedOffsetSketch, nativeOffsetOptions);
const actualOffset: number = validateXYAffineSketchPrism(qualifiedOffset).fromMM;
const sourceTranslation: number = qualifiedOffset.lineage.sourceToBottomTranslationMM[2];
void actualOffset; void sourceTranslation;


import type { CadMassProperties, CadMassPropertiesOptions } from '../src/index.js';
const densityOptions: CadMassPropertiesOptions = { densityKgPerM3: 2700 };
const massProperties: CadMassProperties = offsetModel.build({ tool: offsetTool }).massProperties('tool', densityOptions);
const massKG: number = massProperties.massKG;
const massCenter: readonly [number, number, number] = massProperties.centroidMM;
const inertiaEntry: number = massProperties.inertiaCentroidKgM2[0][0];
const exactVolume: string = massProperties.details.exact.volumeMM3.numerator;
const massErrorUpper: number = massProperties.details.conversionErrors.massKG.upper;
if (massProperties.family === 'convex-planar') massProperties.details.native.solid.certificate;
else if (massProperties.family === 'orthogonal-cell') massProperties.details.native.boolean.panels;
else { const neverFamily: never = massProperties; void neverFamily; }
// @ts-expect-error Density options are required.
cutSnapshot.massProperties('part');
// @ts-expect-error Explicit undefined is not density options.
cutSnapshot.massProperties('part', undefined);
// @ts-expect-error No implicit material or extra density unit.
cutSnapshot.massProperties('part', { densityKgPerM3: 2700, material: 'aluminium' });
// @ts-expect-error No caller body or native ID argument.
cutSnapshot.massProperties(cutSnapshot.bodies.part, densityOptions);
// @ts-expect-error The public options have no native budget knobs.
cutSnapshot.massProperties('part', { densityKgPerM3: 2700, maximumCells: 27 });
// @ts-expect-error No extra arguments.
cutSnapshot.massProperties('part', densityOptions, true);
// @ts-expect-error Results are read-only.
massProperties.massKG = 0;
// @ts-expect-error Common vectors are read-only.
massProperties.centroidMM[0] = 0;
// @ts-expect-error Full native details are read-only too.
if (massProperties.family === 'convex-planar') massProperties.details.native.solid.request.options.solidId = 'fake';
void [massKG, massCenter, inertiaEntry, exactVolume, massErrorUpper];

import type { CadSketch, CadSketchPoint, CadConstrainedPolygonBuilder } from '../src/index.js';
const constrainedModel = cad.model(), constrainedWidth = constrainedModel.parameter('width', 32);
const constrainedProfile: CadSketch = constrainedModel.sketch.constrainedPolygon((s: CadConstrainedPolygonBuilder) => {
  const a: CadSketchPoint = s.point([0, 0]);
  const b = s.point([constrainedWidth, 1]), c = s.point([constrainedWidth, 24]), d = s.point([1, 24]);
  s.fixed(a); s.fixed(c); s.horizontal(a, b); s.vertical(b, c); s.horizontal(c, d); s.vertical(d, a);
  // @ts-expect-error Point handles are not coordinate tuples.
  s.horizontal([0, 0], b);
  // @ts-expect-error Fixed uses the point's authored seed, without another target.
  s.fixed(a, [0, 0]);
  // @ts-expect-error Every orientation constraint requires two point handles.
  s.vertical(a);
  // @ts-expect-error Only the bounded linear constraint methods exist.
  s.tangent(a, b);
  // @ts-expect-error The opaque point is read-only.
  a.kind = 'sketch-point';
  return [a, b, c, d] as const;
});
const constrainedShape: CadShape = constrainedProfile.extrude(8, { from: -2 });
const constrainedSnapshot = constrainedModel.build({ part: constrainedShape });
constrainedSnapshot.withParameters({ width: 40 }).save();
// @ts-expect-error A callback is required.
constrainedModel.sketch.constrainedPolygon();
// @ts-expect-error Coordinates cannot replace callback-owned handles.
constrainedModel.sketch.constrainedPolygon(() => [[0, 0], [1, 0], [0, 1]]);
// @ts-expect-error Async callbacks cannot return a synchronous owned cycle.
constrainedModel.sketch.constrainedPolygon(async s => [s.point([0, 0]), s.point([1, 0]), s.point([0, 1])]);
// @ts-expect-error No extra public callback options.
constrainedModel.sketch.constrainedPolygon(s => [s.point([0, 0]), s.point([1, 0]), s.point([0, 1])], {});

const gussetModel = cad.model(), gussetWidth = gussetModel.parameter('width', 40), gussetHeight = gussetModel.parameter('height', 24);
const gussetProfile = gussetModel.sketch.constrainedPolygon(s => {
  const a = s.point([-0, 0]), b = s.point([gussetWidth, 0]), c = s.point([gussetWidth, gussetHeight]), d = s.point([1, gussetHeight]);
  s.fixed(a); s.fixed(b); s.fixed(c); s.horizontal(c, d); s.parallelTo(d, a, [1, 3]);
  // @ts-expect-error Direction is a dimensionless numeric pair, not a length parameter.
  s.parallelTo(d, a, [gussetHeight, 1]);
  // @ts-expect-error Exactly two direction components.
  s.parallelTo(d, a, [1, 2, 3]);
  // @ts-expect-error Callback-owned handles required for the edge.
  s.parallelTo([0, 0], a, [1, 3]);
  // @ts-expect-error An explicit direction is required.
  s.parallelTo(d, a);
  return [a, b, c, d];
});
const gussetSnapshot = gussetModel.build({ gusset: gussetProfile.extrude(8) });
cad.load(gussetSnapshot.withParameters({ width: 48 }).save());

const copyModel = cad.model(), copySpacing = copyModel.parameter('spacing', 48);
const copySeed = copyModel.sketch.rectangle({ width: 40, height: 24 }).extrude(8);
const copyShape: CadShape = copySeed.translate([copySpacing, copyModel.dimension.scale(copySpacing, -0.5), -0]);
const copySnapshot = copyModel.build({ left: copySeed, right: copyShape });
cad.load(copySnapshot.withParameters({ spacing: 64 }).save());
const copyEvidence = copySnapshot.evidence.find(item => item.kind === 'translate');
if (copyEvidence?.kind === 'translate') {
  const exactCopy: string = copyEvidence.native.solid.certificate.volumeMM3.numerator;
  void exactCopy;
}
// @ts-expect-error Exactly three length components are required.
copySeed.translate([1, 2]);
// @ts-expect-error Extra tuple components are not accepted.
copySeed.translate([1, 2, 3, 4]);
// @ts-expect-error Offsets are dimensions, not expression strings.
copySeed.translate(['48mm', 0, 0]);
// @ts-expect-error No matrix/options overload is exposed.
copySeed.translate([1, 2, 3], {});
// @ts-expect-error An explicit offset is required.
copySeed.translate();

// Named convex STL export has one discoverable immutable result and no file API.
const stlResult: CadStlExport = copyModel.build({ copy: copySeed }).exportStl('copy');
const stlBytes: readonly number[] = stlResult.bytes;
const stlFileBytes: Uint8Array = Uint8Array.from(stlBytes);
const stlUnit: 'mm' = stlResult.lengthUnit;
void stlFileBytes; void stlUnit;
// @ts-expect-error Output name is required.
copyModel.build({ copy: copySeed }).exportStl();
// @ts-expect-error No format/options overload.
copyModel.build({ copy: copySeed }).exportStl('copy', {});
// @ts-expect-error Results remain immutable.
stlResult.bytes[0] = 1;
// @ts-expect-error Complete native detail is deeply readonly.
stlResult.details.native.mesh.positionsMM[0] = 1;


const rotationModel = cad.model();
const flatRail = rotationModel.sketch.rectangle({ width: 32, height: 24 }).extrude(8);
const uprightRail: CadShape = flatRail.rotate({ axis: 'x', angleDegrees: 90 });
const rotationSnapshot: CadModelSnapshot = rotationModel.build({ flat: flatRail, upright: uprightRail });
const rotationEvidence = rotationSnapshot.evidence.find(item => item.kind === 'rotate');
if (rotationEvidence?.kind === 'rotate') {
  const volume: string = rotationEvidence.native.solid.certificate.volumeMM3.numerator;
  const canonical: 90 | 180 | 270 = rotationEvidence.native.request.spec.degrees;
  const mappedFace: string = rotationEvidence.native.lineage.faces[0].rotated.faceId;
  void [volume, canonical, mappedFace];
}
for (const axis of ['x', 'y', 'z'] as const) for (const angleDegrees of [90, 180, 270, -90, -180, -270] as const)
  cad.model().sketch.rectangle({ width: 32, height: 24 }).extrude(8).rotate({ axis, angleDegrees });
// @ts-expect-error Only the six authored cardinal angles are admitted.
flatRail.rotate({ axis: 'x', angleDegrees: 45 });
// @ts-expect-error Zero is not a rotation node.
flatRail.rotate({ axis: 'x', angleDegrees: 0 });
// @ts-expect-error Arbitrary axes are not admitted.
flatRail.rotate({ axis: [1, 0, 0], angleDegrees: 90 });
// @ts-expect-error The pivot is fixed at the world origin.
flatRail.rotate({ axis: 'x', angleDegrees: 90, pivot: [0, 0, 0] });
// @ts-expect-error Angles are literals, not length dimension handles.
flatRail.rotate({ axis: 'x', angleDegrees: copySpacing });
// @ts-expect-error One options record is required.
flatRail.rotate();
// @ts-expect-error Extra arguments are not admitted.
flatRail.rotate({ axis: 'x', angleDegrees: 90 }, true);


const mirrorModel = cad.model();
const mirrorOriginal = mirrorModel.sketch.rectangle({ width: 32, height: 24 }).extrude(8, { from: 3 });
const mirroredShape: CadShape = mirrorOriginal.mirror({ plane: 'xy' });
const mirrorSnapshot: CadModelSnapshot = mirrorModel.build({ original: mirrorOriginal, mirrored: mirroredShape });
const mirrorEvidence = mirrorSnapshot.evidence.find(item => item.kind === 'mirror');
if (mirrorEvidence?.kind === 'mirror') {
  const plane: 'xy' | 'xz' | 'yz' = mirrorEvidence.native.request.spec.plane;
  const determinant: -1 = mirrorEvidence.native.report.determinant;
  const mappedFace: string = mirrorEvidence.native.lineage.faces[0].mirrored.faceId;
  void [plane, determinant, mappedFace];
}
for (const plane of ['xy', 'xz', 'yz'] as const)
  cad.model().sketch.rectangle({ width: 32, height: 24 }).extrude(8).mirror({ plane });
// @ts-expect-error The selected plane must be one of the three cardinal planes.
mirrorOriginal.mirror({ plane: 'zx' });
// @ts-expect-error Arbitrary plane normals are not admitted.
mirrorOriginal.mirror({ normal: [0, 0, 1] });
// @ts-expect-error The selected plane passes through the world origin.
mirrorOriginal.mirror({ plane: 'xy', offset: 3 });
// @ts-expect-error A length dimension cannot name a plane.
mirrorOriginal.mirror({ plane: copySpacing });
// @ts-expect-error One own-data options record is required.
mirrorOriginal.mirror();
// @ts-expect-error Extra arguments are not admitted.
mirrorOriginal.mirror({ plane: 'xy' }, true);


const scaleModel = cad.model();
const scaleOriginal = scaleModel.sketch.rectangle({ width: 32, height: 24 }).extrude(8, { from: 3 });
const scaledShape: CadShape = scaleOriginal.scale({ factor: 2 });
const scaleSnapshot: CadModelSnapshot = scaleModel.build({ original: scaleOriginal, scaled: scaledShape });
const scaleEvidence = scaleSnapshot.evidence.find(item => item.kind === 'scale');
if (scaleEvidence?.kind === 'scale') {
  const factor: 0.5 | 2 = scaleEvidence.native.request.spec.factor;
  const determinant: 0.125 | 8 = scaleEvidence.native.report.determinant;
  const mappedFace: string = scaleEvidence.native.lineage.faces[0].scaled.faceId;
  void [factor, determinant, mappedFace];
}
for (const factor of [0.5, 2] as const)
  cad.model().sketch.rectangle({ width: 32, height: 24 }).extrude(8).scale({ factor });
// @ts-expect-error Arbitrary factors are not admitted.
scaleOriginal.scale({ factor: 1 });
// @ts-expect-error Negative factors are not admitted.
scaleOriginal.scale({ factor: -2 });
// @ts-expect-error Scale is uniform across all XYZ coordinates.
scaleOriginal.scale({ factor: [2, 1, 1] });
// @ts-expect-error The pivot is fixed at the world origin.
scaleOriginal.scale({ factor: 2, pivot: [0, 0, 0] });
// @ts-expect-error A length dimension cannot be a shape scale factor.
scaleOriginal.scale({ factor: copySpacing });
// @ts-expect-error One own-data options record is required.
scaleOriginal.scale();
// @ts-expect-error Extra arguments are not admitted.
scaleOriginal.scale({ factor: 2 }, true);

const patternModel = cad.model();
const patternSpacing = patternModel.parameter('spacing', 40);
const patternOriginal = patternModel.sketch.rectangle({ width: 32, height: 24 }).extrude(8, { from: 3 });
const patternTuple: readonly [CadShape, CadShape, CadShape] =
  patternOriginal.linearPattern({ axis: 'x', spacing: patternSpacing, count: 3 });
const [patternSource, patternNear, patternFar] = patternTuple;
const patternSnapshot: CadModelSnapshot = patternModel.build({ original: patternSource, near: patternNear, far: patternFar });
const patternEdited: CadModelSnapshot = patternSnapshot.withParameters({ spacing: 48 });
const patternReopened: CadModelSnapshot = cad.load(patternEdited.save());
const patternEvidence = patternSnapshot.evidence.find(item => item.kind === 'linear-pattern');
if (patternEvidence?.kind === 'linear-pattern') {
  const count: 3 = patternEvidence.native.report.count;
  const firstCopy = patternEvidence.native.copies[0];
  const secondCopy = patternEvidence.native.copies[1];
  const firstMappedFace: string = firstCopy.lineage.faces[0].translated.faceId;
  const secondMappedFace: string = secondCopy.lineage.faces[0].translated.faceId;
  const sameParent: true = patternEvidence.native.report.preservation.sameOriginalParent;
  void [count, firstMappedFace, secondMappedFace, sameParent];
}
void patternReopened;
for (const axis of ['x', 'y', 'z'] as const) {
  const axisModel = cad.model();
  axisModel.sketch.rectangle({ width: 32, height: 24 }).extrude(8).linearPattern({
    axis, spacing: axisModel.dimension.add(axisModel.parameter('spacing', 40), 0), count: 3,
  });
}
// @ts-expect-error The result is a readonly three-instance tuple.
patternTuple[1] = patternSource;
// @ts-expect-error Exactly three instances include the original.
patternOriginal.linearPattern({ axis: 'x', spacing: 40, count: 2 });
// @ts-expect-error Arbitrary directions are not admitted.
patternOriginal.linearPattern({ axis: [1, 0, 0], spacing: 40, count: 3 });
// @ts-expect-error Spacing is a millimetre length, not a string.
patternOriginal.linearPattern({ axis: 'x', spacing: '40', count: 3 });
// @ts-expect-error Count is required.
patternOriginal.linearPattern({ axis: 'x', spacing: 40 });
// @ts-expect-error There is no pattern pivot option.
patternOriginal.linearPattern({ axis: 'x', spacing: 40, count: 3, pivot: [0, 0, 0] });
// @ts-expect-error One own-data options record is required.
patternOriginal.linearPattern();
// @ts-expect-error Extra arguments are not admitted.
patternOriginal.linearPattern({ axis: 'x', spacing: 40, count: 3 }, true);

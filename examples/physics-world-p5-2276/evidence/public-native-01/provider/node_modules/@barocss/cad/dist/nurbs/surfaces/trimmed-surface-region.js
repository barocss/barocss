import { arrangementRegionsExact, exactPoint2FromXY } from '../../brep/planar-arrangement.js';
import { KernelError } from '../../core/barocss-error.js';
import { evaluateSurface } from '../../core/math.js';
import { CadNumericPolicy } from '../../numeric-policy.js';
import { extractSurfaceRegion } from './surface-region.js';
import { copyLoop } from './trimmed-surface-parameter-split.js';
import { splitAffineFrame, splitChildBinding, splitRational } from './trimmed-surface-split-binding.js';
import { canonicalRing, compareRings, compareRingRelations, coordinateCompare, pointInRing, pointKey, ringArea2, simpleRing, uvRing } from './trimmed-surface-split-topology.js';
import { TrimmedSurfaceParameterSplitError } from './trimmed-surface-split-common.js';
export class TrimmedSurfaceRegionError extends KernelError {
    code;
    constructor(code, detail, cause) {
        super(('Trimmed Surface region extraction: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
        this.name = 'TrimmedSurfaceRegionError';
        this.code = code;
    }
}
function check(condition, code, detail) { if (!condition)
    throw new TrimmedSurfaceRegionError(code, detail); }
function componentOrder(a, b) { return compareRings(a.outer, b.outer); }
function rectangle(domain) { return [exactPoint2FromXY([domain.u[0], domain.v[0]]), exactPoint2FromXY([domain.u[1], domain.v[0]]), exactPoint2FromXY([domain.u[1], domain.v[1]]), exactPoint2FromXY([domain.u[0], domain.v[1]])]; }
function nativeParent(surface, options) {
    try {
        return extractSurfaceRegion(surface, options);
    }
    catch (cause) {
        throw new TrimmedSurfaceRegionError('NATIVE', cause instanceof Error ? cause.message : 'native Surface region refused', cause);
    }
}
/** Retain every representable positive-area component of the original trim inside one native region. */
export function extractTrimmedSurfaceRegion(surface, trims, options) {
    try {
        return extractTrimmed(surface, trims, options);
    }
    catch (cause) {
        if (cause instanceof TrimmedSurfaceRegionError)
            throw cause;
        if (cause instanceof TrimmedSurfaceParameterSplitError)
            throw new TrimmedSurfaceRegionError(cause.code, cause.message.replace(/^Trimmed Surface parameter split: /, ''), cause);
        const detail = cause instanceof Error ? cause.message : 'trimmed Surface region failed';
        throw new TrimmedSurfaceRegionError(/BUDGET|budget/.test(detail) ? 'BUDGET' : /REPRESENTABILITY/.test(detail) ? 'REPRESENTABILITY' : 'NATIVE', detail, cause);
    }
}
function extractTrimmed(surface, trims, options) {
    const parent = nativeParent(surface, options), q = splitRational(), areaQ = splitRational(), frame = splitAffineFrame(parent.original, q);
    const domain = parent.provenance.originalDomain, effective = parent.provenance.effectiveDomain, loop = copyLoop(trims, domain), input = uvRing(loop.uv);
    const work = { vertexPairs: 0, edgePairs: 0, orientations: 0, containmentTests: 0 };
    simpleRing(input, work);
    const inputArea2 = areaQ.abs(ringArea2(input, areaQ));
    check(inputArea2.n > 0n, 'TOPOLOGY', 'stored trim must have positive area');
    const originalDomainArea2 = areaQ.abs(ringArea2(rectangle(domain), areaQ)), originalArea2 = loop.keep === 'inside' ? inputArea2 : areaQ.sub(originalDomainArea2, inputArea2);
    check(originalArea2.n > 0n, 'DOMAIN', 'original stored trim has no positive-area material');
    const crop = rectangle(effective), arranged = arrangementRegionsExact([{ polygon: 0, ring: crop }, { polygon: 1, ring: input }], [], 2), counts = arranged.counts;
    // Each trim segment supplies at most two rectangle-boundary intersections/overlap endpoints.
    // I,J<=2n therefore V<=3n+4 and E<=n+4+I+J; contacts only reuse or merge these incidences.
    check(counts.segments <= 164 && counts.pairTests <= 13366 && counts.vertices <= 484 && counts.edges <= 804 && counts.boundaryOccurrences <= 1608, 'BUDGET', 'complete region arrangement exceeds derived rectangle/trim bounds');
    const exact = [];
    let croppedArea2 = areaQ.rat(0n), occurrences = 0;
    for (const region of arranged.regions) {
        if (region.winding[0] === 0 || (loop.keep === 'inside' ? region.winding[1] === 0 : region.winding[1] !== 0))
            continue;
        const outer = canonicalRing(region.outer, true, areaQ, work, 484), holes = [];
        let area2 = ringArea2(outer, areaQ);
        for (const ring of region.holes) {
            const hole = canonicalRing(ring, false, areaQ, work, 484);
            for (const point of hole)
                check(pointInRing(outer, point, work) === 1, 'TOPOLOGY', 'material hole must remain strictly inside its outer boundary');
            holes.push(hole);
            area2 = areaQ.add(area2, ringArea2(hole, areaQ));
        }
        check(area2.n > 0n, 'TOPOLOGY', 'retained component must have strictly positive exact area');
        holes.sort(compareRings);
        for (const ring of [outer, ...holes])
            occurrences += ring.length;
        croppedArea2 = areaQ.add(croppedArea2, area2);
        exact.push({ outer, holes });
    }
    check(exact.length > 0 && croppedArea2.n > 0n, 'DOMAIN', 'requested region contains no positive-area material');
    check(exact.length <= 536 && occurrences <= 1608, 'BUDGET', 'retained region exceeds derived component/boundary capacity');
    check(areaQ.compare(croppedArea2, originalArea2) <= 0, 'BINDING', 'cropped material must be a subset of the original');
    if (parent.provenance.fullDomainCopy)
        check(areaQ.compare(croppedArea2, originalArea2) === 0, 'BINDING', 'full-domain region must conserve original material');
    exact.sort(componentOrder);
    const binding = splitChildBinding(parent.surface, frame, q);
    check(q.upward(binding.bound) <= CadNumericPolicy.linearTolerance, 'BINDING', 'whole final-support coefficient position bound exceeds linear policy');
    const stored = new Map(), reverse = new Map();
    for (let i = 0; i < input.length; i++)
        stored.set(pointKey(input[i]), [loop.uv[i][0], loop.uv[i][1]]);
    const boundaryU = [exactPoint2FromXY([effective.u[0], 0]), exactPoint2FromXY([effective.u[1], 0])], boundaryV = [exactPoint2FromXY([0, effective.v[0]]), exactPoint2FromXY([0, effective.v[1]])];
    for (let i = 0; i < 4; i++)
        stored.set(pointKey(crop[i]), [i === 0 || i === 3 ? effective.u[0] : effective.u[1], i < 2 ? effective.v[0] : effective.v[1]]);
    const components = [], exactRings = [], roundedRings = [];
    let maximumUVRoundingBound = 0, maximumWorldBoundaryBound = 0, maximumNativePointDifference = 0;
    for (const component of exact) {
        const trimLoops = [];
        for (const ring of [component.outer, ...component.holes]) {
            const uv = [];
            for (const point of ring) {
                const key = pointKey(point), x = q.rat(point.x, point.w), y = q.rat(point.y, point.w);
                let mapped = stored.get(key);
                if (!mapped) {
                    mapped = [q.nearest(x), q.nearest(y)];
                    for (let i = 0; i < 2; i++) {
                        if (coordinateCompare(point, boundaryU[i], 0) === 0)
                            mapped[0] = effective.u[i];
                        if (coordinateCompare(point, boundaryV[i], 1) === 0)
                            mapped[1] = effective.v[i];
                    }
                    stored.set(key, mapped);
                }
                check(Number.isFinite(mapped[0]) && Number.isFinite(mapped[1]) && mapped[0] >= effective.u[0] && mapped[0] <= effective.u[1] && mapped[1] >= effective.v[0] && mapped[1] <= effective.v[1], 'REPRESENTABILITY', 'rounded material vertex lies outside effective native domain');
                const roundedKey = `${mapped[0]}/${mapped[1]}`, prior = reverse.get(roundedKey);
                check(prior === undefined || prior === key, 'TOPOLOGY', 'distinct exact material vertices collapse after rounding');
                reverse.set(roundedKey, key);
                const du = q.abs(q.sub(q.from(mapped[0]), x)), dv = q.abs(q.sub(q.from(mapped[1]), y));
                const chart = q.upward(q.max(du, dv)), world = q.upward(q.add(binding.bound, q.add(q.mul(du, frame.scaleU), q.mul(dv, frame.scaleV))));
                check(chart <= CadNumericPolicy.uvBindingTolerance && world <= CadNumericPolicy.linearTolerance, 'BINDING', 'joint final-support and UV-rounding displacement exceeds original policy');
                maximumUVRoundingBound = Math.max(maximumUVRoundingBound, chart);
                maximumWorldBoundaryBound = Math.max(maximumWorldBoundaryBound, world);
                const a = evaluateSurface(parent.original, mapped[0], mapped[1]), b = evaluateSurface(parent.surface, mapped[0], mapped[1]), difference = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
                check(Number.isFinite(difference) && difference <= CadNumericPolicy.linearTolerance, 'BINDING', 'actual stored-parameter native region/original comparison exceeds linear policy');
                maximumNativePointDifference = Math.max(maximumNativePointDifference, difference);
                uv.push([mapped[0], mapped[1]]);
            }
            const rounded = uvRing(uv);
            simpleRing(rounded, work, 484);
            check((ringArea2(ring, areaQ).n > 0n) === (ringArea2(rounded, areaQ).n > 0n), 'TOPOLOGY', 'rounded material winding changes');
            exactRings.push(ring);
            roundedRings.push(rounded);
            trimLoops.push({ keep: trimLoops.length === 0 ? 'inside' : 'outside', uv });
        }
        components.push({ surfaceId: parent.surface.id, componentIndex: components.length, trimLoops });
    }
    compareRingRelations(exactRings, roundedRings, work);
    const trimRegion = { family: 'affine-plane-single-stored-trim-loop-region', inputKeep: loop.keep, inputPointCount: loop.uv.length, componentCount: components.length,
        originalDomain: domain, requestedDomain: parent.provenance.requestedDomain, effectiveDomain: effective,
        originalMaterialAreaUV: areaQ.text(areaQ.div(originalArea2, areaQ.rat(2n))), croppedMaterialAreaUV: areaQ.text(areaQ.div(croppedArea2, areaQ.rat(2n))), usedSupportProof: binding.proof,
        maximumUVRoundingBound, maximumWorldBoundaryBound, maximumNativePointDifference, work: { arrangement: counts, topology: work, materialArithmetic: areaQ.counts(), bindingArithmetic: q.counts() },
        limits: { maximumInputPoints: 160, maximumSegments: 164, maximumPairTests: 13366, maximumVertices: 484, maximumEdges: 804, maximumBoundaryOccurrences: 1608, maximumComponents: 536, maximumRationalOperations: 200000, maximumRationalBits: 8192 },
        quality: { uvComparison: 1e-7, linearComparison: 1e-7, chartPolicy: CadNumericPolicy.chartParameters, materialComposition: 'one-object-per-interior-component-inside-outer-and-outside-holes', emptyCrop: 'atomic-DOMAIN-refusal', supportRegularity: 'strict-positive-projected-bilinear-Jacobian-and-convex-boundary', worldBoundary: 'whole-final-support-coefficient-bound-plus-affine-UV-rounding', genericSurfaceEmbeddingCertified: false, globalBinary64EvaluatorErrorCertified: false, solid: false, parentReportUnchanged: true } };
    return { ...parent, components, trimRegion };
}

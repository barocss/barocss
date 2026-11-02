import { curveDomain, evaluateCurve } from '../core/math.js';
import { copyCadData } from '../data-copy.js';
import { constructPlaneCylinderCandidate, constructPlaneCylinderBindings, adopt, observe, snapshot, check, same } from './own-plane-cylinder-intersection-internal.js';
/** Supported full interior sections only. Mixed/touching hull bounds never imply disjointness. */
export function intersectXYCirclePrismWallWithPlane(input, inputOptions) {
    const candidate = constructPlaneCylinderCandidate(input, inputOptions);
    const { shell, options: opt, sourceCircle, section, plane, wallSurface: wall } = candidate, h = shell.construction.heightMM, [min, max] = candidate.axialControlHullMM;
    const classification = min > h ? 'control-hull-disjoint-above' : max < 0 ? 'control-hull-disjoint-below' : min > 0 && max < h ? 'full-closed-section' : null;
    check(classification !== null, 'unsupported touching/mixed/partial axial control hull; no full-section or disjoint proof');
    const report = { family: 'own-transverse-affine-plane-circle-cylinder', classification, evaluationId: opt.evaluationId, sourceCircleId: sourceCircle.id, wallSurfaceId: wall.id, planeSurfaceId: plane.id,
        axialControlHullMM: [min, max], axialWallDomainMM: [0, h], hullSemantics: 'positive-weight-native-section-control-hull-sufficient-bound', originalDomain: curveDomain(sourceCircle), planeSupportMM: candidate.planeSupportMM, homogeneousSpans: [], observations: [],
        periodic: false, geometricValidity: 'not-certified', topologyCertified: false, solid: false, limits: { slopes: [-1, 1], interceptMM: [-10000, 10000], nativeResidualObservationMM: 1e-7, wallParameterObservation: 1e-12, snapshotValues: 131072, snapshotDepth: 24 } };
    if (classification !== 'full-closed-section') {
        const adopted = adopt({ name: opt.planeId, version: 0, lengthUnit: 'mm', objects: [plane, wall] });
        return copyCadData({ kind: 'disjoint', shell, options: opt, plane, wallSurface: wall, ...adopted, sourceVersion: 0, report });
    }
    const { bindings, homogeneousSpans } = constructPlaneCylinderBindings(candidate);
    report.homogeneousSpans = homogeneousSpans;
    report.observations = observe(section, plane, wall, bindings);
    const start = evaluateCurve(section, 0), end = evaluateCurve(section, 4), uv0 = evaluateCurve(bindings.wall.curve, 0), uv4 = evaluateCurve(bindings.wall.curve, 4);
    check(same(start, end) && uv0[0] === 0 && uv4[0] === 4 && uv0[1] === uv4[1], 'closed native XYZ seam requires distinct0/4 wall UV endpoints');
    report.seam = { startXYZ: start, endXYZ: end, startWallUV: uv0, endWallUV: uv4, closed: true, distinctUVEndpoints: true };
    const adopted = adopt({ name: opt.planeId, version: 0, lengthUnit: 'mm', objects: [section, plane, wall] });
    return copyCadData({ kind: 'intersection', shell, options: opt, curve: adopted.model.objects[0], plane: adopted.model.objects[1], wallSurface: adopted.model.objects[2], bindings, ...adopted, sourceVersion: 0, report });
}
/** Reconstruct the bounded native result; reject altered UV, geometry, context, source or report data. */
export function validateXYCirclePrismPlaneIntersection(input) {
    const owned = snapshot(input);
    check(owned !== null && typeof owned === 'object' && !Array.isArray(owned) && (owned.kind === 'intersection' || owned.kind === 'disjoint'), 'native intersection/disjoint result required');
    const expected = intersectXYCirclePrismWallWithPlane(owned.shell, owned.options);
    check(same(owned, expected), 'owned native geometry/dual-UV binding/context/source/report mismatch');
    return copyCadData(expected.report);
}

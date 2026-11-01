import { ownSnapshot, hasExactOwnFields } from '../core/own-data.js';
import { createChartLoopContext, chartFailure, isCylindricalWrapChartError, prepareChartCurve } from './cylindrical-wrap-chart.js';
import { certifyChartCone } from './cylindrical-wrap-chart-cone.js';
import { certifyCylindricalWrapChartSeparation } from './cylindrical-wrap-chart-separation.js';
import { prepareChartWindingUse, chartWindingPointFromWorld, chartWindingPointFromVertex, certifyChartWinding } from './cylindrical-wrap-chart-winding.js';
const MEANING = Object.freeze({
    projection: 'Y-over-X-and-world-Z',
    guarantee: 'exact-stored-projected-component-boundary',
    projectedLoopEmbeddingCertified: true,
    projectedComponentContainmentCertified: true,
    representativeRule: 'one-owned-vertex-after-complete-boundary-separation',
    hintMeaning: 'individual-ring-interior-and-orientation-only',
    sourceCarrierCertified: false,
    originalNativeUVBindingCertified: false,
    topologyCertified: false,
    solidQualified: false,
    representedVolumeCertified: false,
    globalNativeEvaluatorErrorCertified: false,
    generalTextSupported: false,
    combinedConstructionBudgetCertified: false,
});
function fail(code, detail) { return chartFailure(code, `Component: ${detail}`); }
function wrap(code, detail) { return fail(code, detail); }
const OWN = { input: 'INPUT', owned: 'INPUT', budget: 'BUDGET', fail, wrap, isRefusal: isCylindricalWrapChartError };
const COMPONENT_CONTEXTS = new WeakMap();
/** Private continuation capability. Frozen copied receipts are not authority to extend a proof request. */
export function chartComponentContext(result) {
    const context = COMPONENT_CONTEXTS.get(result);
    if (!context)
        fail('INPUT', 'an original certified component from this module is required');
    return context;
}
function record(input, fields, label) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || !hasExactOwnFields(input, [...fields]))
        fail('INPUT', `exact ${label} fields are required`);
    return input;
}
function ringInput(input) {
    const data = record(input, ['uses', 'interiorHint'], 'ring');
    if (!Array.isArray(data.uses) || data.uses.length < 3 || data.uses.length > 32)
        fail('SUPPORT', 'a ring requires3..32 distinct curve uses');
    if (!Array.isArray(data.interiorHint) || data.interiorHint.length !== 3)
        fail('INPUT', 'one world triple is required as an interior candidate');
    for (const item of data.uses) {
        const use = record(item, ['curve', 'sense'], 'oriented use');
        if (typeof use.curve !== 'string' || use.curve.length < 1 || use.curve.length > 64 || (use.sense !== 'forward' && use.sense !== 'reversed'))
            fail('INPUT', 'a source identifier and explicit forward/reversed sense are required');
    }
    return data;
}
function componentInput(input) {
    const data = record(input, ['curves', 'outer', 'holes'], 'component');
    if (!Array.isArray(data.curves) || data.curves.length < 3 || data.curves.length > 32)
        fail('SUPPORT', 'a component requires3..32 source curves');
    if (!Array.isArray(data.holes) || data.holes.length > 9)
        fail('SUPPORT', 'at most9 hole rings are supported');
    ringInput(data.outer);
    for (const hole of data.holes)
        ringInput(hole);
    return data;
}
function freezeData(input) {
    if (!input || typeof input !== 'object' || Object.isFrozen(input))
        return;
    Object.freeze(input);
    for (const value of Object.values(input))
        freezeData(value);
}
function start(use) { return use.sense === 'forward' ? 0 : 1; }
function end(use) { return use.sense === 'forward' ? 1 : 0; }
function closure(ring, ctx) {
    for (let i = 0; i < ring.uses.length; i++) {
        ctx.charge();
        const a = ring.uses[i], b = ring.uses[(i + 1) % ring.uses.length];
        const p = a.chart.source.controlPoints[end(a) * 3], q = b.chart.source.controlPoints[start(b) * 3];
        for (let axis = 0; axis < 3; axis++)
            if (!Object.is(p[axis], q[axis]))
                fail('INPUT', 'every sense-selected cycle endpoint must preserve identical stored world coordinates');
    }
}
function separatedReceipt(proof) {
    return Object.freeze({ relation: proof.relation, curves: proof.curves, parameterFrame: proof.parameterFrame, axisUnits: proof.axisUnits, cover: proof.cover, limits: proof.limits });
}
function pairProof(first, second, rings, ctx) {
    const same = first.ring === second.ring, length = rings[first.ring].uses.length;
    const next = same && (first.position + 1) % length === second.position;
    const previous = same && (second.position + 1) % length === first.position;
    let certificate;
    if (next)
        certificate = certifyChartCone(first.use.chart, second.use.chart, end(first.use), start(second.use), ctx);
    else if (previous)
        certificate = certifyChartCone(second.use.chart, first.use.chart, end(second.use), start(first.use), ctx);
    else
        certificate = separatedReceipt(certifyCylindricalWrapChartSeparation(first.use.chart, second.use.chart, ctx));
    return { receipt: Object.freeze({ first: certificate.curves[0], second: certificate.curves[1], certificate }), adjacent: next || previous };
}
function ringWinding(ring, point, expected, purpose, queryRing, ctx) {
    const certificate = certifyChartWinding(ring.uses, point, ctx);
    if (certificate.winding !== expected)
        fail('UNRESOLVED', 'the exact winding does not establish the authored component role');
    return Object.freeze({ purpose, ring: ring.index, queryRing, expected, certificate });
}
/** Complete exact projected component proof only. Source binding, native trims, mass and physical solid remain separate. */
export function certifyCylindricalWrapChartComponent(input, options = {}) {
    const copied = ownSnapshot({ input, options }, false, OWN);
    const original = componentInput(copied.input), ctx = createChartLoopContext(copied.options);
    const charts = new Map();
    for (const curve of original.curves) {
        const prepared = prepareChartCurve(curve, ctx);
        if (charts.has(prepared.source.id))
            fail('INPUT', 'source curve identifiers must be unique');
        charts.set(prepared.source.id, prepared);
    }
    const inputs = [original.outer, ...original.holes], rings = [], located = [], used = new Set();
    for (let index = 0; index < inputs.length; index++) {
        const ring = inputs[index], uses = [];
        for (let position = 0; position < ring.uses.length; position++) {
            ctx.charge();
            const inputUse = ring.uses[position], chart = charts.get(inputUse.curve);
            if (!chart || used.has(inputUse.curve))
                fail('INPUT', 'each source curve must belong to exactly one ring use');
            used.add(inputUse.curve);
            const use = prepareChartWindingUse(chart, inputUse.sense, ctx);
            uses.push(use);
            located.push({ use, ring: index, position });
        }
        const prepared = { input: ring, uses: Object.freeze(uses), index };
        closure(prepared, ctx);
        rings.push(prepared);
    }
    if (used.size !== charts.size)
        fail('INPUT', 'unused source curves are not admitted');
    const pairs = [];
    let adjacent = 0, disjoint = 0;
    for (let i = 0; i < located.length; i++)
        for (let j = i + 1; j < located.length; j++) {
            ctx.charge();
            const proof = pairProof(located[i], located[j], rings, ctx);
            pairs.push(proof.receipt);
            if (proof.adjacent)
                adjacent++;
            else
                disjoint++;
        }
    const n = located.length, totalPairs = n * (n - 1) / 2;
    if (adjacent !== n || disjoint !== totalPairs - n || pairs.length !== totalPairs)
        fail('UNRESOLVED', 'complete adjacent/nonadjacent pair coverage is required');
    const winding = [];
    for (const ring of rings)
        winding.push(ringWinding(ring, chartWindingPointFromWorld(ring.input.interiorHint, ctx), ring.index === 0 ? 1 : -1, 'ring-interior-orientation', ring.index, ctx));
    for (let i = 1; i < rings.length; i++) {
        const use = rings[i].uses[0], point = chartWindingPointFromVertex(use, start(use), ctx);
        winding.push(ringWinding(rings[0], point, 1, 'hole-in-outer', i, ctx));
    }
    for (let i = 1; i < rings.length; i++)
        for (let j = i + 1; j < rings.length; j++) {
            const a = rings[i].uses[0], b = rings[j].uses[0];
            winding.push(ringWinding(rings[i], chartWindingPointFromVertex(b, start(b), ctx), 0, 'hole-outside-hole', j, ctx));
            winding.push(ringWinding(rings[j], chartWindingPointFromVertex(a, start(a), ctx), 0, 'hole-outside-hole', i, ctx));
        }
    ctx.check();
    freezeData(original);
    const counts = ctx.counts();
    Object.freeze(counts.rational);
    Object.freeze(counts);
    const result = Object.freeze({ original, pairs: Object.freeze(pairs), winding: Object.freeze(winding),
        cover: Object.freeze({ curves: n, rings: rings.length, adjacent, disjoint, totalPairs, complete: true }),
        counts, limits: ctx.limits, budget: Object.freeze({ maxOperations: ctx.maxOperations, maxDepth: ctx.maxDepth }), meaning: MEANING });
    COMPONENT_CONTEXTS.set(result, ctx);
    return result;
}

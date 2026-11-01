import { ownSnapshot, hasExactOwnFields } from '../core/own-data.js';
import { CadNumericPolicy } from '../numeric-policy.js';
import { ChartContext, chartFailure, isCylindricalWrapChartError, prepareChartCurve } from './cylindrical-wrap-chart.js';
import { certifyCylindricalWrapChartSeparation } from './cylindrical-wrap-chart-separation.js';
import { certifyChartCone } from './cylindrical-wrap-chart-cone.js';
const MEANING = Object.freeze({
    projection: 'Y-over-X-and-world-Z',
    coordinateUnits: Object.freeze(['ratio', 'world-length']),
    guarantee: 'exact-stored-rational-projected-pair',
    pairRelationCertified: true,
    sourceCarrierCertified: false,
    loopEmbeddingCertified: false,
    topologyCertified: false,
    solidQualified: false,
    representedVolumeCertified: false,
    globalNativeEvaluatorErrorCertified: false,
    generalTextSupported: false,
});
function fail(code, detail) { return chartFailure(code, `Pair: ${detail}`); }
function wrap(code, detail, _cause) { return fail(code, detail); }
const OWN = { input: 'INPUT', owned: 'INPUT', budget: 'BUDGET', fail, wrap, isRefusal: isCylindricalWrapChartError };
function options(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input))
        fail('INPUT', 'plain pair options are required');
    const data = input, kind = data.kind;
    if (kind !== 'disjoint' && kind !== 'shared')
        fail('INPUT', 'pair kind is disjoint or shared');
    const required = kind === 'shared' ? ['kind', 'endpoints'] : ['kind'];
    const allowed = kind === 'shared' ? ['kind', 'endpoints', 'normalHint', 'maxOperations'] : ['kind', 'maxDepth', 'maxPairs', 'witnesses', 'maxOperations'];
    for (const key of required)
        if (!Object.hasOwn(data, key))
            fail('INPUT', 'a required pair option is missing');
    for (const key of Object.keys(data))
        if (!allowed.includes(key))
            fail('INPUT', 'an unsupported pair option was supplied');
    if (data.maxOperations !== undefined && (!Number.isSafeInteger(data.maxOperations) || data.maxOperations < 1 || data.maxOperations > 200000))
        fail('INPUT', 'the pair operation limit may only tighten200000');
    if (kind === 'disjoint') {
        if (data.maxDepth !== undefined && (!Number.isSafeInteger(data.maxDepth) || data.maxDepth < 0 || data.maxDepth > 8))
            fail('INPUT', 'the pair depth may only tighten8');
        if (data.maxPairs !== undefined && (!Number.isSafeInteger(data.maxPairs) || data.maxPairs < 1 || data.maxPairs > 512))
            fail('INPUT', 'the pair visit limit may only tighten512');
        if (data.witnesses !== undefined && typeof data.witnesses !== 'boolean')
            fail('INPUT', 'witnesses is a boolean');
    }
    else {
        if (!Array.isArray(data.endpoints) || data.endpoints.length !== 2 || (data.endpoints[0] !== 0 && data.endpoints[0] !== 1) || (data.endpoints[1] !== 0 && data.endpoints[1] !== 1))
            fail('INPUT', 'two explicit endpoint indices0 or1 are required');
        Object.freeze(data.endpoints);
        if (data.normalHint !== undefined) {
            if (!Array.isArray(data.normalHint) || data.normalHint.length !== 2)
                fail('INPUT', 'a normal hint has two coordinates');
            for (const value of data.normalHint)
                if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > CadNumericPolicy.coordinateAbs)
                    fail('INPUT', 'normal hints must be finite within the native coordinate bound');
            if (data.normalHint[0] === 0 && data.normalHint[1] === 0)
                fail('INPUT', 'a normal hint cannot be zero');
            Object.freeze(data.normalHint);
        }
    }
    Object.freeze(data);
    return data;
}
function progress(curve) {
    const proof = curve.progress, coefficients = [];
    for (const value of proof.coefficients)
        coefficients.push(value.toString());
    Object.freeze(coefficients);
    return Object.freeze({ coordinate: proof.coordinate, sign: proof.sign, coefficients, minimum: proof.minimum.toString(),
        positiveScale: proof.positiveScale, homogeneousDenominator: curve.denominator.toString() });
}
/** Private projected-pair certificate. It is conditional on later exact radial-side binding and loop ownership. */
export function certifyCylindricalWrapChartPair(firstInput, secondInput, optionsInput = { kind: 'disjoint' }) {
    const copied = ownSnapshot({ first: firstInput, second: secondInput, options: optionsInput }, false, OWN);
    if (!hasExactOwnFields(copied, ['first', 'second', 'options']))
        fail('INPUT', 'pair inputs are incomplete');
    const settings = options(copied.options), contextOptions = {};
    if (settings.maxOperations !== undefined)
        contextOptions.maxOperations = settings.maxOperations;
    if (settings.kind === 'disjoint' && settings.maxDepth !== undefined)
        contextOptions.maxDepth = settings.maxDepth;
    const ctx = new ChartContext(contextOptions), first = prepareChartCurve(copied.first, ctx), second = prepareChartCurve(copied.second, ctx);
    if (first.source.id === second.source.id)
        fail('INPUT', 'two distinct source curve identifiers are required');
    let certificate;
    if (settings.kind === 'shared')
        certificate = certifyChartCone(first, second, settings.endpoints[0], settings.endpoints[1], ctx, settings.normalHint);
    else {
        const separation = {
            ...(settings.maxDepth !== undefined ? { maxDepth: settings.maxDepth } : {}),
            ...(settings.maxPairs !== undefined ? { maxPairs: settings.maxPairs } : {}),
            ...(settings.witnesses !== undefined ? { witnesses: settings.witnesses } : {}),
        };
        certificate = certifyCylindricalWrapChartSeparation(first, second, ctx, separation);
    }
    ctx.check();
    const original = [first.source, second.source], proofs = [progress(first), progress(second)];
    Object.freeze(original);
    Object.freeze(proofs);
    const counts = ctx.counts();
    Object.freeze(counts.rational);
    Object.freeze(counts);
    const relation = settings.kind === 'shared' ? 'shared-endpoint-only' : 'disjoint';
    return Object.freeze({ original, options: settings, relation, progress: proofs,
        certificate, counts, limits: ctx.limits, budget: Object.freeze({ maxOperations: ctx.maxOperations, maxDepth: ctx.maxDepth }), meaning: MEANING });
}

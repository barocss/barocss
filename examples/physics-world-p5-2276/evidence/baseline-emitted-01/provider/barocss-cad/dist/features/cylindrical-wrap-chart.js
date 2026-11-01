import { validateCurve } from '../core/math.js';
import { ownSnapshot, hasExactOwnFields } from '../core/own-data.js';
import { isFrom, kernelRefusal } from '../core/barocss-error.js';
import { CadNumericPolicy } from '../numeric-policy.js';
import { SectionRationalContext } from '../section-rational-internal.js';
export const CHART_LIMITS = Object.freeze({ operations: 200000, integerBits: 8192, work: 1048576, curves: 2, nodes: 256, depth: 8 });
const LOOP_CHART_LIMITS = Object.freeze({ ...CHART_LIMITS, curves: 32 });
const SOURCE = 'cylindrical-wrap-chart';
const CURVE_FIELDS = ['kind', 'id', 'degree', 'knots', 'controlPoints', 'weights'];
const CUBIC = [1, 3, 3, 1], QUADRATIC = [1, 2, 1], QUINTIC = [1, 5, 10, 10, 5, 1];
export function chartFailure(code, detail) { throw kernelRefusal(SOURCE, code, `Wrap chart: ${detail}`); }
export function isCylindricalWrapChartError(error) {
    try {
        return isFrom(error, SOURCE);
    }
    catch {
        return false;
    }
}
function wrap(code, detail) { return chartFailure(code, detail); }
function rationalFailure(kind, detail) { return chartFailure(kind === 'BUDGET' ? 'BUDGET' : 'UNRESOLVED', detail); }
const OWN = { input: 'INPUT', owned: 'INPUT', budget: 'BUDGET', fail: chartFailure, wrap, isRefusal: isCylindricalWrapChartError };
const STATES = new WeakMap();
function stateOf(ctx) {
    const state = STATES.get(ctx);
    if (!state)
        chartFailure('INPUT', 'an original request-local chart context is required');
    return state;
}
function bigint(value) { if (typeof value !== 'bigint')
    chartFailure('INPUT', 'exact integer operands are required'); }
function direct(ctx) {
    const state = stateOf(ctx);
    state.directOperations++;
    state.work++;
    ctx.check();
    return state;
}
/** Initialize one fresh context directly with a module-private fixed profile. */
function initializeContext(ctx, options, limits) {
    const q = new SectionRationalContext(rationalFailure);
    const copied = ownSnapshot(options, false, OWN);
    if (!copied || typeof copied !== 'object' || Array.isArray(copied))
        chartFailure('INPUT', 'plain own chart options are required');
    for (const key of Object.keys(copied))
        if (key !== 'maxOperations' && key !== 'maxDepth')
            chartFailure('INPUT', 'unknown chart option');
    const data = copied, maximum = data.maxOperations === undefined ? CHART_LIMITS.operations : data.maxOperations, depth = data.maxDepth === undefined ? CHART_LIMITS.depth : data.maxDepth;
    if (typeof maximum !== 'number' || !Number.isSafeInteger(maximum) || maximum < 1 || maximum > CHART_LIMITS.operations)
        chartFailure('INPUT', 'the exact operation limit may only tighten200000');
    if (typeof depth !== 'number' || !Number.isSafeInteger(depth) || depth < 0 || depth > CHART_LIMITS.depth)
        chartFailure('INPUT', 'the subdivision depth may only tighten0..8');
    Object.defineProperties(ctx, {
        q: { value: q, enumerable: true },
        maxOperations: { value: maximum, enumerable: true },
        maxDepth: { value: depth, enumerable: true },
        limits: { value: limits, enumerable: true },
    });
    STATES.set(ctx, { limits, directOperations: 0, work: 0, maximumDirectBits: 0, curves: new Set(), nodes: new Set(), splits: new Map(), boxes: new Map() });
    Object.freeze(ctx);
}
/** One ledger for all admitted curves and every child/pair/cone operation in this request. */
export class ChartContext {
    constructor(options = {}) { initializeContext(this, options, CHART_LIMITS); }
    check() {
        const state = stateOf(this);
        if (this.q.counts().operations + state.directOperations > this.maxOperations)
            chartFailure('BUDGET', 'the shared rational/direct operation budget was exceeded');
        if (state.work > state.limits.work)
            chartFailure('BUDGET', 'the shared chart work budget was exceeded');
    }
    charge(amount = 1) {
        if (!Number.isSafeInteger(amount) || amount < 0)
            chartFailure('INPUT', 'bounded nonnegative work is required');
        stateOf(this).work += amount;
        this.check();
    }
    integer(value) {
        bigint(value);
        const state = direct(this), bits = (value < 0n ? -value : value).toString(2).length;
        if (bits > CHART_LIMITS.integerBits)
            chartFailure('BUDGET', 'the chart integer exceeds8192 bits');
        state.maximumDirectBits = Math.max(state.maximumDirectBits, bits);
        return value;
    }
    add(a, b) { bigint(a); bigint(b); return this.integer(a + b); }
    sub(a, b) { bigint(a); bigint(b); return this.integer(a - b); }
    mul(a, b) { bigint(a); bigint(b); return this.integer(a * b); }
    neg(a) { bigint(a); return this.integer(-a); }
    abs(a) { return this.compare(a, 0n) < 0 ? this.neg(a) : a; }
    compare(a, b) {
        bigint(a);
        bigint(b);
        direct(this);
        if (a < b)
            return -1;
        direct(this);
        return a > b ? 1 : 0;
    }
    div(a, b) {
        if (this.compare(b, 0n) === 0)
            chartFailure('UNRESOLVED', 'an exact integer divisor is zero');
        const quotient = this.integer(a / b), remainder = this.integer(a % b);
        if (this.compare(remainder, 0n) !== 0)
            chartFailure('UNRESOLVED', 'integer division must be exact');
        return quotient;
    }
    /** Negative bits use the exact BigInt right-shift operation, not an exact rational division. */
    shift(value, bits) {
        bigint(value);
        if (!Number.isSafeInteger(bits) || Math.abs(bits) > CHART_LIMITS.integerBits)
            chartFailure('INPUT', 'a bounded integer shift is required');
        return this.integer(bits >= 0 ? value << BigInt(bits) : value >> BigInt(-bits));
    }
    bitAnd(a, b) { bigint(a); bigint(b); return this.integer(a & b); }
    requireCurve(curve) { if (!stateOf(this).curves.has(curve))
        chartFailure('INPUT', 'the curve must be an immutable chart owned by this context'); this.charge(); }
    requireNode(node) { if (!stateOf(this).nodes.has(node))
        chartFailure('INPUT', 'the node must be an immutable chart owned by this context'); this.charge(); }
    counts() {
        const state = stateOf(this), rational = this.q.counts();
        return { rational, directOperations: state.directOperations, totalOperations: rational.operations + state.directOperations, work: state.work, maximumDirectBits: state.maximumDirectBits, curves: state.curves.size, nodes: state.nodes.size };
    }
}
/** Private loop-family ledger. The ordinary constructor remains fixed at two curves. */
export function createChartLoopContext(options = {}) {
    const ctx = Object.create(ChartContext.prototype);
    initializeContext(ctx, options, LOOP_CHART_LIMITS);
    return ctx;
}
function freezeData(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value))
        return;
    Object.freeze(value);
    for (const child of Object.values(value))
        freezeData(child);
}
function sourceSnapshot(input) {
    const data = ownSnapshot(input, false, OWN);
    if (!data || typeof data !== 'object' || Array.isArray(data) || !hasExactOwnFields(data, CURVE_FIELDS))
        chartFailure('INPUT', 'exact own cubic Curve fields are required');
    const source = data;
    if (source.kind !== 'curve' || source.degree !== 3 || !Array.isArray(source.controlPoints) || source.controlPoints.length !== 4)
        chartFailure('SUPPORT', 'one stored rational cubic with four poles is required');
    try {
        validateCurve(source);
    }
    catch {
        chartFailure('INPUT', 'invalid native cubic data');
    }
    if (source.id.length > 64 || source.knots.length !== 8)
        chartFailure('INPUT', 'bounded native cubic fields are required');
    for (let i = 0; i < 8; i++)
        if (source.knots[i] !== (i < 4 ? 0 : 1))
            chartFailure('SUPPORT', 'the original cubic domain must remain clamped[0,1]');
    for (let i = 0; i < 4; i++) {
        if (!(source.weights[i] >= 0.5 && source.weights[i] <= 1))
            chartFailure('SUPPORT', 'stored weights must lie within[0.5,1]');
        const p = source.controlPoints[i];
        if (!(p[0] > 0 && p[1] > 0))
            chartFailure('SUPPORT', 'stored X/Y poles must be strictly positive');
        for (const coordinate of p)
            if (Math.abs(coordinate) > CadNumericPolicy.coordinateAbs)
                chartFailure('SUPPORT', 'stored poles must remain within the native CAD range');
    }
    return source;
}
function commonControls(source, ctx) {
    const q = ctx.q, rows = [];
    let denominator = 1n;
    for (let i = 0; i < 4; i++) {
        const w = q.from(source.weights[i]), row = [q.mul(q.from(source.controlPoints[i][0]), w), q.mul(q.from(source.controlPoints[i][1]), w), q.mul(q.from(source.controlPoints[i][2]), w), w];
        for (const value of row) {
            if (ctx.compare(value.d, 0n) <= 0 || ctx.compare(ctx.bitAnd(value.d, ctx.sub(value.d, 1n)), 0n) !== 0)
                chartFailure('SUPPORT', 'stored homogeneous denominators must be positive powers of two');
            if (ctx.compare(value.d, denominator) > 0)
                denominator = value.d;
        }
        rows.push(row);
        ctx.check();
    }
    const controls = [];
    for (const row of rows) {
        const point = [];
        for (const value of row)
            point.push(ctx.mul(value.n, ctx.div(denominator, value.d)));
        controls.push(Object.freeze(point));
    }
    return { controls: Object.freeze(controls), denominator };
}
function derivativeNumerator(controls, first, second, ctx) {
    const da = [], db = [], out = [];
    for (let i = 0; i < 3; i++) {
        da.push(ctx.mul(3n, ctx.sub(controls[i + 1][first], controls[i][first])));
        db.push(ctx.mul(3n, ctx.sub(controls[i + 1][second], controls[i][second])));
    }
    for (let k = 0; k < 6; k++) {
        let sum = 0n;
        for (let i = Math.max(0, k - 2); i <= Math.min(3, k); i++) {
            const j = k - i, factor = BigInt(CUBIC[i] * QUADRATIC[j] * (10 / QUINTIC[k]));
            const term = ctx.sub(ctx.mul(controls[i][first], db[j]), ctx.mul(controls[i][second], da[j]));
            sum = ctx.add(sum, ctx.mul(factor, term));
        }
        out.push(sum);
    }
    return out;
}
function strictProgress(coefficients, coordinate, ctx) {
    const sign = ctx.compare(coefficients[0], 0n);
    if (sign === 0)
        return null;
    let minimum = ctx.abs(coefficients[0]);
    for (const coefficient of coefficients) {
        if (ctx.compare(coefficient, 0n) !== sign)
            return null;
        const value = ctx.abs(coefficient);
        if (ctx.compare(value, minimum) < 0)
            minimum = value;
    }
    return Object.freeze({ coordinate, sign: sign, coefficients: Object.freeze([...coefficients]), minimum, positiveScale: 10 });
}
function makeNode(controls, curve, depth, index, ctx) {
    const state = stateOf(ctx);
    if (state.nodes.size >= CHART_LIMITS.nodes)
        chartFailure('BUDGET', 'the shared subdivision-node limit was exceeded');
    const node = Object.freeze({ id: state.nodes.size, curve, depth, index, controls });
    state.nodes.add(node);
    ctx.charge();
    return node;
}
/** Private projection data and one-coordinate progress only; no cylinder, B-rep, volume or Number-evaluator authority. */
export function prepareChartCurve(input, ctx) {
    const state = stateOf(ctx);
    ctx.charge();
    if (state.curves.size >= ctx.limits.curves)
        chartFailure('BUDGET', ctx.limits.curves === 2 ? 'this shared chart request admits at most two curves' : 'this shared loop chart request admits at most 32 curves');
    const source = sourceSnapshot(input), { controls, denominator } = commonControls(source, ctx);
    const angular = strictProgress(derivativeNumerator(controls, 0, 1, ctx), 'slope', ctx);
    const progress = angular ?? strictProgress(derivativeNumerator(controls, 3, 2, ctx), 'height', ctx);
    if (!progress)
        chartFailure('UNRESOLVED', 'strict whole-span progress of either projected coordinate could not be certified');
    freezeData(source);
    const root = makeNode(controls, state.curves.size, 0, 0, ctx), curve = Object.freeze({ source, denominator, root, progress });
    state.curves.add(curve);
    ctx.check();
    return curve;
}
/** Ratios are internal exact pairs, not Number coordinates or a serialized proof format. */
export function chartCompareRatios(a, b, ctx) {
    if (ctx.compare(a.d, 0n) <= 0 || ctx.compare(b.d, 0n) <= 0)
        chartFailure('INPUT', 'ratio denominators must be positive');
    return ctx.compare(ctx.mul(a.n, b.d), ctx.mul(b.n, a.d));
}
function frozenRatio(n, d) { return Object.freeze({ n, d }); }
export function chartBox(node, ctx) {
    ctx.requireNode(node);
    const state = stateOf(ctx), hit = state.boxes.get(node);
    if (hit)
        return hit;
    let lowSlope = frozenRatio(node.controls[0][1], node.controls[0][0]), highSlope = lowSlope;
    let lowHeight = frozenRatio(node.controls[0][2], node.controls[0][3]), highHeight = lowHeight;
    for (let i = 1; i < 4; i++) {
        const p = node.controls[i], slope = frozenRatio(p[1], p[0]), height = frozenRatio(p[2], p[3]);
        if (chartCompareRatios(slope, lowSlope, ctx) < 0)
            lowSlope = slope;
        if (chartCompareRatios(slope, highSlope, ctx) > 0)
            highSlope = slope;
        if (chartCompareRatios(height, lowHeight, ctx) < 0)
            lowHeight = height;
        if (chartCompareRatios(height, highHeight, ctx) > 0)
            highHeight = height;
    }
    const box = Object.freeze({ slope: Object.freeze([lowSlope, highSlope]), height: Object.freeze([lowHeight, highHeight]) });
    state.boxes.set(node, box);
    ctx.check();
    return box;
}
/** Exact de Casteljau halves. Every child control has one common factor8, not independent row scales. */
export function splitChartNode(node, ctx) {
    ctx.requireNode(node);
    const state = stateOf(ctx), hit = state.splits.get(node);
    if (hit)
        return hit;
    if (node.depth >= ctx.maxDepth)
        chartFailure('UNRESOLVED', 'the tightened chart subdivision depth was reached');
    if (state.nodes.size + 2 > CHART_LIMITS.nodes)
        chartFailure('BUDGET', 'the shared subdivision-node limit was exceeded');
    const triangle = [];
    const first = [];
    for (const point of node.controls)
        first.push([...point]);
    triangle.push(first);
    for (let level = 1; level <= 3; level++) {
        const previous = triangle[level - 1], row = [];
        for (let i = 0; i < previous.length - 1; i++) {
            const point = [];
            for (let axis = 0; axis < 4; axis++)
                point.push(ctx.add(previous[i][axis], previous[i + 1][axis]));
            row.push(point);
        }
        triangle.push(row);
    }
    const left = [], right = [];
    for (let i = 0; i < 4; i++) {
        const a = [], b = [];
        for (let axis = 0; axis < 4; axis++) {
            a.push(ctx.shift(triangle[i][0][axis], 3 - i));
            b.push(ctx.shift(triangle[3 - i][i][axis], i));
        }
        left.push(Object.freeze(a));
        right.push(Object.freeze(b));
    }
    const lower = makeNode(Object.freeze(left), node.curve, node.depth + 1, 2 * node.index, ctx);
    const upper = makeNode(Object.freeze(right), node.curve, node.depth + 1, 2 * node.index + 1, ctx);
    const children = Object.freeze([lower, upper]);
    state.splits.set(node, children);
    ctx.check();
    return children;
}

import { checkBrep, lineCurve } from '../brep/brep-core.js';
import { exactOrient2, exactPoint2FromXY } from '../brep/planar-arrangement.js';
import { validateCurve, validateSurface } from '../core/math.js';
import { isFrom, kernelRefusal } from '../core/barocss-error.js';
import { hasExactOwnFields, ownSnapshot } from '../core/own-data.js';
import { CadNumericPolicy } from '../numeric-policy.js';
import { SectionRationalContext } from '../section-rational-internal.js';
import { composeCylindricalWrapCurve, isCylindricalWrapCurveError } from './cylindrical-wrap-curve.js';
import { isCylindricalWrapMapError } from './cylindrical-wrap-map.js';
import { buildCylindricalWrapUVSource, isCylindricalWrapSourceError } from './cylindrical-wrap-source.js';
import { certifyNativeD0Family, isNativeD0Error } from '../core/native-d0-bound.js';
import { certifyCylindricalWrapChartComponent } from './cylindrical-wrap-chart-component.js';
import { isCylindricalWrapChartError } from './cylindrical-wrap-chart.js';
import { certifyCylindricalWrapSideFamily } from './cylindrical-wrap-side-family.js';
import { prepareNativePositionFace, requireNativePcurveRange, nativePositionInflation, checkedNativePositionBound, nativeEndpointPositionBound, nativeAffineCapResidual, isNativePositionError } from './cylindrical-wrap-native-position.js';
const MAX_EDGES = 512, MAX_WORK = 1048576, MAX_EXACT = 200000;
const LIMITS = { components: 64, edges: 512, work: 1048576, exactOperations: 200000, integerBits: 8192 };
const CUBIC = [1n, 3n, 3n, 1n], QUADRATIC = [1n, 2n, 1n], QUINTIC = [1n, 5n, 10n, 10n, 5n, 1n];
function fail(code, detail) {
    throw kernelRefusal('cylindrical-wrap-assembly', code, `Cylindrical wrap assembly: ${detail}`);
}
export function isCylindricalWrapAssemblyError(error) {
    try {
        return isFrom(error, 'cylindrical-wrap-assembly');
    }
    catch {
        return false;
    }
}
function wrap(code, detail) { return fail(code, detail); }
function exactFailure(kind, detail) { fail(kind === 'BUDGET' ? 'BUDGET' : 'BINDING', detail); }
const SNAPSHOT = { input: 'INPUT', owned: 'INPUT', budget: 'BUDGET', fail, wrap, isRefusal: isCylindricalWrapAssemblyError };
class Context {
    maximum;
    native;
    q = new SectionRationalContext(exactFailure);
    exactPoints = new Map();
    angularGuards = new Map();
    work = 0;
    helperOperations = 0;
    integerOperations = 0;
    integerMaximumBits = 0;
    edges = 0;
    helperWork = 0;
    helperMaximumBits = 0;
    constructor(maximum = MAX_EXACT, native = false) {
        this.maximum = maximum;
        this.native = native;
    }
    totalWork() { const c = this.q.counts(); return this.native ? this.work + this.helperWork + c.operations + c.gcdSteps + c.floatSearchSteps : this.work; }
    addHelperWork(amount, maximumBits) {
        if (!this.native)
            return;
        if (!Number.isSafeInteger(amount) || amount < 0 || !Number.isSafeInteger(maximumBits) || maximumBits < 0 || maximumBits > LIMITS.integerBits)
            fail('BUDGET', 'invalid imported native helper work or integer size');
        this.helperWork += amount;
        this.helperMaximumBits = Math.max(this.helperMaximumBits, maximumBits);
        this.check();
    }
    importHelper(operations, work, maximumBits) {
        if (!Number.isSafeInteger(operations) || operations < 0)
            fail('BUDGET', 'invalid imported native exact-operation count');
        this.helperOperations += operations;
        this.addHelperWork(work, maximumBits);
        this.check();
    }
    counts() {
        this.check();
        const c = this.q.counts();
        return { exactOperations: this.helperOperations + c.operations + this.integerOperations, rationalOperations: c.operations, integerOperations: this.integerOperations,
            helperOperations: this.helperOperations, work: this.totalWork(), maximumBits: Math.max(c.maximumObservedBits, this.integerMaximumBits, this.helperMaximumBits) };
    }
    charge(amount = 1) {
        if (!Number.isSafeInteger(amount) || amount < 0 || (this.work += amount) > MAX_WORK)
            fail('BUDGET', 'the assembly work budget was exceeded');
        if (this.native)
            this.check();
    }
    countHelpers(amount) { this.helperOperations += amount; this.check(); }
    countInteger() { this.integerOperations++; this.charge(); this.check(); }
    integer(value) {
        this.countInteger();
        const text = value.toString(2), bits = text.length - (text[0] === '-' ? 1 : 0);
        if (bits > LIMITS.integerBits)
            fail('BUDGET', 'the direct exact integer bit budget was exceeded');
        this.integerMaximumBits = Math.max(this.integerMaximumBits, bits);
        return value;
    }
    remaining() {
        this.check();
        const remaining = this.maximum - this.helperOperations - this.q.counts().operations - this.integerOperations;
        if (remaining < 1)
            fail('BUDGET', 'no aggregate exact-operation budget remains for composition');
        return remaining;
    }
    check() {
        if (this.helperOperations + this.q.counts().operations + this.integerOperations > this.maximum)
            fail('BUDGET', 'the aggregate exact-operation budget was exceeded');
        if (this.native && this.totalWork() > MAX_WORK)
            fail('BUDGET', 'the complete native request work budget was exceeded');
    }
}
function record(value, fields) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || !hasExactOwnFields(value, fields))
        fail('INPUT', 'exact plain own fields are required');
    return value;
}
function finite(value) {
    if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > CadNumericPolicy.coordinateAbs)
        fail('INPUT', 'finite bounded native numbers are required');
    return value;
}
function optionsSnapshot(input) {
    const data = record(ownSnapshot(input, false, SNAPSHOT), ['id', 'height']);
    if (typeof data.id !== 'string' || !/^[A-Za-z_][A-Za-z0-9_-]{0,23}$/.test(data.id))
        fail('INPUT', 'an assembly identifier of at most24 characters is required');
    const height = finite(data.height);
    if (!(height > 0))
        fail('INPUT', 'positive height is required');
    return { id: data.id, height };
}
function sourceOf(part, options) {
    try {
        return buildCylindricalWrapUVSource(part, { id: options.id });
    }
    catch (error) {
        if (isCylindricalWrapSourceError(error) || isCylindricalWrapMapError(error))
            fail(error.code === 'BUDGET' ? 'BUDGET' : 'SUPPORT', error.message);
        throw error;
    }
}
function composed(surface, start, end, options) {
    try {
        return composeCylindricalWrapCurve(surface, { start, end }, options);
    }
    catch (error) {
        if (isCylindricalWrapCurveError(error))
            fail(error.code === 'BUDGET' ? 'BUDGET' : 'BINDING', error.message);
        throw error;
    }
}
function point(input) {
    if (!Array.isArray(input) || input.length !== 2)
        fail('INPUT', 'two original native UV coordinates are required');
    return [finite(input[0]), finite(input[1])];
}
function exactPoint(p, ctx) {
    let found = ctx.exactPoints.get(p);
    if (!found) {
        found = exactPoint2FromXY(p);
        ctx.exactPoints.set(p, found);
    }
    return found;
}
function orient(a, b, c, ctx) {
    ctx.charge();
    if (ctx.native) {
        const q = ctx.q, abx = q.sub(q.from(b[0]), q.from(a[0])), aby = q.sub(q.from(b[1]), q.from(a[1])), acx = q.sub(q.from(c[0]), q.from(a[0])), acy = q.sub(q.from(c[1]), q.from(a[1]));
        const value = q.sub(q.mul(abx, acy), q.mul(aby, acx));
        ctx.check();
        return value.n > 0n ? 1 : value.n < 0n ? -1 : 0;
    }
    return exactOrient2(exactPoint(a, ctx), exactPoint(b, ctx), exactPoint(c, ctx));
}
function area(points, ctx) {
    const q = ctx.q;
    let out = q.integer(0);
    for (let i = 0; i < points.length; i++) {
        const a = points[i], b = points[(i + 1) % points.length];
        out = q.add(out, q.sub(q.mul(q.from(a[0]), q.from(b[1])), q.mul(q.from(a[1]), q.from(b[0]))));
        ctx.charge();
    }
    return q.div(out, q.integer(2));
}
function inside(p, ring, ctx) {
    let winding = 0;
    for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length];
        ctx.charge();
        if (a[1] <= p[1] && b[1] > p[1] && orient(a, b, p, ctx) > 0)
            winding++;
        else if (b[1] <= p[1] && a[1] > p[1] && orient(a, b, p, ctx) < 0)
            winding--;
    }
    return winding !== 0;
}
function fraction(value, q) { return q.rat(BigInt(value.numerator), BigInt(value.denominator)); }
function metric(source, ctx) {
    const q = ctx.q, proof = source.carrier.proof;
    let maximum = fraction(proof.squaredRadiusNumerator[0], q);
    for (const value of proof.squaredRadiusNumerator)
        maximum = q.max(maximum, fraction(value, q));
    // r>=R/2 and a chord/angle factor>=1/2 throughout this quarter.
    const angular = q.div(q.mul(q.from(source.radius), fraction(proof.angularMinimum, q)), q.mul(q.integer(4), q.mul(maximum, q.sub(q.from(source.carrier.domain[1]), q.from(source.carrier.domain[0])))));
    const axial = q.div(q.sub(q.from(source.z[1]), q.from(source.z[0])), q.sub(q.from(source.quarter.knotsV[2]), q.from(source.quarter.knotsV[1])));
    if (angular.n <= 0n || axial.n <= 0n)
        fail('BINDING', 'positive native chart metric bounds are required');
    return [angular, axial];
}
function gap(a, b, c, d, q) {
    return q.sub(q.from(Math.max(Math.min(a, b), Math.min(c, d))), q.from(Math.min(Math.max(a, b), Math.max(c, d))));
}
function apart(a, b, c, d, scale, margin, ctx) {
    ctx.charge();
    const q = ctx.q;
    for (let axis = 0; axis < 2; axis++)
        if (q.compare(q.mul(gap(a[axis], b[axis], c[axis], d[axis], q), scale[axis]), margin) > 0)
            return true;
    return false;
}
function ringsApart(a, b, scale, margin, ctx) {
    for (let i = 0; i < a.length; i++)
        for (let j = 0; j < b.length; j++)
            if (!apart(a[i], a[(i + 1) % a.length], b[j], b[(j + 1) % b.length], scale, margin, ctx))
                return false;
    return true;
}
function ringSnapshot(input, component, index, source, scale, margin, ctx) {
    if (!Array.isArray(input) || input.length < 4 || input.length > 512)
        fail('INPUT', 'rectilinear rings need 4..512 vertices without a repeated closing point');
    if ((ctx.edges += input.length) > MAX_EDGES)
        fail('BUDGET', 'the assembly exceeds512 total boundary pieces');
    const points = [], q = ctx.q, u = source.carrier.domain, v = [source.quarter.knotsV[1], source.quarter.knotsV[2]];
    for (const item of input) {
        const p = point(item);
        for (let axis = 0; axis < 2; axis++) {
            const domain = axis === 0 ? u : v;
            if (q.compare(q.mul(q.sub(q.from(p[axis]), q.from(domain[0])), scale[axis]), margin) <= 0 || q.compare(q.mul(q.sub(q.from(domain[1]), q.from(p[axis])), scale[axis]), margin) <= 0)
                fail('SUPPORT', 'all ink must stay strictly inside the original quarter and caps');
        }
        points.push(p);
    }
    for (let i = 0; i < points.length; i++) {
        const a = points[i], b = points[(i + 1) % points.length], c = points[(i + 2) % points.length];
        if (a[0] === b[0] && a[1] === b[1])
            fail('SUPPORT', 'a boundary edge collapses');
        let axis;
        if (a[0] === b[0])
            axis = 1;
        else if (a[1] === b[1])
            axis = 0;
        else
            fail('SUPPORT', 'only rectilinear original-UV edges are supported');
        if (q.compare(q.mul(q.abs(q.sub(q.from(b[axis]), q.from(a[axis]))), scale[axis]), q.from(1e-4)) < 0)
            fail('SUPPORT', 'a boundary edge is below the native minimum length');
        if (orient(a, b, c, ctx) === 0 && ((b[axis] > a[axis]) !== (c[axis] > b[axis])))
            fail('SUPPORT', 'an adjacent boundary retraces');
        for (let j = i + 2; j < points.length; j++)
            if (!(i === 0 && j === points.length - 1) && !apart(a, b, points[j], points[(j + 1) % points.length], scale, margin, ctx))
                fail('SUPPORT', 'a ring crosses, touches or has an unresolved narrow gap');
    }
    const signed = area(points, ctx);
    if (signed.n === 0n)
        fail('SUPPORT', 'a ring has no ink area');
    if ((signed.n > 0n) !== (index === 0))
        points.reverse();
    return { component, index, points, corners: [], pieces: [] };
}
function componentsSnapshot(input, source, tolerance, ctx) {
    const data = ownSnapshot(input, false, SNAPSHOT);
    if (!Array.isArray(data) || !data.length || data.length > 64)
        fail('INPUT', '1..64 original-UV components are required');
    const out = [], scale = metric(source, ctx), margin = ctx.q.mul(ctx.q.from(tolerance), ctx.q.integer(4));
    for (let c = 0; c < data.length; c++) {
        const item = record(data[c], ['outer', 'holes']);
        if (!Array.isArray(item.holes) || item.holes.length > 64)
            fail('INPUT', 'at most64 counters per component are supported');
        const outer = ringSnapshot(item.outer, c, 0, source, scale, margin, ctx), holes = [];
        for (let h = 0; h < item.holes.length; h++) {
            const hole = ringSnapshot(item.holes[h], c, h + 1, source, scale, margin, ctx);
            if (!ringsApart(outer.points, hole.points, scale, margin, ctx) || !inside(hole.points[0], outer.points, ctx))
                fail('SUPPORT', 'a counter must stay strictly inside its component');
            for (const prior of holes)
                if (!ringsApart(prior.points, hole.points, scale, margin, ctx) || inside(hole.points[0], prior.points, ctx) || inside(prior.points[0], hole.points, ctx))
                    fail('SUPPORT', 'counters must not touch, overlap or nest');
            holes.push(hole);
        }
        for (const prior of out)
            if (!ringsApart(prior.outer.points, outer.points, scale, margin, ctx) || inside(outer.points[0], prior.outer.points, ctx) || inside(prior.outer.points[0], outer.points, ctx))
                fail('SUPPORT', 'overlapping or nested components are outside this diagnostic scope');
        out.push({ outer, holes });
    }
    ctx.check();
    return out;
}
function derivative(a, q) {
    const out = [], degree = q.integer(a.length - 1);
    for (let i = 0; i + 1 < a.length; i++)
        out.push(q.mul(degree, q.sub(a[i + 1], a[i])));
    return out;
}
function integerCompare(a, b, ctx) {
    ctx.countInteger();
    if (a < b)
        return -1;
    ctx.countInteger();
    return a > b ? 1 : 0;
}
function dyadicDenominator(value, denominator, ctx) {
    if (integerCompare(value.d, 0n, ctx) <= 0 || integerCompare(ctx.integer(value.d & ctx.integer(value.d - 1n)), 0n, ctx) !== 0)
        fail('BINDING', 'stored homogeneous coefficients must have positive power-of-two denominators');
    return integerCompare(value.d, denominator, ctx) > 0 ? value.d : denominator;
}
function angularCoefficients(curve, ctx) {
    const q = ctx.q, x = [], y = [], ix = [], iy = [], dx = [], dy = [];
    let denominator = ctx.integer(1n);
    for (let i = 0; i < 4; i++) {
        const weight = q.from(curve.weights[i]), a = q.mul(q.from(curve.controlPoints[i][0]), weight), b = q.mul(q.from(curve.controlPoints[i][1]), weight);
        x.push(a);
        y.push(b);
        denominator = dyadicDenominator(a, denominator, ctx);
        denominator = dyadicDenominator(b, denominator, ctx);
    }
    // The largest positive dyadic denominator is their exact common denominator. No GCD is needed in the sum.
    for (let i = 0; i < 4; i++) {
        ix.push(ctx.integer(x[i].n * ctx.integer(denominator / x[i].d)));
        iy.push(ctx.integer(y[i].n * ctx.integer(denominator / y[i].d)));
    }
    for (let i = 0; i < 3; i++) {
        dx.push(ctx.integer(3n * ctx.integer(ix[i + 1] - ix[i])));
        dy.push(ctx.integer(3n * ctx.integer(iy[i + 1] - iy[i])));
    }
    const sums = [];
    for (let i = 0; i < 6; i++)
        sums.push(ctx.integer(0n));
    for (let i = 0; i < 4; i++)
        for (let j = 0; j < 3; j++) {
            const cross = ctx.integer(ctx.integer(ix[i] * dy[j]) - ctx.integer(iy[i] * dx[j]));
            const term = ctx.integer(ctx.integer(CUBIC[i] * QUADRATIC[j]) * cross);
            sums[i + j] = ctx.integer(sums[i + j] + term);
        }
    const square = ctx.integer(denominator * denominator), out = [];
    // K_k = sum(C3_i*C2_j*(X_i*dY_j-Y_i*dX_j))/(D^2*C5_k), with i+j=k.
    for (let k = 0; k < 6; k++)
        out.push(q.rat(sums[k], ctx.integer(square * QUINTIC[k])));
    ctx.check();
    return out;
}
function guard(curve, raised, start, end, ctx) {
    const q = ctx.q, z = [];
    if (curve.degree !== 3 || raised.degree !== 3 || !sameData(curve.knots, raised.knots))
        fail('BINDING', 'the two side boundaries must retain one common cubic basis');
    for (let i = 0; i < 4; i++) {
        if (!Object.is(curve.weights[i], raised.weights[i]) || !Object.is(raised.controlPoints[i][0], 2 * curve.controlPoints[i][0]) || !Object.is(raised.controlPoints[i][1], 2 * curve.controlPoints[i][1]) || !Object.is(raised.controlPoints[i][2], curve.controlPoints[i][2]))
            fail('BINDING', 'stored cubics must retain exact factor2 XY homothety and identical weights');
        if (!(curve.weights[i] > 0))
            fail('BINDING', 'the stored cubic denominator is not positive');
        if (!(curve.controlPoints[i][0] > 0 && curve.controlPoints[i][1] > 0))
            fail('BINDING', 'stored boundary coefficients must stay strictly in the first quadrant');
    }
    const horizontal = start[1] === end[1], key = `${Math.min(start[0], end[0])}:${Math.max(start[0], end[0])}`;
    let coefficients, sign;
    if (horizontal) {
        for (const pole of curve.controlPoints)
            if (!Object.is(pole[2], curve.controlPoints[0][2]))
                fail('BINDING', 'a horizontal boundary must retain exact constant Z');
        const cached = ctx.angularGuards.get(key);
        if (cached) {
            const forward = start[0] === cached.start;
            for (let i = 0; i < 4; i++) {
                const at = forward ? i : 3 - i;
                if (!Object.is(curve.weights[i], cached.curve.weights[at]) || !Object.is(curve.controlPoints[i][0], cached.curve.controlPoints[at][0]) || !Object.is(curve.controlPoints[i][1], cached.curve.controlPoints[at][1]))
                    fail('BINDING', 'a reused angular certificate needs identical XY coefficients and weights');
            }
            // Reversing t reverses and negates K; the signed Bernstein minimum is unchanged.
            ctx.charge(4);
            return cached.proof;
        }
    }
    if (horizontal) {
        coefficients = angularCoefficients(curve, ctx);
        sign = Math.sign(end[0] - start[0]);
    }
    else {
        for (const pole of curve.controlPoints)
            if (!Object.is(pole[0], curve.controlPoints[0][0]) || !Object.is(pole[1], curve.controlPoints[0][1]))
                fail('BINDING', 'a vertical boundary must retain exact constant XY');
        if (!(curve.controlPoints[0][0] > 0 && curve.controlPoints[0][1] > 0))
            fail('BINDING', 'a vertical side needs a positive first-quadrant radius');
        // Direct vertical cubics have unit weights: their degree-two Cartesian Z derivative is the
        // exact rational derivative numerator. No degree-five product/elevation is needed.
        for (let i = 0; i < 4; i++) {
            if (curve.weights[i] !== 1)
                fail('BINDING', 'a direct vertical cubic must keep unit weights');
            z.push(q.from(curve.controlPoints[i][2]));
        }
        coefficients = derivative(z, q);
        sign = Math.sign(end[1] - start[1]);
    }
    let minimum = null;
    for (const value of coefficients) {
        const signed = sign < 0 ? q.neg(value) : value;
        if (signed.n <= 0n)
            fail('BINDING', 'full-span stored-cubic monotonicity cannot be proved by strict Bernstein signs');
        if (minimum === null || q.compare(signed, minimum) < 0)
            minimum = signed;
    }
    ctx.charge(coefficients.length);
    ctx.check();
    const proof = { kind: horizontal ? 'angular' : 'vertical', minimum: q.text(minimum), homothety: 2, regularSide: true };
    if (horizontal)
        ctx.angularGuards.set(key, { start: start[0], curve, proof });
    return proof;
}
function sameData(a, b) {
    if (Object.is(a, b))
        return true;
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b))
        return false;
    const keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length)
        return false;
    for (const key of keys)
        if (!Object.hasOwn(b, key) || !sameData(a[key], b[key]))
            return false;
    return true;
}
class Assembly {
    source;
    id;
    tolerance;
    ctx;
    vertices;
    edges;
    loops;
    faces;
    coedges = [];
    ids = new Set();
    names = new Set();
    pieces = [];
    table = [];
    byEdge = new Map();
    newCurves = new Map();
    newPoints = new Map();
    horizontal = new Map();
    axial = new Map();
    radial = new Map();
    nativeEvidence;
    verticalCurves = 0;
    outer;
    horizontalSource;
    serial = 0;
    constructor(source, id, tolerance, ctx) {
        this.source = source;
        this.id = id;
        this.tolerance = tolerance;
        this.ctx = ctx;
        this.nativeEvidence = ctx.native ? [] : null;
        const b = source.brep;
        this.vertices = [...b.vertices];
        this.edges = [...b.edges];
        this.loops = [...b.loops];
        this.faces = [...b.faces];
        for (const list of [b.bodies, b.shells, b.faces, b.loops, b.coedges, b.edges, b.vertices])
            for (const item of list)
                this.ids.add(item.id);
        for (const face of b.faces) {
            this.ids.add(face.surface.id);
            if (face.name !== undefined)
                this.names.add(face.name);
        }
        for (const edge of b.edges) {
            this.ids.add(edge.curve.id);
            if (edge.name !== undefined)
                this.names.add(edge.name);
        }
        for (const coedge of b.coedges)
            if (coedge.pcurve)
                this.ids.add(coedge.pcurve.id);
        const original = source.quarter, controlPoints = [], weights = [];
        for (let i = 0; i < 3; i++) {
            const row = [];
            for (const p of original.controlPoints[i]) {
                const raised = [2 * p[0], 2 * p[1], p[2]];
                for (const value of raised)
                    if (!Number.isFinite(value) || Math.abs(value) > CadNumericPolicy.coordinateAbs)
                        fail('SUPPORT', 'factor2 homothety leaves the native CAD range');
                row.push(raised);
            }
            controlPoints.push(row);
            weights.push([...original.weights[i]]);
        }
        this.outer = { ...original, id: this.key('surface'), knotsU: [...original.knotsU], knotsV: [...original.knotsV], controlPoints, weights };
        validateSurface(this.outer);
        // The admitted tensor product has V-independent XY and weights. Its exact XY projection
        // permits one zero-Z composition per U interval; physical Z is certified separately below.
        const projected = [];
        for (const row of original.controlPoints) {
            const own = [];
            for (const p of row)
                own.push([p[0], p[1], 0]);
            projected.push(own);
        }
        this.horizontalSource = { ...original, id: this.key('projection'), controlPoints: projected };
        validateSurface(this.horizontalSource);
        if (ctx.native) {
            nativeStructure(this.outer, ctx);
            nativeStructure(this.horizontalSource, ctx);
            freezeNativeData(this.outer);
            freezeNativeData(this.horizontalSource);
        }
    }
    key(role) {
        const key = `${this.id}_wa_${role}${this.serial++}`;
        if (key.length > 64 || this.ids.has(key))
            fail('INPUT', 'a generated native identifier collides or exceeds its bound');
        this.ids.add(key);
        return key;
    }
    name(role) {
        const name = `${this.id}.${role}`;
        if (this.names.has(name))
            fail('INPUT', 'a generated persistent name collides with an original name');
        this.names.add(name);
        return name;
    }
    loop(face, kind, uses) {
        const id = this.key('loop'), ids = [];
        for (let i = 0; i < uses.length; i++)
            ids.push(this.key('coedge'));
        for (let i = 0; i < uses.length; i++) {
            const use = uses[i], coedge = { id: ids[i], edge: use.edge, sense: use.sense, loop: id, next: ids[(i + 1) % ids.length], prev: ids[(i - 1 + ids.length) % ids.length], twin: null, pcurve: use.pcurve };
            this.coedges.push(coedge);
            const list = this.byEdge.get(use.edge);
            if (list)
                list.push(coedge);
            else
                this.byEdge.set(use.edge, [coedge]);
        }
        this.loops.push({ id, face, kind, coedges: ids });
        return id;
    }
    pcurve(a, b) { return lineCurve(this.key('pcurve'), a, b); }
}
function raised(p) { return [2 * p[0], 2 * p[1], p[2]]; }
function fillCorner(corner, point) {
    if (corner.point !== null) {
        if (!sameData(corner.point, point))
            fail('BINDING', 'shared base endpoints changed bits');
        return;
    }
    corner.point = [point[0], point[1], point[2]];
    corner.raised = raised(corner.point);
}
function baseUses(ring) {
    const uses = [];
    for (let i = ring.pieces.length - 1; i >= 0; i--)
        uses.push({ edge: ring.pieces[i].base, sense: 'reversed', pcurve: ring.pieces[i].basePcurve });
    return uses;
}
function outerUses(ring) {
    const uses = [];
    for (const piece of ring.pieces)
        uses.push({ edge: piece.outer, sense: 'forward', pcurve: piece.outerPcurve });
    return uses;
}
function nearestCandidate(exact, candidate, q) {
    return Number.isFinite(candidate) && q.compare(q.from(candidate), exact) === 0 ? candidate : q.nearest(exact);
}
function axialAt(v, a) {
    let found = a.axial.get(v);
    if (found)
        return found;
    const q = a.ctx.q, source = a.source, v0 = q.from(source.quarter.knotsV[1]), v1 = q.from(source.quarter.knotsV[2]);
    const exact = q.add(q.from(source.z[0]), q.mul(q.sub(q.from(source.z[1]), q.from(source.z[0])), q.div(q.sub(q.from(v), v0), q.sub(v1, v0))));
    const candidate = source.z[0] + (source.z[1] - source.z[0]) * (v - source.quarter.knotsV[1]) / (source.quarter.knotsV[2] - source.quarter.knotsV[1]);
    const value = nearestCandidate(exact, candidate, q), error = q.abs(q.sub(q.from(value), exact));
    found = { exact, value, error };
    a.axial.set(v, found);
    return found;
}
function radialAt(u, a) {
    let found = a.radial.get(u);
    if (found)
        return found;
    const q = a.ctx.q, source = a.source.quarter, low = q.from(source.knotsU[2]), high = q.from(source.knotsU[3]);
    const t = q.div(q.sub(q.from(u), low), q.sub(high, low)), m = q.sub(q.integer(1), t), basis = [q.mul(m, m), q.mul(q.integer(2), q.mul(m, t)), q.mul(t, t)];
    let denominator = q.integer(0), x = q.integer(0), y = q.integer(0);
    for (let i = 0; i < 3; i++) {
        const coefficient = q.mul(basis[i], q.from(source.weights[i][0]));
        denominator = q.add(denominator, coefficient);
        x = q.add(x, q.mul(coefficient, q.from(source.controlPoints[i][0][0])));
        y = q.add(y, q.mul(coefficient, q.from(source.controlPoints[i][0][1])));
    }
    if (denominator.n <= 0n)
        fail('BINDING', 'a fixed-U vertical boundary needs a positive source denominator');
    const exactX = q.div(x, denominator), exactY = q.div(y, denominator), px = q.nearest(exactX), py = q.nearest(exactY);
    found = { point: [px, py], error: q.add(q.abs(q.sub(q.from(px), exactX)), q.abs(q.sub(q.from(py), exactY))) };
    a.radial.set(u, found);
    return found;
}
function nativePcurve(start, end, id) { return lineCurve(id, [start[0], start[1], 0], [end[0], end[1], 0]); }
function cacheRadial(u, point, error, a) {
    // The horizontal global XY certificate bounds this endpoint ray at every V of the admitted extrusion.
    const cached = a.radial.get(u);
    if (cached) {
        if (!Object.is(cached.point[0], point[0]) || !Object.is(cached.point[1], point[1]))
            fail('BINDING', 'one original U must retain one shared stored XY value');
    }
    else
        a.radial.set(u, { point: [point[0], point[1]], error });
}
function projectPointToXY(point) { return point ? [point[0], point[1], 0] : null; }
function horizontalBase(start, end, curveId, pcurveId, budget, a) {
    // Finite Number strings are unique here; strictly interior U excludes the signed-zero case.
    const key = `${Math.min(start.uv[0], end.uv[0])}:${Math.max(start.uv[0], end.uv[0])}`, q = a.ctx.q;
    let template = a.horizontal.get(key);
    if (!template) {
        const v = a.horizontalSource.knotsV[1];
        const composedBase = composed(a.horizontalSource, [start.uv[0], v], [end.uv[0], v], { curveId, pcurveId, errorBudget: budget,
            endpoints: [projectPointToXY(start.point), projectPointToXY(end.point)], maxOperations: a.ctx.remaining() });
        a.ctx.countHelpers(composedBase.proof.counts.operations);
        if (a.ctx.native) {
            const c = composedBase.proof.counts;
            a.ctx.addHelperWork(c.operations + c.gcdSteps + c.floatSearchSteps, c.maximumObservedBits);
        }
        template = { start: start.uv[0], end: end.uv[0], curve: composedBase.curve, error: [fraction(composedBase.proof.axisError[0], q), fraction(composedBase.proof.axisError[1], q)] };
        a.horizontal.set(key, template);
    }
    const axial = axialAt(start.uv[1], a), forward = start.uv[0] === template.start, controlPoints = [], weights = [];
    // Native source weights/XY do not depend on V; only the exact affine Z coordinate changes.
    for (let i = 0; i < 4; i++) {
        const at = forward ? i : 3 - i, p = template.curve.controlPoints[at];
        controlPoints.push([p[0], p[1], axial.value]);
        weights.push(template.curve.weights[at]);
    }
    const radialError = q.add(template.error[0], template.error[1]);
    cacheRadial(start.uv[0], controlPoints[0], radialError, a);
    cacheRadial(end.uv[0], controlPoints[3], radialError, a);
    const curve = { kind: 'curve', id: curveId, degree: 3, knots: [...template.curve.knots], controlPoints, weights };
    return { curve, pcurve: nativePcurve(start.uv, end.uv, pcurveId), error: q.add(radialError, axial.error), authority: 'horizontal-composition-with-exact-axial-replacement' };
}
function verticalBase(start, end, curveId, pcurveId, a) {
    a.verticalCurves++;
    const q = a.ctx.q, radial = radialAt(start.uv[0], a), low = axialAt(start.uv[1], a), high = axialAt(end.uv[1], a), controlPoints = [];
    let maximum = q.integer(0);
    // At fixed original U, the admitted extrusion is exactly constant XY and affine Z.
    // Uniform stored weights make the maximum Cartesian Bernstein residual a global bound.
    for (let i = 0; i < 4; i++) {
        const exact = i === 0 ? low.exact : i === 3 ? high.exact : q.div(q.add(q.mul(q.integer(3 - i), low.exact), q.mul(q.integer(i), high.exact)), q.integer(3));
        const z = i === 0 ? low.value : i === 3 ? high.value : nearestCandidate(exact, low.value + (high.value - low.value) * i / 3, q);
        maximum = q.max(maximum, q.abs(q.sub(q.from(z), exact)));
        controlPoints.push([radial.point[0], radial.point[1], z]);
    }
    return { curve: { kind: 'curve', id: curveId, degree: 3, knots: [0, 0, 0, 0, 1, 1, 1, 1], controlPoints, weights: [1, 1, 1, 1] }, pcurve: nativePcurve(start.uv, end.uv, pcurveId), error: q.add(radial.error, maximum), authority: 'constant-xy-and-affine-z-bernstein-residual' };
}
function admittedBase(start, end, budget, a) {
    const curveId = a.key('curve'), pcurveId = a.key('pcurve');
    const base = start.uv[1] === end.uv[1] ? horizontalBase(start, end, curveId, pcurveId, budget, a) : verticalBase(start, end, curveId, pcurveId, a);
    if (a.ctx.q.compare(base.error, a.ctx.q.from(budget)) > 0)
        fail('BINDING', 'the base whole-span binding residual exceeds its unchanged budget');
    validateCurve(base.curve);
    validateCurve(base.pcurve);
    if (a.ctx.native) {
        nativeStructure(base.curve, a.ctx);
        nativeStructure(base.pcurve, a.ctx);
        freezeNativeData(base.curve);
        freezeNativeData(base.pcurve);
        Object.freeze(base.error);
    }
    a.ctx.check();
    return base;
}
function outerClone(base, pcurve, a) {
    const controlPoints = [], pcurvePoints = [];
    // diag(2,2,1) is exact for these finite binary64 coefficients; its Euclidean/L1 operator bound is2.
    for (const p of base.controlPoints) {
        const out = raised(p);
        for (const value of out)
            if (!Number.isFinite(value) || Math.abs(value) > CadNumericPolicy.coordinateAbs)
                fail('BINDING', 'the exact outer clone leaves the native range');
        controlPoints.push(out);
    }
    for (const p of pcurve.controlPoints)
        pcurvePoints.push([p[0], p[1], p[2]]);
    const curve = { ...base, id: a.key('curve'), knots: [...base.knots], controlPoints, weights: [...base.weights] };
    const native = { ...pcurve, id: a.key('pcurve'), knots: [...pcurve.knots], controlPoints: pcurvePoints, weights: [...pcurve.weights] };
    validateCurve(curve);
    validateCurve(native);
    if (a.ctx.native) {
        nativeStructure(curve, a.ctx);
        nativeStructure(native, a.ctx);
        freezeNativeData(curve);
        freezeNativeData(native);
    }
    return { curve, pcurve: native };
}
function buildRing(ring, a) {
    const ctx = a.ctx;
    for (const uv of ring.points)
        ring.corners.push({ uv, base: a.key('vertex'), outer: a.key('vertex'), radial: a.key('radial'), point: null, raised: null });
    for (let i = 0; i < ring.points.length; i++) {
        const start = ring.corners[i], end = ring.corners[(i + 1) % ring.corners.length];
        const baseId = a.key('edge'), outerId = a.key('edge'), side = a.key('face');
        const baseBudget = a.tolerance / 16, outerBudget = a.tolerance / 8;
        const base = admittedBase(start, end, baseBudget, a);
        fillCorner(start, base.curve.controlPoints[0]);
        fillCorner(end, base.curve.controlPoints[3]);
        const outer = outerClone(base.curve, base.pcurve, a), outerError = ctx.q.mul(ctx.q.integer(2), base.error);
        if (ctx.q.compare(outerError, ctx.q.from(outerBudget)) > 0)
            fail('BINDING', 'the exact-homothety outer residual exceeds its unchanged budget');
        if (!sameData(outer.curve.controlPoints[0], start.raised) || !sameData(outer.curve.controlPoints[3], end.raised))
            fail('BINDING', 'the outer clone does not retain the shared endpoint table');
        const regularity = guard(base.curve, outer.curve, start.uv, end.uv, ctx), prefix = `c${ring.component}.r${ring.index}.e${i}`;
        a.edges.push({ id: baseId, curve: base.curve, vertices: [start.base, end.base], tolerance: a.tolerance, name: a.name(`base.${prefix}`) }, { id: outerId, curve: outer.curve, vertices: [start.outer, end.outer], tolerance: a.tolerance, name: a.name(`outer.${prefix}`) });
        a.newCurves.set(baseId, base.curve);
        a.newCurves.set(outerId, outer.curve);
        if (a.nativeEvidence)
            a.nativeEvidence.push({ baseId, outerId, sideId: side, start, end, base: base.curve, outer: outer.curve, basePcurve: base.pcurve, outerPcurve: outer.pcurve, baseError: Object.freeze({ ...base.error }), outerError: Object.freeze({ ...outerError }) });
        ring.pieces.push({ base: baseId, outer: outerId, side, basePcurve: base.pcurve, outerPcurve: outer.pcurve });
        a.pieces.push({ component: ring.component, ring: ring.index, index: i, start: [...start.uv], end: [...end.uv], baseEdge: baseId, outerEdge: outerId, sideFace: side,
            binding: { baseError: ctx.q.text(base.error), outerError: ctx.q.text(outerError), baseBudget, outerBudget, baseAuthority: base.authority, outerAuthority: 'exact-diag-2-2-1-of-admitted-base' }, guard: regularity });
        ctx.charge();
    }
    for (const corner of ring.corners) {
        a.vertices.push({ id: corner.base, point: corner.point, tolerance: a.tolerance }, { id: corner.outer, point: corner.raised, tolerance: a.tolerance });
        a.edges.push({ id: corner.radial, curve: lineCurve(a.key('curve'), corner.point, corner.raised), vertices: [corner.base, corner.outer], tolerance: a.tolerance, name: a.name(`radial.c${ring.component}.r${ring.index}.v${a.table.length}`) });
        a.table.push({ uv: [...corner.uv], base: corner.base, outer: corner.outer, radial: corner.radial });
        a.newPoints.set(corner.base, corner.point);
    }
    for (let i = 0; i < ring.pieces.length; i++) {
        const piece = ring.pieces[i], start = ring.corners[i], end = ring.corners[(i + 1) % ring.corners.length];
        const base = a.newCurves.get(piece.base), outer = a.newCurves.get(piece.outer);
        const controlPoints = [], weights = [];
        for (let k = 0; k < 4; k++) {
            controlPoints.push([base.controlPoints[k], outer.controlPoints[k]]);
            weights.push([base.weights[k], base.weights[k]]);
        }
        const surface = { kind: 'surface', id: a.key('surface'), degreeU: 3, degreeV: 1, knotsU: [...base.knots], knotsV: [0, 0, 1, 1], controlPoints, weights };
        validateSurface(surface);
        if (a.nativeEvidence) {
            let evidence;
            for (const item of a.nativeEvidence)
                if (item.sideId === piece.side) {
                    evidence = item;
                    break;
                }
            if (!evidence)
                fail('BINDING', 'a native side has no fresh producer evidence');
            nativeStructure(surface, ctx);
            freezeNativeData(surface);
            evidence.side = surface;
        }
        const loop = a.loop(piece.side, 'outer', [
            { edge: piece.base, sense: 'forward', pcurve: a.pcurve([0, 0, 0], [1, 0, 0]) },
            { edge: end.radial, sense: 'forward', pcurve: a.pcurve([1, 0, 0], [1, 1, 0]) },
            { edge: piece.outer, sense: 'reversed', pcurve: a.pcurve([0, 1, 0], [1, 1, 0]) },
            { edge: start.radial, sense: 'reversed', pcurve: a.pcurve([0, 0, 0], [0, 1, 0]) },
        ]);
        a.faces.push({ id: piece.side, shell: a.source.face.shell, surface, sense: 'forward', loops: [loop], name: a.name(`side.c${ring.component}.r${ring.index}.e${i}`) });
    }
}
function endpointOrder(a) {
    const q = a.ctx.q, checkedRays = new Set();
    // Same-U edges share one exact stored ray; different U values retain strict angular order.
    for (let i = 0; i < a.table.length; i++)
        for (let j = i + 1; j < a.table.length; j++) {
            const left = a.table[i], right = a.table[j], p = a.newPoints.get(left.base), r = a.newPoints.get(right.base);
            a.ctx.charge();
            if (left.uv[0] === right.uv[0]) {
                if (!Object.is(p[0], r[0]) || !Object.is(p[1], r[1]))
                    fail('BINDING', 'equal original U must retain identical stored XY rays');
            }
            else {
                const key = `${Math.min(left.uv[0], right.uv[0])}:${Math.max(left.uv[0], right.uv[0])}`;
                // Every same-U point is still checked bit for bit above. On success each distinct U pair
                // therefore denotes one identical ray pair, independent of its repeated axial positions.
                if (!checkedRays.has(key)) {
                    const cross = q.sub(q.mul(q.from(p[0]), q.from(r[1])), q.mul(q.from(p[1]), q.from(r[0])));
                    if ((cross.n > 0n ? 1 : cross.n < 0n ? -1 : 0) !== Math.sign(right.uv[0] - left.uv[0]))
                        fail('BINDING', 'stored endpoint angular order is unresolved');
                    checkedRays.add(key);
                }
            }
            if (left.uv[1] === right.uv[1] && !Object.is(p[2], r[2]))
                fail('BINDING', 'equal original V must retain identical stored Z');
            if (left.uv[1] !== right.uv[1] && Math.sign(r[2] - p[2]) !== Math.sign(right.uv[1] - left.uv[1]))
                fail('BINDING', 'stored endpoint axial order is unresolved');
        }
}
function protect(original, result, selected, addedLoops, addedFaces) {
    for (const field of ['bodies', 'vertices', 'edges', 'loops', 'coedges'])
        for (let i = 0; i < original[field].length; i++)
            if (!sameData(original[field][i], result[field][i]))
                fail('BINDING', 'a protected original record changed');
    for (let i = 0; i < original.faces.length; i++) {
        const face = original.faces[i], expected = face.id === selected.id ? { ...face, loops: [...face.loops, ...addedLoops] } : face;
        if (!sameData(expected, result.faces[i]))
            fail('BINDING', 'an original face changed outside its permitted appended loops');
    }
    for (let i = 0; i < original.shells.length; i++) {
        const shell = original.shells[i], expected = shell.id === selected.shell ? { ...shell, faces: [...shell.faces, ...addedFaces] } : shell;
        if (!sameData(expected, result.shells[i]))
            fail('BINDING', 'an original shell changed outside its permitted appended faces');
    }
}
/** Private rectilinear UV topology diagnostic. It never qualifies a physical wrapped solid or text. */
function runAssembly(part, input, options, native = false, maximum = MAX_EXACT) {
    const settings = optionsSnapshot(options), source = sourceOf(part, settings);
    if (settings.height !== source.radius)
        fail('SUPPORT', 'only height equal to the actual source radius is supported (exact factor2 homothety)');
    let tolerance = CadNumericPolicy.linearTolerance;
    for (const edge of source.brep.edges)
        tolerance = Math.min(tolerance, edge.tolerance);
    for (const vertex of source.brep.vertices)
        tolerance = Math.min(tolerance, vertex.tolerance);
    if (!(tolerance > 0 && Number.isFinite(tolerance)))
        fail('BINDING', 'a positive unchanged native tolerance budget is required');
    const ctx = new Context(maximum, native);
    ctx.countHelpers(source.carrier.counts.rational.operations);
    ctx.charge(source.carrier.counts.work);
    let protectedSource = source.brep;
    if (native) {
        const c = source.carrier.counts;
        ctx.countHelpers(c.integerOperations);
        ctx.addHelperWork(c.rational.operations + c.rational.gcdSteps + c.rational.floatSearchSteps + c.integerOperations, Math.max(c.rational.maximumObservedBits, c.integerMaximumBits));
        protectedSource = ownSnapshot(source.brep, false, SNAPSHOT);
        nativeStructure(protectedSource, ctx);
        freezeNativeData(protectedSource);
        freezeNativeData(source);
    }
    const components = componentsSnapshot(input, source, tolerance, ctx), assembly = new Assembly(source, settings.id, tolerance, ctx), addedLoops = [];
    let counters = 0;
    for (const component of components) {
        buildRing(component.outer, assembly);
        for (const hole of component.holes) {
            buildRing(hole, assembly);
            counters++;
        }
        addedLoops.push(assembly.loop(source.face.id, 'inner', baseUses(component.outer)));
        const faceId = assembly.key('face'), loops = [assembly.loop(faceId, 'outer', outerUses(component.outer))];
        for (const hole of component.holes)
            loops.push(assembly.loop(faceId, 'inner', outerUses(hole)));
        assembly.faces.push({ id: faceId, shell: source.face.shell, surface: assembly.outer, sense: 'forward', loops, name: assembly.name(`outer.c${component.outer.component}`) });
        for (const hole of component.holes) {
            const island = assembly.key('face'), loop = assembly.loop(island, 'outer', baseUses(hole));
            assembly.faces.push({ id: island, shell: source.face.shell, surface: source.face.surface, sense: source.face.sense, loops: [loop], name: assembly.name(`base.c${hole.component}.h${hole.index}`) });
        }
    }
    endpointOrder(assembly);
    for (const uses of assembly.byEdge.values()) {
        if (uses.length !== 2 || uses[0].sense === uses[1].sense)
            fail('TOPOLOGY', 'every new edge needs exactly two opposite uses');
        uses[0].twin = uses[1].id;
        uses[1].twin = uses[0].id;
    }
    const addedFaces = [];
    for (let i = source.brep.faces.length; i < assembly.faces.length; i++)
        addedFaces.push(assembly.faces[i].id);
    const faces = [];
    for (const face of assembly.faces)
        faces.push(face.id === source.face.id ? { ...face, loops: [...face.loops, ...addedLoops] } : face);
    const shells = [];
    for (const shell of source.brep.shells)
        shells.push(shell.id === source.face.shell ? { ...shell, faces: [...shell.faces, ...addedFaces] } : shell);
    const brep = { ...source.brep, source: { family: 'cylindrical-wrap-assembly', id: settings.id }, faces, shells, loops: assembly.loops, coedges: [...source.brep.coedges, ...assembly.coedges], edges: assembly.edges, vertices: assembly.vertices };
    const n = ctx.edges, c = components.length, original = source.brep;
    const added = { vertices: brep.vertices.length - original.vertices.length, edges: brep.edges.length - original.edges.length, faces: brep.faces.length - original.faces.length, loops: brep.loops.length - original.loops.length, coedges: brep.coedges.length - original.coedges.length, counters };
    if (added.vertices !== 2 * n || added.edges !== 3 * n || added.faces !== n + c + counters || added.loops !== n + 2 * (c + counters) || added.coedges !== 6 * n)
        fail('TOPOLOGY', 'the exact assembly incidence counts disagree');
    protect(protectedSource, brep, source.face, addedLoops, addedFaces);
    for (const edge of assembly.edges)
        validateCurve(edge.curve);
    ctx.charge(300 * brep.faces.length + 16 * brep.coedges.length);
    ctx.check();
    const checked = checkBrep(brep, { strict: true });
    if (!checked.valid || checked.topology.length !== 1 || checked.topology[0].genus !== 0 || brep.bodies.length !== 1 || brep.shells.length !== 1 || !brep.shells[0].closed)
        fail('TOPOLOGY', `the strict diagnostic B-rep failed: ${checked.issues.join('; ')}`);
    const copiedComponents = [];
    for (const component of components) {
        const holes = [];
        for (const hole of component.holes)
            holes.push(hole.points);
        copiedComponents.push({ outer: component.outer.points, holes });
    }
    const publicResult = { brep, check: checked, proof: { diagnosticOnly: true, solidQualified: false, coordinateFrame: 'original-native-uv', factor: 2,
            sourceFace: source.face.id, sourceName: source.face.name ?? null, sourceConsistency: true, historicalProducerProvenance: false, protectedOriginals: true, fullSpanRegularity: true,
            representedVolumeCertified: false, globalEvaluatorErrorCertified: false, generalTextSupported: false, source: source.proof, components: copiedComponents, pieces: assembly.pieces, vertices: assembly.table, added, tolerance,
            counts: { exactOperations: ctx.helperOperations + ctx.q.counts().operations + ctx.integerOperations, helperOperations: ctx.helperOperations, rationalOperations: ctx.q.counts().operations, integerOperations: ctx.integerOperations, integerMaximumBits: ctx.integerMaximumBits, work: ctx.work, horizontalCompositions: assembly.horizontal.size, angularCertificates: ctx.angularGuards.size, verticalCurves: assembly.verticalCurves, outerClones: assembly.pieces.length }, limits: LIMITS } };
    if (native) {
        nativeStructure(assembly.nativeEvidence, ctx);
        freezeNativeData(assembly.nativeEvidence);
        nativeStructure(publicResult, ctx);
        freezeNativeData(publicResult);
    }
    return { publicResult, source, context: ctx, assembly };
}
/** Existing private rectilinear diagnostic. The legacy path keeps its original policy and receipts. */
export function buildCylindricalWrapAssembly(part, input, options) {
    return runAssembly(part, input, options).publicResult;
}
function freezeNativeData(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value))
        return;
    Object.freeze(value);
    for (const child of Object.values(value))
        freezeNativeData(child);
}
function nativeStructure(value, ctx) {
    ctx.charge(4 + (typeof value === 'string' ? value.length : 0));
    if (value && typeof value === 'object')
        for (const child of Object.values(value))
            nativeStructure(child, ctx);
}
function nativeEqual(a, b, ctx) {
    ctx.charge();
    if (Object.is(a, b))
        return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b))
        return false;
    const keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length)
        return false;
    for (const key of keys)
        if (!Object.hasOwn(b, key) || !nativeEqual(a[key], b[key], ctx))
            return false;
    return true;
}
function requireNativeEqual(a, b, ctx) { if (!nativeEqual(a, b, ctx))
    fail('BINDING', 'fresh native evidence differs from the complete installed coefficient fields'); }
function requireNativeLine(curve, start, end, ctx) {
    ctx.charge(2);
    if (curve.kind !== 'curve' || curve.degree !== 1)
        fail('BINDING', 'a canonical native affine line is required');
    requireNativeEqual(curve.knots, [0, 0, 1, 1], ctx);
    requireNativeEqual(curve.weights, [1, 1], ctx);
    requireNativeEqual(curve.controlPoints, [start, end], ctx);
}
function nativePointResidual(actual, target, ctx) {
    if (actual.length !== target.length)
        fail('BINDING', 'native coefficient residual arrays differ in length');
    const q = ctx.q;
    let maximum = q.integer(0);
    for (let i = 0; i < actual.length; i++) {
        ctx.charge();
        let total = q.integer(0);
        for (let axis = 0; axis < 3; axis++) {
            ctx.charge();
            // Both coefficient arrays were already admitted from the frozen actual native family.
            if (Object.is(actual[i][axis], target[i][axis]))
                continue;
            total = q.add(total, q.abs(q.sub(q.from(actual[i][axis]), q.from(target[i][axis]))));
        }
        maximum = q.max(maximum, total);
        ctx.check();
    }
    return maximum;
}
function nativeWallResidual(world, pc, surface, ctx) {
    if (surface.degreeU !== 2 || surface.degreeV !== 1 || surface.controlPoints.length !== 5)
        fail('BINDING', 'the original wall must retain its actual two quadratic half-spans');
    requireNativeEqual(surface.knotsU, [0, 0, 0, 0.5, 0.5, 1, 1, 1], ctx);
    requireNativeEqual(surface.knotsV, [0, 0, 1, 1], ctx);
    for (const row of surface.weights)
        requireNativeEqual(row, [row[0], row[0]], ctx);
    if (world.degree === 2 && world.controlPoints.length === 5) {
        const v = pc.controlPoints[0][1];
        if (!Object.is(v, 0) && !Object.is(v, 1))
            fail('BINDING', 'a source horizontal edge requires an exact boundary V');
        requireNativeLine(pc, [0, v, 0], [1, v, 0], ctx);
        requireNativeEqual(world.knots, surface.knotsU, ctx);
        const target = [], weights = [];
        for (let i = 0; i < 5; i++) {
            target.push(surface.controlPoints[i][v]);
            weights.push(surface.weights[i][v]);
        }
        requireNativeEqual(world.weights, weights, ctx);
        return nativePointResidual(world.controlPoints, target, ctx);
    }
    if (world.degree === 1 && world.controlPoints.length === 2) {
        const u = pc.controlPoints[0][0];
        if (!Object.is(u, 0) && !Object.is(u, 1))
            fail('BINDING', 'a source strut requires an exact boundary U');
        requireNativeLine(pc, [u, 0, 0], [u, 1, 0], ctx);
        requireNativeEqual(world.knots, [0, 0, 1, 1], ctx);
        requireNativeEqual(world.weights, [1, 1], ctx);
        return nativePointResidual(world.controlPoints, surface.controlPoints[u === 0 ? 0 : 4], ctx);
    }
    return fail('BINDING', 'an original wall use has no admitted isocurve classification');
}
function nativeMaps(run) {
    const ctx = run.context, originalEdges = new Map(), originalFaces = new Map(), bases = new Map(), outers = new Map(), sides = new Map();
    for (const edge of run.source.brep.edges) {
        ctx.charge();
        originalEdges.set(edge.id, edge);
    }
    for (const face of run.source.brep.faces) {
        ctx.charge();
        originalFaces.set(face.id, face);
    }
    for (const piece of run.assembly.nativeEvidence ?? []) {
        ctx.charge();
        bases.set(piece.baseId, piece);
        outers.set(piece.outerId, piece);
        sides.set(piece.sideId, piece);
    }
    return { originalEdges, originalFaces, bases, outers, sides };
}
function nativeModel(coedge, edge, face, run, maps) {
    const ctx = run.context, surface = face.surface;
    if (!coedge.pcurve || surface.kind === 'facets')
        fail('BINDING', 'every native position use needs its actual NURBS pcurve and Surface');
    const pc = coedge.pcurve, sourceEdge = maps.originalEdges.get(edge.id), sourceFace = maps.originalFaces.get(face.id);
    if (sourceEdge) {
        requireNativeEqual(edge, sourceEdge, ctx);
        if (!sourceFace || sourceFace.surface.kind === 'facets')
            fail('BINDING', 'an original edge has an unexpected retained face');
        requireNativeEqual(surface, sourceFace.surface, ctx);
        if (surface.degreeU === 1 && surface.degreeV === 1)
            return { kind: 'cap', error: nativeAffineCapResidual(edge.curve, pc, surface, ctx) };
        return { kind: 'wall', error: nativeWallResidual(edge.curve, pc, surface, ctx) };
    }
    const side = maps.sides.get(face.id);
    if (side) {
        if (!side.side)
            fail('BINDING', 'an actual side Surface is missing from fresh evidence');
        requireNativeEqual(surface, side.side, ctx);
        if (edge.id === side.baseId) {
            requireNativeEqual(edge.curve, side.base, ctx);
            requireNativeLine(pc, [0, 0, 0], [1, 0, 0], ctx);
            for (let i = 0; i < 4; i++) {
                requireNativeEqual(surface.controlPoints[i][0], side.base.controlPoints[i], ctx);
                requireNativeEqual(surface.weights[i][0], side.base.weights[i], ctx);
            }
            return { kind: 'side', error: ctx.q.integer(0) };
        }
        if (edge.id === side.outerId) {
            requireNativeEqual(edge.curve, side.outer, ctx);
            requireNativeLine(pc, [0, 1, 0], [1, 1, 0], ctx);
            for (let i = 0; i < 4; i++) {
                requireNativeEqual(surface.controlPoints[i][1], side.outer.controlPoints[i], ctx);
                requireNativeEqual(surface.weights[i][1], side.outer.weights[i], ctx);
            }
            return { kind: 'side', error: ctx.q.integer(0) };
        }
        const at = edge.id === side.start.radial ? 0 : edge.id === side.end.radial ? 1 : -1;
        if (at < 0)
            fail('BINDING', 'an actual side use has no prescribed boundary edge');
        requireNativeLine(pc, [at, 0, 0], [at, 1, 0], ctx);
        if (edge.curve.degree !== 1)
            fail('BINDING', 'a native radial edge must remain affine');
        requireNativeEqual(edge.curve.knots, [0, 0, 1, 1], ctx);
        requireNativeEqual(edge.curve.weights, [1, 1], ctx);
        const row = at === 0 ? 0 : 3;
        requireNativeEqual(surface.weights[row], [surface.weights[row][0], surface.weights[row][0]], ctx);
        return { kind: 'side', error: nativePointResidual(edge.curve.controlPoints, surface.controlPoints[row], ctx) };
    }
    const base = maps.bases.get(edge.id);
    if (base && face.id === run.source.face.id) {
        requireNativeEqual(edge.curve, base.base, ctx);
        requireNativeEqual(pc, base.basePcurve, ctx);
        requireNativeEqual(surface, run.source.face.surface, ctx);
        if (surface.kind !== 'surface' || surface.controlPoints.length !== 5)
            fail('BINDING', 'the retained original wall is missing');
        requireNativeEqual(surface.knotsU, [0, 0, 0, 0.5, 0.5, 1, 1, 1], ctx);
        requireNativeEqual(run.source.quarter.knotsU, [0, 0, 0, 0.5, 0.5, 0.5], ctx);
        requireNativeEqual(surface.controlPoints.slice(0, 3), run.source.quarter.controlPoints, ctx);
        requireNativeEqual(surface.weights.slice(0, 3), run.source.quarter.weights, ctx);
        requireNativeEqual(surface.knotsV, run.source.quarter.knotsV, ctx);
        return { kind: 'base', error: base.baseError };
    }
    const outer = maps.outers.get(edge.id);
    if (outer) {
        requireNativeEqual(edge.curve, outer.outer, ctx);
        requireNativeEqual(pc, outer.outerPcurve, ctx);
        requireNativeEqual(surface, run.assembly.outer, ctx);
        return { kind: 'outer', error: outer.outerError };
    }
    return fail('BINDING', 'an actual coedge is outside the fixed native position classifier');
}
function nativeOptions(input) {
    const data = ownSnapshot(input, false, SNAPSHOT);
    if (!data || typeof data !== 'object' || Array.isArray(data))
        fail('INPUT', 'plain native assembly options are required');
    const fields = data;
    for (const key of Object.keys(fields))
        if (key !== 'id' && key !== 'height' && key !== 'maxOperations')
            fail('INPUT', 'unsupported native assembly option');
    const maximum = fields.maxOperations === undefined ? MAX_EXACT : fields.maxOperations;
    if (typeof maximum !== 'number' || !Number.isSafeInteger(maximum) || maximum < 1 || maximum > MAX_EXACT)
        fail('INPUT', 'the native request operation limit may only tighten200000');
    return { options: optionsSnapshot({ id: fields.id, height: fields.height }), maximum };
}
function onePad(input) {
    const data = ownSnapshot(input, false, SNAPSHOT);
    if (!Array.isArray(data) || data.length !== 1)
        fail('SUPPORT', 'native binding admits exactly one four-edge pad');
    const value = record(data[0], ['outer', 'holes']);
    if (!Array.isArray(value.outer) || value.outer.length !== 4 || !Array.isArray(value.holes) || value.holes.length !== 0)
        fail('SUPPORT', 'native binding admits four outer edges and no holes');
    return data;
}
function nativeSidePhase(run) {
    const ctx = run.context, evidence = run.assembly.nativeEvidence;
    if (!evidence || evidence.length !== 4)
        fail('BINDING', 'four fresh side operands are required');
    const curves = [], uses = [], pieces = [], hint = [0, 0, 0];
    for (const piece of evidence) {
        if (!piece.side)
            fail('BINDING', 'a fresh radial side is missing');
        curves.push(piece.base);
        uses.push({ curve: piece.base.id, sense: 'forward' });
        pieces.push({ base: piece.base, outer: piece.outer, side: piece.side });
        for (let axis = 0; axis < 3; axis++)
            hint[axis] += piece.base.controlPoints[0][axis] / 4;
        ctx.charge(6);
    }
    // Only a candidate. Exact D300 winding establishes its individual-ring interior role.
    const component = certifyCylindricalWrapChartComponent({ curves, outer: { uses, interiorHint: hint }, holes: [] }, { maxOperations: ctx.remaining() });
    const result = certifyCylindricalWrapSideFamily(component, pieces), counts = result.counts;
    ctx.importHelper(counts.totalOperations, counts.work + counts.rational.operations + counts.rational.gcdSteps + counts.rational.floatSearchSteps, Math.max(counts.maximumDirectBits, counts.rational.maximumObservedBits));
    for (let i = 0; i < pieces.length; i++)
        requireNativeEqual(result.original[i], pieces[i], ctx);
    return result;
}
function nativeFamilyPhase(run) {
    const ctx = run.context, brep = run.publicResult.brep, curves = [], surfaces = [];
    for (const edge of brep.edges) {
        ctx.charge();
        curves.push(edge.curve);
    }
    for (const coedge of brep.coedges) {
        ctx.charge();
        if (!coedge.pcurve)
            fail('BINDING', 'every actual coedge needs its native pcurve slot');
        curves.push(coedge.pcurve);
    }
    for (const face of brep.faces) {
        ctx.charge();
        if (face.surface.kind === 'facets')
            fail('SUPPORT', 'native binding admits only actual NURBS faces');
        surfaces.push(face.surface);
    }
    if (curves.length !== 54 || surfaces.length !== 9)
        fail('BINDING', 'the actual one-pad family must contain all63 geometry slots');
    const result = certifyNativeD0Family({ curves, surfaces }, { maxOperations: ctx.remaining() }), counts = result.counts;
    ctx.importHelper(counts.totalOperations, counts.work, Math.max(counts.maximumDirectBits, counts.maximumObservedBits));
    for (let i = 0; i < curves.length; i++)
        requireNativeEqual(result.curves[i].source, curves[i], ctx);
    for (let i = 0; i < surfaces.length; i++)
        requireNativeEqual(result.surfaces[i].source, surfaces[i], ctx);
    return result;
}
function finishNativeAssembly(run, assemblyCounts) {
    const ctx = run.context, brep = run.publicResult.brep;
    if (brep.edges.length !== 18 || brep.coedges.length !== 36 || brep.faces.length !== 9 || brep.vertices.length !== 12)
        fail('BINDING', 'the actual native topology is outside the fixed one-pad profile');
    const sideFamily = nativeSidePhase(run), evaluator = nativeFamilyPhase(run), eL1 = fraction(evaluator.l1.exact, ctx.q), eU = fraction(evaluator.axes[0].exact, ctx.q), eV = fraction(evaluator.axes[1].exact, ctx.q);
    ctx.check();
    const edges = new Map(), loops = new Map(), vertices = new Map();
    const faces = new Map(), faceBounds = [];
    for (let i = 0; i < brep.edges.length; i++) {
        ctx.charge();
        edges.set(brep.edges[i].id, { value: brep.edges[i], index: i });
    }
    for (const loop of brep.loops) {
        ctx.charge();
        loops.set(loop.id, loop);
    }
    for (const vertex of brep.vertices) {
        ctx.charge();
        vertices.set(vertex.id, vertex);
    }
    for (let i = 0; i < brep.faces.length; i++) {
        const value = brep.faces[i];
        if (value.surface.kind === 'facets')
            fail('BINDING', 'a native face changed its surface kind');
        const proof = prepareNativePositionFace(value.surface, ctx);
        requireNativeEqual(proof.surface, value.surface, ctx);
        const inflation = nativePositionInflation(proof, eL1, eU, eV, ctx);
        faces.set(value.id, { value, index: i, proof, inflation });
        faceBounds.push({ face: value.id, lipschitz: { u: ctx.q.text(proof.lipschitz.u), v: ctx.q.text(proof.lipschitz.v) }, inflation: ctx.q.text(inflation) });
        ctx.check();
    }
    const models = nativeMaps(run), coedges = [], classes = { wall: 0, cap: 0, base: 0, outer: 0, side: 0 }, seen = new Set();
    for (let i = 0; i < brep.coedges.length; i++) {
        const coedge = brep.coedges[i], edge = edges.get(coedge.edge), loop = loops.get(coedge.loop), face = loop && faces.get(loop.face);
        ctx.charge();
        if (!edge || !loop || !face || !coedge.pcurve || seen.has(coedge.id))
            fail('BINDING', 'every native coedge must have exactly one actual owner relation');
        seen.add(coedge.id);
        const pc = coedge.pcurve, curve = edge.value.curve;
        requireNativeEqual([pc.knots[pc.degree], pc.knots[pc.controlPoints.length]], [curve.knots[curve.degree], curve.knots[curve.controlPoints.length]], ctx);
        requireNativeEqual([curve.knots[curve.degree], curve.knots[curve.controlPoints.length]], [0, 1], ctx);
        requireNativePcurveRange(pc, face.proof, eU, eV, ctx);
        const model = nativeModel(coedge, edge.value, face.value, run, models), bound = checkedNativePositionBound(model.error, face.inflation, edge.value.tolerance, ctx);
        classes[model.kind]++;
        coedges.push({ coedge: coedge.id, edge: edge.value.id, face: face.value.id, curveSlot: edge.index, pcurveSlot: brep.edges.length + i, surfaceSlot: face.index, kind: model.kind,
            modelError: ctx.q.text(model.error), bound: ctx.q.text(bound), tolerance: edge.value.tolerance });
        ctx.check();
    }
    requireNativeEqual(classes, { wall: 8, cap: 4, base: 4, outer: 4, side: 16 }, ctx);
    const endpoints = [];
    for (const edge of brep.edges)
        for (const at of [0, 1]) {
            ctx.charge();
            const vertex = vertices.get(edge.vertices[at]);
            if (!vertex)
                fail('BINDING', 'a native edge endpoint has no actual vertex');
            const pole = edge.curve.controlPoints[at === 0 ? 0 : edge.curve.controlPoints.length - 1];
            const bound = nativeEndpointPositionBound(pole, vertex.point, eL1, vertex.tolerance, ctx);
            endpoints.push({ edge: edge.id, endpoint: at, vertex: vertex.id, bound: ctx.q.text(bound), tolerance: vertex.tolerance });
            ctx.check();
        }
    if (coedges.length !== 36 || endpoints.length !== 36)
        fail('BINDING', 'complete native coedge and endpoint coverage is required');
    const result = { assembly: run.publicResult, nativeBinding: {
            coverage: { edges: 18, coedges: 36, vertices: 12, endpointRelations: 36, familySlots: 63, complete: true, classes }, coedges, endpoints, faces: faceBounds, evaluator, sideFamily,
            phases: { assembly: assemblyCounts, side: { exactOperations: sideFamily.counts.totalOperations, work: sideFamily.counts.work + sideFamily.counts.rational.operations + sideFamily.counts.rational.gcdSteps + sideFamily.counts.rational.floatSearchSteps }, evaluator: { exactOperations: evaluator.counts.totalOperations, work: evaluator.counts.work } },
            counts: ctx.counts(), limits: { exactOperations: ctx.maximum, hardExactOperations: 200000, integerBits: 8192, work: 1048576, components: 1, edges: 4, holes: 0 },
            meaning: { nativePositionBindingCertified: true, allCoedgesCertified: true, allEdgeEndpointsCertified: true, vertexToleranceRule: 'actual-vertex-tolerance-stronger-than-checker-max', distance: 'exact-L1-between-native-position-outputs',
                uvRule: 'actual-rounded-slack-and-nonexpansive-clamp', sourceGlobalCertified: false, closedReferenceCertified: false, retainedFaceClosureCertified: false, mathHypotCertified: false, orientationCertified: false,
                physicalBrepCertified: false, solidQualified: false, representedVolumeCertified: false, generalTextSupported: false, productFeature: false, surfaceEndpointVertexBindingCertified: false }
        } };
    freezeNativeData(result);
    return result;
}
/** Fresh fixed-profile native position proof. No external receipt or flags are accepted as authority. */
export function buildCylindricalWrapNativeBoundAssembly(part, input, options) {
    try {
        const selected = nativeOptions(options), components = onePad(input), run = runAssembly(part, components, selected.options, true, selected.maximum);
        return finishNativeAssembly(run, run.context.counts());
    }
    catch (error) {
        if (isCylindricalWrapAssemblyError(error))
            throw error;
        if (isNativeD0Error(error) || isNativePositionError(error) || isCylindricalWrapChartError(error))
            fail(error.code === 'BUDGET' ? 'BUDGET' : 'BINDING', error.message);
        return fail('INPUT', 'the native position request could not be admitted');
    }
}
/** Private fresh-source entry for synchronous continuations; no supplied receipt is accepted. */
export function buildCylindricalWrapNativeSourceAssembly(part, input, options) {
    try {
        const selected = nativeOptions(options), components = onePad(input), run = runAssembly(part, components, selected.options, true, selected.maximum);
        const native = finishNativeAssembly(run, run.context.counts());
        return Object.freeze({ native, source: run.source });
    }
    catch (error) {
        if (isCylindricalWrapAssemblyError(error))
            throw error;
        if (isNativeD0Error(error) || isNativePositionError(error) || isCylindricalWrapChartError(error))
            fail(error.code === 'BUDGET' ? 'BUDGET' : 'BINDING', error.message);
        return fail('INPUT', 'the native position request could not be admitted');
    }
}

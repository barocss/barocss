export const STRICT_LINE_LIMITS = Object.freeze({ rationalOperations: 200000, integerOperations: 2000000,
    integerBits: 16384, roundingSteps: 16 });
export class StrictLineFailure extends Error {
    constructor(message) { super(message); this.name = 'StrictLineFailure'; }
}
const ZERO = { n: 0n, d: 1n };
const ieee = new DataView(new ArrayBuffer(8));
/** One ULP, preserving an already equal value (including its original zero sign). */
export function nextAfterToward(value, target) {
    if (!Number.isFinite(value) || !Number.isFinite(target))
        throw new StrictLineFailure('nonfinite nextafter');
    if (value === target)
        return value;
    if (value === 0)
        return target > 0 ? Number.MIN_VALUE : -Number.MIN_VALUE;
    ieee.setFloat64(0, value, false);
    let bits = ieee.getBigUint64(0, false);
    bits += (target > value) === (value > 0) ? 1n : -1n;
    ieee.setBigUint64(0, bits, false);
    const result = ieee.getFloat64(0, false);
    if (!Number.isFinite(result))
        throw new StrictLineFailure('nextafter overflow');
    return result;
}
class Arithmetic {
    counters = { rationalOperations: 0, integerOperations: 0, peakIntegerBits: 0 };
    tick(amount = 1) {
        this.counters.integerOperations += amount;
        if (this.counters.integerOperations > STRICT_LINE_LIMITS.integerOperations)
            throw new StrictLineFailure('integer work limit');
    }
    op() {
        if (++this.counters.rationalOperations > STRICT_LINE_LIMITS.rationalOperations)
            throw new StrictLineFailure('rational work limit');
    }
    checked(value) {
        const bits = (value < 0n ? -value : value).toString(2).length;
        this.counters.peakIntegerBits = Math.max(this.counters.peakIntegerBits, bits);
        if (bits > STRICT_LINE_LIMITS.integerBits)
            throw new StrictLineFailure('integer bit limit');
        return value;
    }
    multiply(a, b) { this.tick(); return this.checked(a * b); }
    sum(a, b) { this.tick(); return this.checked(a + b); }
    shifted(value, bits) { this.tick(); return this.checked(value << BigInt(bits)); }
    make(n, d = 1n) {
        this.checked(n);
        this.checked(d);
        if (d === 0n)
            throw new StrictLineFailure('zero rational denominator');
        if (n === 0n)
            return ZERO;
        if (d < 0n) {
            this.tick(2);
            n = -n;
            d = -d;
        }
        let a = n < 0n ? -n : n, b = d;
        while (b !== 0n) {
            this.tick();
            const remainder = a % b;
            a = b;
            b = remainder;
        }
        this.tick(2);
        return { n: n / a, d: d / a };
    }
    from(value) {
        this.op();
        if (!Number.isFinite(value))
            throw new StrictLineFailure('nonfinite exact operand');
        ieee.setFloat64(0, value, false);
        const bits = ieee.getBigUint64(0, false), negative = (bits >> 63n) !== 0n;
        const exponent = Number((bits >> 52n) & 2047n), fraction = bits & ((1n << 52n) - 1n);
        const significand = exponent === 0 ? fraction : fraction + (1n << 52n);
        const power = exponent === 0 ? -1074 : exponent - 1023 - 52;
        const n = negative ? -significand : significand;
        return power >= 0 ? this.make(this.shifted(n, power)) : this.make(n, this.shifted(1n, -power));
    }
    add(a, b) {
        this.op();
        return this.make(this.sum(this.multiply(a.n, b.d), this.multiply(b.n, a.d)), this.multiply(a.d, b.d));
    }
    neg(a) { this.op(); this.tick(); return { n: -a.n, d: a.d }; }
    sub(a, b) { return this.add(a, this.neg(b)); }
    mul(a, b) { this.op(); return this.make(this.multiply(a.n, b.n), this.multiply(a.d, b.d)); }
    div(a, b) { this.op(); return this.make(this.multiply(a.n, b.d), this.multiply(a.d, b.n)); }
    compare(a, b) {
        this.op();
        const difference = this.sum(this.multiply(a.n, b.d), -this.multiply(b.n, a.d));
        return difference < 0n ? -1 : difference > 0n ? 1 : 0;
    }
    abs(a) { return a.n < 0n ? this.neg(a) : a; }
    vec(value, length = 3) {
        if (value.length !== length || !Array.from({ length }, (_, i) => i).every(i => Object.hasOwn(value, i)))
            throw new StrictLineFailure('dense exact vector required');
        return value.map(x => this.from(x));
    }
    dot(a, b) { return a.reduce((value, x, i) => this.add(value, this.mul(x, b[i])), ZERO); }
    /** Correct nearest-even conversion, including subnormals; no Number(BigInt)/Number(BigInt). */
    number(value) {
        this.op();
        if (value.n === 0n)
            return 0;
        const negative = value.n < 0n, n = negative ? -value.n : value.n, d = value.d;
        let exponent = n.toString(2).length - d.toString(2).length;
        if (exponent >= 0 ? n < this.shifted(d, exponent) : this.shifted(n, -exponent) < d)
            exponent--;
        const unit = Math.max(-1074, exponent - 52);
        const numerator = unit < 0 ? this.shifted(n, -unit) : n;
        const denominator = unit > 0 ? this.shifted(d, unit) : d;
        this.tick(2);
        let quotient = numerator / denominator;
        const remainder = numerator % denominator;
        const twice = this.shifted(remainder, 1);
        if (twice > denominator || twice === denominator && (quotient & 1n) !== 0n) {
            this.tick();
            quotient++;
        }
        const result = Number(quotient) * Math.pow(2, unit);
        if (!Number.isFinite(result))
            throw new StrictLineFailure('rounded witness overflow');
        return negative ? -result : result;
    }
}
/** Exact normalized quaternion OBB context, shared only within one face call. */
export class StrictLineContext {
    m = new Arithmetic();
    boxes;
    normal;
    tolerance;
    normalSquared;
    fourToleranceSquared;
    constructor(a, b, normal) {
        this.normal = this.m.vec(normal);
        if (this.normal.every(x => x.n === 0n))
            throw new StrictLineFailure('zero line direction');
        this.tolerance = this.m.from(1e-12);
        this.normalSquared = this.m.dot(this.normal, this.normal);
        this.fourToleranceSquared = this.m.mul(this.m.from(4), this.m.mul(this.tolerance, this.tolerance));
        this.boxes = [this.box(a), this.box(b)];
    }
    stats() { return { ...this.m.counters }; }
    box(body) {
        if (body.shape.kind !== 'box')
            throw new StrictLineFailure('box required');
        const m = this.m, [x, y, z, w] = m.vec(body.orientation, 4), norm2 = m.dot([x, y, z, w], [x, y, z, w]);
        if (norm2.n === 0n)
            throw new StrictLineFailure('zero quaternion');
        const two = m.from(2), square = (q) => m.mul(q, q);
        const twice = (a, b) => m.mul(two, m.mul(a, b));
        const diagonal = (a, b) => m.div(m.sub(norm2, m.mul(two, m.add(square(a), square(b)))), norm2);
        const entry = (a, b, c, d, sign) => m.div(sign === 1 ? m.add(twice(a, b), twice(c, d)) : m.sub(twice(a, b), twice(c, d)), norm2);
        const rotation = [[diagonal(y, z), entry(x, y, z, w, -1), entry(x, z, y, w, 1)],
            [entry(x, y, z, w, 1), diagonal(x, z), entry(y, z, x, w, -1)],
            [entry(x, z, y, w, -1), entry(y, z, x, w, 1), diagonal(x, y)]];
        const extent = m.vec(body.shape.halfExtentsM);
        if (extent.some(value => value.n <= 0n))
            throw new StrictLineFailure('positive extents required');
        return { centre: m.vec(body.positionM), extent, rotation };
    }
    local(box, world, direction = false) {
        const relative = direction ? world : world.map((value, i) => this.m.sub(value, box.centre[i]));
        return [0, 1, 2].map(axis => this.m.dot(box.rotation.map(row => row[axis]), relative));
    }
    interval(box, p) {
        const m = this.m, u = this.local(box, p), d = this.local(box, this.normal, true);
        let low = null, high = null;
        for (let i = 0; i < 3; i++) {
            if (d[i].n === 0n) {
                if (m.compare(m.abs(u[i]), box.extent[i]) > 0)
                    return null;
                continue;
            }
            const first = m.div(m.sub(m.neg(box.extent[i]), u[i]), d[i]), second = m.div(m.sub(box.extent[i], u[i]), d[i]);
            const lower = m.compare(first, second) <= 0 ? first : second, upper = lower === first ? second : first;
            if (low === null || m.compare(lower, low) > 0)
                low = lower;
            if (high === null || m.compare(upper, high) < 0)
                high = upper;
            if (low !== null && high !== null && m.compare(low, high) > 0)
                return null;
        }
        if (low === null || high === null)
            throw new StrictLineFailure('unbounded box line interval');
        return { low, high };
    }
    /** Strict closed slabs and the actual A-exit/B-entry surface midpoint. */
    check(midpoint) {
        const m = this.m, p = m.vec(midpoint), a = this.interval(this.boxes[0], p);
        if (a === null)
            return false;
        const b = this.interval(this.boxes[1], p);
        if (b === null)
            return false;
        // The line is p+t*n. Its true surface-pair midpoint is
        // p+(a.high+b.low)*n/2, not the midpoint of two arbitrary face projections.
        const twiceOffset = m.add(a.high, b.low);
        const fourDistanceSquared = m.mul(m.mul(twiceOffset, twiceOffset), this.normalSquared);
        return m.compare(fourDistanceSquared, this.fourToleranceSquared) <= 0;
    }
    faceIsBoundary(box, p, plane, bound, exit) {
        if (!Number.isInteger(plane.axis) || plane.axis < 0 || plane.axis > 2 || Math.abs(plane.side) !== 1)
            throw new StrictLineFailure('face selector');
        const m = this.m, u = this.local(box, p), d = this.local(box, this.normal, true), axis = plane.axis;
        if (d[axis].n === 0n)
            return false;
        const side = m.from(plane.side), outwardDirection = m.mul(side, d[axis]);
        if (m.compare(outwardDirection, ZERO) !== (exit ? 1 : -1))
            return false;
        const parameter = m.div(m.sub(m.mul(side, box.extent[axis]), u[axis]), d[axis]);
        return m.compare(parameter, bound) === 0;
    }
    /** Named faces must be actual line bounds; closed edge/corner ties remain valid. */
    selectedFaceBounds(midpoint, faceA, faceB) {
        const p = this.m.vec(midpoint), a = this.interval(this.boxes[0], p);
        if (a === null)
            return false;
        const b = this.interval(this.boxes[1], p);
        return b !== null && this.faceIsBoundary(this.boxes[0], p, faceA, a.high, true)
            && this.faceIsBoundary(this.boxes[1], p, faceB, b.low, false);
    }
    onFace(which, plane, witness) {
        const m = this.m, box = this.boxes[which], local = this.local(box, m.vec(witness));
        if (!Number.isInteger(plane.axis) || plane.axis < 0 || plane.axis > 2 || Math.abs(plane.side) !== 1)
            throw new StrictLineFailure('face selector');
        if (local.some((value, i) => m.compare(m.sub(m.abs(value), box.extent[i]), this.tolerance) > 0))
            return false;
        return m.compare(m.abs(m.sub(local[plane.axis], m.mul(m.from(plane.side), box.extent[plane.axis]))), this.tolerance) <= 0;
    }
    movementWithin(original, moved) {
        const m = this.m, a = m.vec(original), b = m.vec(moved), delta = a.map((value, i) => m.sub(b[i], value));
        return m.compare(m.dot(delta, delta), m.mul(this.tolerance, this.tolerance)) <= 0;
    }
    projectedPair(seed, faceA, faceB) {
        const m = this.m, p = m.vec(seed);
        return [faceA, faceB].map((face, which) => {
            if (!Number.isInteger(face.axis) || face.axis < 0 || face.axis > 2 || Math.abs(face.side) !== 1)
                throw new StrictLineFailure('face selector');
            const box = this.boxes[which], u = this.local(box, p), d = this.local(box, this.normal, true), axis = face.axis;
            if (d[axis].n === 0n)
                throw new StrictLineFailure('line parallel to selected face');
            const t = m.div(m.sub(m.mul(m.from(face.side), box.extent[axis]), u[axis]), d[axis]);
            return p.map((value, i) => m.number(m.add(value, m.mul(this.normal[i], t))));
        });
    }
}

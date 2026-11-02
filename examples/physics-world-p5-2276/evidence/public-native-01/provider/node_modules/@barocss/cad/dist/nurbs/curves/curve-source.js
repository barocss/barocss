import { compileCadModel } from '../../model-compiler.js';
import { validateCurve } from '../../core/math.js';
export function requireCurveValue(condition, detail, label = 'XY profile') {
    if (!condition)
        throw new Error(label + ': ' + detail);
}
export function snapshotCurveRequest(input, label = 'XY profile') {
    function check(condition, detail) { requireCurveValue(condition, detail, label); }
    let remaining = 1024;
    const copy = (value, depth) => {
        check(--remaining >= 0 && depth <= 4, 'input exceeds own-value/depth budget');
        if (typeof value === 'number') {
            check(Number.isFinite(value), 'finite numeric data required');
            return value;
        }
        if (typeof value === 'string') {
            check(value.length <= 128, 'string exceeds 128 characters');
            return value;
        }
        check(value !== null && typeof value === 'object', 'plain numeric/string/record data required');
        const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
        check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, 'foreign prototype is unsupported');
        const keys = Reflect.ownKeys(value), descriptors = Object.getOwnPropertyDescriptors(value);
        check(keys.length <= (array ? 65 : 5), 'input record/array exceeds field bound');
        check(keys.every(key => typeof key === 'string' && 'value' in descriptors[key] && (array && key === 'length' || descriptors[key].enumerable === true)), 'getters, symbols or nonenumerable fields are unsupported');
        if (array) {
            const length = descriptors.length.value;
            check(Number.isInteger(length) && length <= 64 && keys.length === length + 1, 'dense bounded arrays required');
            const result = [];
            for (let i = 0; i < length; i++) {
                check(Object.hasOwn(descriptors, String(i)), 'sparse or foreign array fields are unsupported');
                result.push(copy(descriptors[String(i)].value, depth + 1));
            }
            return result;
        }
        return Object.fromEntries(keys.map(key => [key, copy(descriptors[key].value, depth + 1)]));
    };
    return copy(input, 0);
}
/** Expand the shortest round-trippable binary64 spelling into current decimals. */
export function curveDecimal(value, label = 'XY profile') {
    function check(condition, detail) { requireCurveValue(condition, detail, label); }
    check(Number.isFinite(value), 'finite source literal required');
    if (Object.is(value, -0))
        return '-0';
    const text = String(value);
    if (!/[eE]/.test(text))
        return text;
    const negative = text.startsWith('-'), unsigned = negative ? text.slice(1) : text;
    const [coefficient, exponent] = unsigned.split(/[eE]/), pieces = coefficient.split('.');
    const digits = pieces.join(''), position = pieces[0].length + Number(exponent);
    check(digits.length <= 17 && Number.isInteger(position) && position >= -324 && position <= 309, 'bounded decimal expansion required');
    const expanded = position <= 0 ? '0.' + '0'.repeat(-position) + digits
        : position >= digits.length ? digits + '0'.repeat(position - digits.length)
            : digits.slice(0, position) + '.' + digits.slice(position);
    const result = (negative ? '-' : '') + expanded;
    check(result.length <= 350 && Object.is(Number(result), value), 'source literal must round-trip binary64');
    return result;
}
function sameNumbers(actual, expected) {
    return actual.length === expected.length && actual.every((n, i) => Object.is(n, expected[i]));
}
/** Internal trusted family coefficients adopted only from actual source0. */
export function compileCurveSource(id, degree, controlPoints, knots, weights, label = 'XY profile') {
    function check(condition, detail) { requireCurveValue(condition, detail, label); }
    check(typeof id === 'string' && id.length <= 128 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(id), 'supported ASCII ID within 128 characters required');
    check(controlPoints.length >= 2 && controlPoints.length <= 64 && knots.length <= 70 && weights.length === controlPoints.length, 'bounded native coefficients required');
    const decimal = (value) => curveDecimal(value, label);
    const source = '@model profile { version:0; length-unit:mm; @curve #' + id + ' { type:nurbs; degree:' + decimal(degree) + '; knots:[' + knots.map(decimal).join(',') + ']; control-points:[' + controlPoints.map(point => '[' + point.map(decimal).join(',') + ']').join(',') + ']; weights:[' + weights.map(decimal).join(',') + ']; } }\n';
    check(source.length <= 262144, 'generated source exceeds compiler byte bound');
    const compiled = compileCadModel(source, { sourceVersion: 0 });
    check(compiled.ok, 'generated source must compile through the actual source0 compiler');
    check(compiled.model.objects.length === 1 && compiled.model.objects[0].kind === 'curve', 'one actual compiled curve required');
    const curve = compiled.model.objects[0];
    validateCurve(curve);
    check(curve.id === id && curve.degree === degree && sameNumbers(curve.knots, knots) && sameNumbers(curve.weights, weights)
        && curve.controlPoints.length === controlPoints.length && curve.controlPoints.every((point, i) => sameNumbers(point, controlPoints[i])), 'compiled source must preserve exact native values/order/identity');
    return { source, model: compiled.model, curve };
}

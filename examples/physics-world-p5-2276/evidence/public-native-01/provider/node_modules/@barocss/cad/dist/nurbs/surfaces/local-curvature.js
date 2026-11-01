import { evaluateCurveD2, evaluateSurfaceD2 } from '../../core/second-derivatives.js';
import { KernelError } from '../../core/barocss-error.js';
export const NativeCurvatureDiagnosticCode = Object.freeze({
    DERIVATIVE: 'DERIVATIVE', REGULARITY: 'REGULARITY', ARITHMETIC: 'ARITHMETIC',
});
export class NativeCurvatureError extends KernelError {
    code;
    constructor(code, detail, cause) {
        super(('Native curvature: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
        this.name = 'NativeCurvatureError';
        this.code = code;
    }
}
const CODE = NativeCurvatureDiagnosticCode;
const ROUNDING = 512 * Number.EPSILON;
function check(condition, code, detail) {
    if (!condition)
        throw new NativeCurvatureError(code, detail);
}
function derivative(evaluate) {
    try {
        return evaluate();
    }
    catch (cause) {
        // Preserve the actual D2 error and its admission code without reading caller data.
        throw new NativeCurvatureError(CODE.DERIVATIVE, 'Native D2 evaluation failed', cause);
    }
}
function finite(value) {
    check(Number.isFinite(value), CODE.ARITHMETIC, 'Finite arithmetic range exceeded');
    return value;
}
function product(a, b) {
    const result = finite(a * b);
    check(a === 0 || b === 0 || result !== 0, CODE.ARITHMETIC, 'Nonzero product is not representable');
    return result;
}
function quotient(a, b) {
    check(Number.isFinite(b) && b !== 0, CODE.ARITHMETIC, 'A finite nonzero denominator is required');
    const result = finite(a / b);
    check(a === 0 || result !== 0, CODE.ARITHMETIC, 'Nonzero quotient is not representable');
    return result;
}
function dot(a, b) {
    return finite(finite(product(a[0], b[0]) + product(a[1], b[1])) + product(a[2], b[2]));
}
function cross(a, b) {
    return [finite(product(a[1], b[2]) - product(a[2], b[1])),
        finite(product(a[2], b[0]) - product(a[0], b[2])),
        finite(product(a[0], b[1]) - product(a[1], b[0]))];
}
function tangentNorm(tangent) {
    const norm = Math.hypot(...tangent);
    check(Number.isFinite(norm) && norm > 0, CODE.REGULARITY, 'A positive finite tangent norm is required');
    return norm;
}
function unit(vector, norm) {
    const result = [quotient(vector[0], norm), quotient(vector[1], norm), quotient(vector[2], norm)];
    check(Math.abs(finite(Math.hypot(...result) - 1)) <= ROUNDING, CODE.ARITHMETIC, 'Unit-vector normalization residual exceeded its rounding bound');
    return result;
}
/** Local geometric curvature in inverse millimetres; a straight regular Curve is valid. */
export function evaluateCurveCurvature(curve, parameter) {
    const derivatives = derivative(() => evaluateCurveD2(curve, parameter));
    const speed = tangentNorm(derivatives.derivative), unitTangent = unit(derivatives.derivative, speed);
    const tangential = dot(unitTangent, derivatives.secondDerivative);
    const curvatureVectorPer = [0, 1, 2].map(axis => quotient(quotient(finite(derivatives.secondDerivative[axis]
        - product(unitTangent[axis], tangential)), speed), speed));
    const curvaturePer = finite(Math.hypot(...curvatureVectorPer));
    const radius = curvaturePer === 0 ? null : quotient(1, curvaturePer);
    return { derivatives, speed: speed, unitTangent, curvaturePer: curvaturePer, curvatureVectorPer: curvatureVectorPer, radius: radius };
}
/** Native U/V-oriented local surface curvature with a disclosed discriminant rounding policy. */
export function evaluateSurfaceCurvature(surface, u, v) {
    const derivatives = derivative(() => evaluateSurfaceD2(surface, u, v));
    const normU = tangentNorm(derivatives.du), normV = tangentNorm(derivatives.dv);
    const tu = unit(derivatives.du, normU), tv = unit(derivatives.dv, normV);
    const cosineUV = dot(tu, tv), squaredCosine = product(cosineUV, cosineUV);
    const determinant = finite(1 - squaredCosine);
    const metricBound = product(ROUNDING, finite(1 + Math.abs(squaredCosine)));
    check(determinant > metricBound, CODE.REGULARITY, 'Native tangent directions are collinear or too nearly parallel');
    const normal = cross(tu, tv), normalNorm = Math.hypot(...normal);
    check(Number.isFinite(normalNorm) && normalNorm > 0, CODE.REGULARITY, 'A positive finite native cross-product norm is required');
    check(Math.abs(finite(product(normalNorm, normalNorm) - determinant)) <= metricBound, CODE.ARITHMETIC, 'Native cross-product metric residual exceeded its rounding bound');
    const unitNormal = unit(normal, normalNorm), perpendicularBound = quotient(ROUNDING, normalNorm);
    check(Math.abs(dot(unitNormal, tu)) <= perpendicularBound && Math.abs(dot(unitNormal, tv)) <= perpendicularBound, CODE.ARITHMETIC, 'Native normal orthogonality residual exceeded its rounding bound');
    const uu = quotient(quotient(dot(unitNormal, derivatives.duu), normU), normU);
    const uv = quotient(quotient(dot(unitNormal, derivatives.duv), normU), normV);
    const vv = quotient(quotient(dot(unitNormal, derivatives.dvv), normV), normV);
    const normalizedMetric = { cosineUV, determinant, tangentNorms: [normU, normV] };
    const normalizedSecondFormPer = { uu, uv, vv };
    const scalePer = Math.max(Math.abs(uu), Math.abs(uv), Math.abs(vv));
    if (scalePer === 0) {
        return { derivatives, unitNormal, normalizedMetric, normalizedSecondFormPer: normalizedSecondFormPer,
            meanCurvaturePer: 0, gaussianCurvaturePer: 0, principalCurvaturesPer: [0, 0],
            umbilicDiscriminant: { scalePer: 0, rawScaled: 0, roundoffBoundScaled: 0, clampedToZero: false } };
    }
    const e = quotient(uu, scalePer), f = quotient(uv, scalePer), g = quotient(vv, scalePer);
    const h = quotient(finite(finite(e - product(2, product(cosineUV, f))) + g), product(2, determinant));
    const k = quotient(finite(product(e, g) - product(f, f)), determinant);
    const meanCurvaturePer = product(scalePer, h);
    const gaussianCurvaturePer = product(scalePer, product(scalePer, k));
    const squaredH = product(h, h), rawScaled = finite(squaredH - k);
    const roundoffBoundScaled = product(ROUNDING, finite(Math.abs(squaredH) + Math.abs(k)));
    const clampedToZero = rawScaled < 0;
    check(!clampedToZero || Math.abs(rawScaled) <= roundoffBoundScaled, CODE.ARITHMETIC, 'Negative principal-curvature discriminant exceeded its declared rounding bound');
    const root = finite(Math.sqrt(clampedToZero ? 0 : rawScaled));
    const principalCurvaturesPer = [product(scalePer, finite(h - root)), product(scalePer, finite(h + root))];
    return { derivatives, unitNormal, normalizedMetric, normalizedSecondFormPer: normalizedSecondFormPer,
        meanCurvaturePer: meanCurvaturePer, gaussianCurvaturePer: gaussianCurvaturePer, principalCurvaturesPer: principalCurvaturesPer,
        umbilicDiscriminant: { scalePer: scalePer, rawScaled, roundoffBoundScaled, clampedToZero } };
}

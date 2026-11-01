function check(condition, detail) {
    if (!condition)
        throw new Error('C0 Bernstein elevation coefficients: ' + detail);
}
function finite(value) {
    check(Number.isFinite(value), 'Homogeneous coefficient arithmetic must remain finite');
    return value;
}
function copyPoint(point) { return [point[0], point[1], point[2]]; }
/** PRIVATE: root supplies admitted actual C0 data, dimensions and represented knot blocks. */
export function elevateC0BezierChainCoefficientsTrusted(original, blocks) {
    const p = original.degree, q = p + 1, spanCount = blocks.length - 1;
    const outputCount = spanCount * q + 1;
    check(p >= 1 && p <= 4 && spanCount >= 1 && original.controlPoints.length === spanCount * p + 1 &&
        outputCount <= 64 && outputCount + q + 1 <= 70, 'Caller dimension admission is required');
    const liftedOriginalHomogeneous = original.controlPoints.map((point, index) => {
        const weight = original.weights[index];
        return [finite(point[0] * weight), finite(point[1] * weight), finite(point[2] * weight), weight];
    });
    const controlPoints = Array(outputCount);
    const weights = Array(outputCount);
    const copiedPoles = blocks.map((_, index) => {
        const originalPoleIndex = index * p, outputPoleIndex = index * q;
        controlPoints[outputPoleIndex] = copyPoint(original.controlPoints[originalPoleIndex]);
        weights[outputPoleIndex] = original.weights[originalPoleIndex];
        return { originalPoleIndex, outputPoleIndex };
    });
    const spans = Array.from({ length: spanCount }, (_, index) => {
        const originalPoleIndices = Array.from({ length: p + 1 }, (_, i) => index * p + i);
        const outputPoleIndices = Array.from({ length: q + 1 }, (_, i) => index * q + i);
        const generated = Array.from({ length: p }, (_, offset) => {
            const i = offset + 1, alpha = i / q, beta = 1 - alpha;
            const leftOriginalPoleIndex = index * p + i - 1, rightOriginalPoleIndex = index * p + i;
            const leftHomogeneous = liftedOriginalHomogeneous[leftOriginalPoleIndex];
            const rightHomogeneous = liftedOriginalHomogeneous[rightOriginalPoleIndex];
            const leftContribution = leftHomogeneous.map(value => finite(alpha * value));
            const rightContribution = rightHomogeneous.map(value => finite(beta * value));
            const homogeneous = leftContribution.map((value, axis) => finite(value + rightContribution[axis]));
            const weight = homogeneous[3];
            check(weight >= 1e-6 && weight <= 1e6, 'Generated positive weight must remain in native range');
            const pointMM = [finite(homogeneous[0] / weight), finite(homogeneous[1] / weight),
                finite(homogeneous[2] / weight)];
            check(pointMM.every(value => Math.abs(value) <= 10000), 'Generated Cartesian coefficient exceeds10000mm');
            const outputPoleIndex = index * q + i;
            controlPoints[outputPoleIndex] = pointMM;
            weights[outputPoleIndex] = weight;
            return { outputPoleIndex, leftOriginalPoleIndex, rightOriginalPoleIndex, alpha,
                leftHomogeneous, rightHomogeneous, leftContribution, rightContribution, homogeneous, pointMM, weight };
        });
        return { index, domain: [blocks[index].value, blocks[index + 1].value],
            originalPoleIndices, outputPoleIndices, generated };
    });
    const knots = [];
    for (const block of blocks) {
        for (let index = block.originalFirstKnotIndex; index <= block.originalLastKnotIndex; index++) {
            knots.push({ outputKnotIndex: knots.length, originalKnotIndex: index,
                value: original.knots[index], origin: 'original-copy', blockIndex: block.index });
        }
        knots.push({ outputKnotIndex: knots.length, originalKnotIndex: null, value: block.value,
            origin: 'degree-multiplicity-increase', blockIndex: block.index });
    }
    check(Array.from(controlPoints).every(point => point !== undefined) &&
        Array.from(weights).every(weight => weight !== undefined) && knots.length === outputCount + q + 1, 'Complete generated and shared endpoint data are required');
    const candidate = { kind: 'curve', id: original.id, degree: q, knots: knots.map(slot => slot.value),
        controlPoints, weights };
    return { candidate, liftedOriginalHomogeneous, spans, copiedPoles, knots };
}

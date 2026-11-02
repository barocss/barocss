import { requireCurveValue as requireValue, snapshotCurveRequest as snapshot, compileCurveSource } from '../nurbs/curves/curve-source.js';
import { copyCadData } from '../data-copy.js';
function xy(value) {
    requireValue(Array.isArray(value) && value.length === 2, 'XY coordinate rank must be two');
    requireValue(value.every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 10000), 'XY coordinates must be finite and within 10000 mm');
    return [value[0], value[1]];
}
/** Bounded XY curves through actual source0 compilation; no region/solid proof. */
export function buildXYProfile(request) {
    const owned = snapshot(request);
    requireValue(owned !== null && typeof owned === 'object' && !Array.isArray(owned), 'request record required');
    const data = owned, kind = data.kind;
    requireValue(kind === 'line' || kind === 'polyline' || kind === 'rectangle', 'unsupported profile kind');
    const fields = kind === 'rectangle' ? ['kind', 'id', 'origin', 'width', 'height'] : ['kind', 'id', 'points'];
    requireValue(Object.keys(data).length === fields.length && fields.every(key => Object.hasOwn(data, key)), 'exact request fields required');
    requireValue(typeof data.id === 'string' && data.id.length <= 128 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(data.id), 'supported ASCII ID within 128 characters required');
    let vertices;
    if (kind === 'rectangle') {
        const origin = xy(data.origin), width = data.width, height = data.height;
        requireValue(typeof width === 'number' && width >= .001 && width <= 10000 && typeof height === 'number' && height >= .001 && height <= 10000, 'rectangle dimensions must be in 0.001..10000 mm');
        const [x, y] = origin;
        vertices = [xy([x, y]), xy([x + width, y]), xy([x + width, y + height]), xy([x, y + height]), xy([x, y])];
    }
    else {
        requireValue(Array.isArray(data.points) && data.points.length >= 2 && data.points.length <= 64 && (kind !== 'line' || data.points.length === 2), 'line requires two points; polyline requires 2..64');
        vertices = data.points.map(xy);
        const first = vertices[0], last = vertices.at(-1);
        requireValue(first[0] !== last[0] || first[1] !== last[1], 'polyline/line endpoints must remain open');
    }
    for (let i = 1; i < vertices.length; i++) {
        const length = Math.hypot(vertices[i][0] - vertices[i - 1][0], vertices[i][1] - vertices[i - 1][1]);
        requireValue(Number.isFinite(length) && length >= .001, 'actual adjacent segment must be at least 0.001 mm');
    }
    const controlPoints = vertices.map(([x, y]) => [x, y, 0]), count = controlPoints.length;
    const knots = [0, 0, ...Array.from({ length: count - 2 }, (_, i) => i + 1), count - 1, count - 1], weights = Array(count).fill(1);
    const { source, model, curve } = compileCurveSource(data.id, 1, controlPoints, knots, weights);
    return { source, sourceVersion: 0, model: copyCadData(model), curve: copyCadData(curve), report: {
            kind, plane: 'xy', lengthUnit: 'mm', vertexCount: count, segmentCount: count - 1,
            parameterDomain: { min: 0, max: count - 1 }, endpointClosed: kind === 'rectangle', regionCertified: false, solid: false,
        } };
}

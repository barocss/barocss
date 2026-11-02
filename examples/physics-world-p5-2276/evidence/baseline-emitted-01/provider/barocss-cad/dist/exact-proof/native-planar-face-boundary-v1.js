import { qualifyNativePlanarLoopV1 } from './native-planar-loop-qualification-v1.js';
/** Capture the entire bounded input with reflection only, before qualification. */
function snapshotLoop(input) {
    try {
        if (!Array.isArray(input) || input.length < 3 || input.length > 16)
            return null;
        const slots = Object.getOwnPropertyDescriptors(input);
        const points = [];
        for (let i = 0; i < input.length; i++) {
            const slot = slots[String(i)];
            if (!slot || !('value' in slot))
                return null;
            const raw = slot.value;
            if (!raw || typeof raw !== 'object' || Array.isArray(raw))
                return null;
            const prototype = Object.getPrototypeOf(raw);
            if (prototype !== Object.prototype && prototype !== null)
                return null;
            const fields = Object.getOwnPropertyDescriptors(raw);
            if (Reflect.ownKeys(fields).length !== 2 ||
                !['x', 'y'].every(k => Object.hasOwn(fields, k) && 'value' in fields[k] &&
                    fields[k].enumerable && typeof fields[k].value === 'number'))
                return null;
            points.push({ x: fields.x.value, y: fields.y.value });
        }
        return points;
    }
    catch {
        return null;
    }
}
/** One immutable oriented boundary cycle, not a sewn B-Rep Face/Shell. Twin is absent. */
export function constructNativePlanarFaceBoundaryV1(faceId, loop) {
    if (typeof faceId !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(faceId))
        return { status: 'refused', reason: 'invalid-face-id' };
    const points = snapshotLoop(loop);
    if (!points)
        return { status: 'refused', reason: 'invalid-loop' };
    const result = qualifyNativePlanarLoopV1(points);
    if (result.status !== 'qualified')
        return result;
    const n = points.length;
    const vertices = Object.freeze(points.map((p, i) => Object.freeze({
        id: faceId + ':v' + i,
        pointMM: Object.freeze({ x: p.x, y: p.y }),
    })));
    const edgeId = (i) => faceId + ':h' + i;
    const halfEdges = Object.freeze(points.map((_, i) => Object.freeze({
        id: edgeId(i), originVertexId: vertices[i].id,
        destinationVertexId: vertices[(i + 1) % n].id,
        nextId: edgeId((i + 1) % n), previousId: edgeId((i + n - 1) % n),
        twinId: null,
    })));
    return Object.freeze({ status: 'qualified', faceId, winding: result.winding, vertices, halfEdges });
}

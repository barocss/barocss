import { PhysicsError } from '../../packages/barocss-physics/src/types.js';
import { add } from '../../packages/barocss-physics/src/math.js';
import { error } from '../../packages/barocss-physics/src/validation.js';
import { featureContact } from '../physics-rigid-feature-geometry/geometry.js';
export const FEATURE_WITNESS_MESSAGE = 'private feature contact requires valid box witnesses';
export function adaptContactGeometry(a, b) {
    let geometry;
    try {
        geometry = featureContact(a, b);
    }
    catch (caught) {
        if (caught instanceof PhysicsError && (caught.code === 'INVALID_CONFIG' || caught.code === 'NUMERIC_LIMIT')) {
            // Inputs are the world's unaccepted working bodies, not caller config.
            error('NUMERIC_LIMIT', FEATURE_WITNESS_MESSAGE);
        }
        throw caught;
    }
    if (!geometry)
        return null;
    const points = geometry.points.map(point => ({
        id: point.key, pointM: [...point.midpointM],
        witnessAM: [...point.witnessAM], witnessBM: [...point.witnessBM],
        normalGapM: point.normalGapM, pointPenetrationM: point.pointPenetrationM,
    }));
    const sum = points.reduce((value, point) => add(value, point.pointM), [0, 0, 0]);
    return {
        family: geometry.family, normal: [...geometry.planeNormalAtoB],
        satNormalAtoB: [...geometry.selection.hit.normal],
        satPenetrationM: geometry.selection.hit.penetration, points,
        meanPointM: sum.map(value => value / points.length),
    };
}

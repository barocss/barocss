export function emptyWarmCacheStats() {
    return { testedPatches: 0, compatiblePatches: 0, incompatiblePatches: 0, reusedPoints: 0, coldPoints: 0 };
}
/** Whole current/prior face-key equality only. Edge rows are always cold. */
export function compatiblePatch(cache, pairKey, points, family) {
    if (family !== 'face')
        return false;
    const prefix = `${pairKey}\u0000`;
    const current = new Set(points.map(point => `${prefix}${point.id}`));
    const previous = [...cache.keys()].filter(key => key.startsWith(prefix));
    return current.size > 0 && current.size === points.length
        && points.every(point => point.id.startsWith('face:'))
        && previous.length === current.size
        && previous.every(key => key.slice(prefix.length).startsWith('face:') && current.has(key));
}

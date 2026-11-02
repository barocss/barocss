export const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
export const add = (a, b) => a.map((value, index) => value + b[index]);
export const scale = (a, factor) => a.map(value => value * factor);
export const norm = (a) => Math.hypot(...a);
/** Clone only admitted private records and arrays. Preserve all numeric bits. */
export function clone(value) {
    if (Array.isArray(value))
        return value.map(item => clone(item));
    if (value !== null && typeof value === 'object') {
        const result = {};
        for (const key of Object.keys(value))
            result[key] = clone(value[key]);
        return result;
    }
    return value;
}

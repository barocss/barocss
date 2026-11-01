/** Compiler-owned plain data: copy each occurrence and retain binary64/-0. */
export function copyCadData(value) {
    if (Array.isArray(value))
        return value.map(item => copyCadData(item));
    if (value !== null && typeof value === 'object')
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copyCadData(item)]));
    return value;
}

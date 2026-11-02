import { PhysicsError } from './types.js';
/** Copy only inert plain data. Preserve number bits and reject reflection hooks. */
export function copyData(input) {
    let count = 0;
    function copy(value, depth) {
        if (++count > 1000000 || depth > 32)
            throw new PhysicsError('INVALID_CONFIG', 'data exceeds bounded depth or size');
        if (value === null || typeof value === 'boolean')
            return value;
        if (typeof value === 'string') {
            for (const character of value) {
                const point = character.codePointAt(0);
                if (point >= 0xd800 && point <= 0xdfff)
                    throw new PhysicsError('INVALID_CONFIG', 'strings must be well-formed Unicode');
            }
            return value;
        }
        if (typeof value === 'number' && Number.isFinite(value))
            return value;
        if (typeof value !== 'object' || value === null)
            throw new PhysicsError('INVALID_CONFIG', 'only finite plain data is supported');
        const descriptors = Object.getOwnPropertyDescriptors(value);
        const keys = Reflect.ownKeys(value);
        if (Array.isArray(value)) {
            if (Object.getPrototypeOf(value) !== Array.prototype || keys.length !== value.length + 1 ||
                !Array.from({ length: value.length }, (_, i) => descriptors[i]?.enumerable && 'value' in descriptors[i]).every(Boolean)) {
                throw new PhysicsError('INVALID_CONFIG', 'arrays must be dense ordinary data arrays');
            }
            return Array.from({ length: value.length }, (_, i) => copy(descriptors[i].value, depth + 1));
        }
        if (Object.getPrototypeOf(value) !== Object.prototype || keys.some((key) => typeof key !== 'string' ||
            !/^[\x20-\x7e]+$/.test(key) || !descriptors[key]?.enumerable || !('value' in descriptors[key]))) {
            throw new PhysicsError('INVALID_CONFIG', 'records must have plain ASCII data fields');
        }
        return Object.fromEntries(keys.map((key) => [key, copy(descriptors[key].value, depth + 1)]));
    }
    return copy(input, 0);
}
/** Frozen P0 canonical typed encoding. Strings use UTF-8; numbers use binary64 LE. */
export function canonicalEncode(input) {
globalThis.__p5Kernel.hit('canonicalEncode');

    const value = copyData(input);
    const bytes = [];
    const encodeUtf8 = (text) => {
        const result = [];
        for (const character of text) {
            let point = character.codePointAt(0);
            if (point >= 0xd800 && point <= 0xdfff)
                point = 0xfffd;
            if (point < 0x80)
                result.push(point);
            else if (point < 0x800)
                result.push(0xc0 | (point >> 6), 0x80 | (point & 63));
            else if (point < 0x10000)
                result.push(0xe0 | (point >> 12), 0x80 | ((point >> 6) & 63), 0x80 | (point & 63));
            else
                result.push(0xf0 | (point >> 18), 0x80 | ((point >> 12) & 63), 0x80 | ((point >> 6) & 63), 0x80 | (point & 63));
        }
        return result;
    };
    const uint32 = (number) => { for (let i = 0; i < 4; i++)
        bytes.push((number >>> (i * 8)) & 255); };
    function write(item) {
        if (item === null) {
            bytes.push(0);
            return;
        }
        if (typeof item === 'boolean') {
            bytes.push(item ? 2 : 1);
            return;
        }
        if (typeof item === 'string') {
            const encoded = encodeUtf8(item);
            bytes.push(3);
            uint32(encoded.length);
            for (const byte of encoded)
                bytes.push(byte);
            return;
        }
        if (typeof item === 'number') {
            bytes.push(4);
            const data = new DataView(new ArrayBuffer(8));
            data.setFloat64(0, item, true);
            for (let i = 0; i < 8; i++)
                bytes.push(data.getUint8(i));
            return;
        }
        if (Array.isArray(item)) {
            bytes.push(5);
            uint32(item.length);
            for (const entry of item)
                write(entry);
            return;
        }
        const record = item;
        const keys = Object.keys(record).sort();
        bytes.push(6);
        uint32(keys.length);
        for (const key of keys) {
            write(key);
            write(record[key]);
        }
    }
    write(value);
    return Uint8Array.from(bytes);
}
const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
const rotate = (x, n) => (x >>> n) | (x << (32 - n));
/** Synchronous SHA-256, with no platform crypto or runtime dependency. */
export function sha256(bytes) {
    const padded = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64);
    padded.set(bytes);
    padded[bytes.length] = 128;
    const view = new DataView(padded.buffer);
    const bits = bytes.length * 8;
    view.setUint32(padded.length - 8, Math.floor(bits / 0x100000000));
    view.setUint32(padded.length - 4, bits >>> 0);
    const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const w = new Uint32Array(64);
    for (let offset = 0; offset < padded.length; offset += 64) {
        for (let i = 0; i < 16; i++)
            w[i] = view.getUint32(offset + i * 4);
        for (let i = 16; i < 64; i++) {
            const a = w[i - 15], b = w[i - 2];
            w[i] = (w[i - 16] + (rotate(a, 7) ^ rotate(a, 18) ^ (a >>> 3)) + w[i - 7] + (rotate(b, 17) ^ rotate(b, 19) ^ (b >>> 10))) >>> 0;
        }
        let [a, b, c, d, e, f, g, j] = h;
        for (let i = 0; i < 64; i++) {
            const t1 = (j + (rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
            const t2 = ((rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
            j = g;
            g = f;
            f = e;
            e = (d + t1) >>> 0;
            d = c;
            c = b;
            b = a;
            a = (t1 + t2) >>> 0;
        }
        for (const [i, v] of [a, b, c, d, e, f, g, j].entries())
            h[i] = (h[i] + v) >>> 0;
    }
    return `sha256:${h.map((word) => word.toString(16).padStart(8, '0')).join('')}`;
}
export function digest(value) { return sha256(canonicalEncode(value)); }

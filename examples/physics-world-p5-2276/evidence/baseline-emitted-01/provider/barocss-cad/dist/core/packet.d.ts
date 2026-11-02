import type { Point } from '../types.js';
/** Approximate open-surface preview geometry. Coordinates stay in millimetres. */
export interface PreviewPacket {
    version: 0;
    surfaceId: string;
    revision: number;
    lengthUnit: 'mm';
    coordinateSystem: 'right-handed-z-up';
    winding: 'ccw';
    positions: number[];
    normals: number[];
    indices: number[];
    parameters: number[];
    bounds: {
        min: Point;
        max: Point;
    };
}
/** Reject malformed data, ambiguous normals and unsupported fields before copying. */
export declare function validatePreviewPacket(packet: unknown): asserts packet is PreviewPacket;
/** Return owned plain arrays and metadata after complete validation succeeds. */
export declare function copyPreviewPacket(packet: unknown): PreviewPacket;

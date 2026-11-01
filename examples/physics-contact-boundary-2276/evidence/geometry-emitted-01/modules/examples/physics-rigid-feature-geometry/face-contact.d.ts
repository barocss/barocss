import type { Body, Vec3 } from '../../packages/barocss-physics/src/types.js';
import type { SATFeatureSelection } from './sat-feature.js';
import type { ContactGeometry } from './contact-types.js';
/** Exact halfspace classification; no original near-face alignment or 1e-6 separation filter. */
export declare function clipFace(polygon: Vec3[], centre: Vec3, axis: Vec3, limit: number): Vec3[];
export declare function faceContact(a: Body, b: Body, selection: SATFeatureSelection): ContactGeometry;

import type { RigidBody, BodyState, Collider, SourceBinding } from './types.js';
import type { Quat, Vec3 } from './internal-types.js';
export interface CadSurfaceProxyRequest {
    sourceVersion: 0;
    sourceRevision: string;
    modelId: string;
    surfaceId: string;
    kind: 'dynamic' | 'static';
    proxy: 'sphere' | 'box';
    massKg?: number;
    initialOffsetM?: Vec3;
    minimumHalfExtentM?: number;
}
export interface CadSurfaceProxy {
    sourceSnapshot: string;
    sourceRevision: string;
    modelId: string;
    surfaceId: string;
    bodyId: string;
    sourceCenterMM: Vec3;
    sourceBoundsMM: {
        min: Vec3;
        max: Vec3;
    };
    lossLabel: string;
    body: RigidBody;
    collider: Collider;
    binding: SourceBinding;
}
export interface CadProxyPose {
    targetId: string;
    translation: Vec3;
    rotation: Quat;
}
export type CadProxyBodyState = Pick<BodyState, 'id' | 'positionM' | 'orientationXYZW'>;

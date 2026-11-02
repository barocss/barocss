import type { Vec3 } from './types.js';
/** Moment about the +Z axis through the COM, or through the fixed pivot, in kg m². */
export interface PlanarPendulumInertia {
    about: 'com' | 'pivot';
    kgM2: number;
}
/** SI units. The pivot is the origin, gravity is -Y, and positive angles turn about +Z. */
export interface PlanarPendulumConfig {
    massKg: number;
    comDistanceM: number;
    inertia: PlanarPendulumInertia;
    gravityMps2: number;
    initialAngleRad: number;
    initialAngularVelocityRadps: number;
    fixedStepSeconds: number;
    /** Integer in [1, 1000000]. Default: 1000000. */
    maxSteps?: number;
}
export interface PlanarPendulumState {
    stepIndex: number;
    timeSeconds: number;
    angleRad: number;
    angularVelocityRadps: number;
    angularAccelerationRadps2: number;
    comPositionM: Vec3;
    /** Kinetic plus gravitational potential energy. Potential is zero at angle zero. */
    energyJ: number;
}
/** A reduced one-coordinate ODE, separate from PhysicsWorld and its joint solver. */
export interface PlanarPendulum {
    getState(): PlanarPendulumState;
    step(fixedStepSeconds: number): PlanarPendulumState;
    dispose(): void;
}
/**
 * Admit one rigid planar pendulum. No contacts, motors, damping, or body geometry.
 * Each step uses velocity Verlet. Failed steps keep the last accepted state.
 */
export declare function createPlanarPendulum(config: PlanarPendulumConfig): PlanarPendulum;

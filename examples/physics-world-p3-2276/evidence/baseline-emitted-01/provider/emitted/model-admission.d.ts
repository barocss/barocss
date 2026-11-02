import type { PhysicsModel, WorldOptions } from './types.js';
import type { Body, Joint } from './internal-types.js';
export declare function admitModel(rawModel: PhysicsModel, rawOptions: WorldOptions): {
    model: PhysicsModel;
    options: WorldOptions;
    bodies: Body[];
    joints: Joint[];
};

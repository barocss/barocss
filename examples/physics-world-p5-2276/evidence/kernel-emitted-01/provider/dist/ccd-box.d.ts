import type { Body, PhysicsCcdHit } from './internal-types.js';
import type { AdmittedCommands } from './validation.js';
export declare function axisAlignedBox(body: Body): boolean;
export declare function rejectAngularBoxCommand(action?: AdmittedCommands): void;
export declare function sweepDynamicBox(previous: Body, candidate: Body, fixture: Body): PhysicsCcdHit | null;

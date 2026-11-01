import type { PhysicsModel, WorldOptions, VisualProfileId } from '@barocss/physics';
type VisualOptions = Extract<WorldOptions, { readonly profile: VisualProfileId }>;
export const physicsModelPresets: Readonly<Record<VisualProfileId, Readonly<{ model: PhysicsModel; options: VisualOptions }>>>;
/** Detached plain public model data; creates no runtime or clock. */
export function copyPhysicsModelPreset(profile: VisualProfileId): { model: PhysicsModel; options: VisualOptions };

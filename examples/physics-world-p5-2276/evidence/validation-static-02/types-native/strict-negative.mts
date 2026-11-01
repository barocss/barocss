import {createPhysicsWorld,type WorldOptions} from '@barocss/physics';
import {copyPhysicsModelPreset} from "/Users/user/Documents/ChatGPT/barocss-physics-motion-2276/examples/physics-model-data-2276/model-data.mjs";
// @ts-expect-error Removed root factory.
import {createClothWorld} from '@barocss/physics';
// @ts-expect-error Direct type rename has no alias.
import type {PlannedVisualProfileId} from '@barocss/physics';
// @ts-expect-error Removed cloth runtime subpath.
import {createClothWorld as removedCloth} from '@barocss/physics/cloth';
// @ts-expect-error Removed fluid runtime subpath.
import {createFluidWorld} from '@barocss/physics/fluid';
// @ts-expect-error Removed CAD-fluid runtime subpath.
import {createCadFluidWorld} from '@barocss/physics/fluid-cad';
const input=copyPhysicsModelPreset('fluid-basin-visual-v1');const world=createPhysicsWorld(input.model,input.options);
// @ts-expect-error No dt overload.
world.step(1/120);
// @ts-expect-error No reset method.
world.reset();
// @ts-expect-error Explicit options required.
createPhysicsWorld(input.model);
// @ts-expect-error domain-fixed broad phase is required by visual profiles.
const bad:WorldOptions={profile:'fluid-basin-visual-v1',fixedStepSeconds:1/120,broadPhase:'direct'};
void [bad,createClothWorld,removedCloth,createFluidWorld,createCadFluidWorld];
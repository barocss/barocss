import {createPhysicsWorld,PhysicsError,type PhysicsModel,type PhysicsState,type Cloth,type Fluid,type VisualProfileId} from '@barocss/physics';
import {createPhysicsRecorder} from '@barocss/physics/replay';
import {admitCadFluidStaticData,assertCadProxyCurrent} from '@barocss/physics/cad-proxy';
import {copyPhysicsModelPreset} from "/Users/user/Documents/ChatGPT/barocss-physics-motion-2276/examples/physics-model-data-2276/model-data.mjs";
const profile:VisualProfileId='cloth-pinned-sphere-visual-v1';
const input=copyPhysicsModelPreset(profile);const model:PhysicsModel=input.model;
const world=createPhysicsWorld(model,input.options);const state:PhysicsState=world.step([]);
const p:Float64Array=state.cloths[0].positionsM;const c:Cloth=model.cloths[0];const f:Fluid=model.fluids[0];
const e:typeof PhysicsError=PhysicsError;void [p,c,f,e,createPhysicsRecorder,admitCadFluidStaticData,assertCadProxyCurrent];world.dispose();
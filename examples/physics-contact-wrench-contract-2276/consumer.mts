// Proposed contract only. This does not import or execute a World.
import type { Contact, PhysicsState, Recording, PairWrench } from './types.js';
declare const state: PhysicsState;
declare const contact: Contact;
declare const wrench: PairWrench;
const schema: 2 = state.schemaVersion;
const gapM: number = contact.points[0].signedGapM;
const impulseXNs: number = wrench.onB.linearImpulseNs[0];
const momentXNms: number = wrench.onA.angularImpulseAboutWorldOriginNms[0];
void [schema, gapM, impulseXNs, momentXNms];
// @ts-expect-error Old cache impulse is not a contact-geometry authority.
contact.normalImpulseNs;
// @ts-expect-error No averaged historical point remains in pair geometry.
contact.pointM;
// @ts-expect-error Wrenches are mandatory, including explicit empty states.
const missing: PhysicsState = {} as Omit<PhysicsState, 'pairWrenches'>;
// @ts-expect-error Old recordings require no decoder or type compatibility.
const version: Recording['version'] = 1;
// @ts-expect-error Accepted wrench vectors are readonly.
wrench.onB.linearImpulseNs[0] = 1;

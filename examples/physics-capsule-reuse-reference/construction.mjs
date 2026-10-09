import { CASES } from '../physics-capsule-sweep-reference/fixture.mjs';
import { createSnapshot } from './snapshot.mjs';
export function measureConstruction(){return CASES.map(fixture=>{const start=performance.now(),world=createSnapshot(fixture.scene),milliseconds=performance.now()-start;
 const diagnostics=world.getDiagnostics();world.dispose();return {name:fixture.name,milliseconds,...diagnostics,
 scope:'One post-campaign construction observation; outside query timing; no constructor budget or heap measurement'};});}

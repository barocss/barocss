import { CASES } from './fixture.mjs';
import { createSnapshot } from '../physics-capsule-reuse-reference/snapshot.mjs';
export function measureConstruction() {
 return CASES.map(fixture => {const start=performance.now(),snapshot=createSnapshot(fixture.scene),durationMs=performance.now()-start;
 const diagnostics=snapshot.getDiagnostics();snapshot.dispose();return {name:fixture.name,durationMs,...diagnostics};});
}

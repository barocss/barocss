import {insertSurfaceKnot,surfaceDomain} from '@barocss/cad';
import type {Surface,SurfaceKnotInsertionOptions,SurfaceKnotInsertionResult} from '@barocss/cad';
import {surfaceGeometry} from './native-adapters';
import type {SurfaceIntent} from './native-adapters';
export type {SurfaceKnotInsertionOptions,SurfaceKnotInsertionResult} from '@barocss/cad';

/** Refine only the selected original source0 Surface through native620 admission. */
export function refineSurfaceIntent(intent:SurfaceIntent,options:SurfaceKnotInsertionOptions):{intent:SurfaceIntent;result:SurfaceKnotInsertionResult} {
 const result=insertSurfaceKnot(surfaceGeometry(intent),options);
 return {intent:{kind:'surface',sourceVersion:result.sourceVersion,source:result.source},result};
}
function checkAxis(axis:SurfaceKnotInsertionOptions['axis']):void {
 if(axis!=='u'&&axis!=='v')throw Error('Choose the original Surface U or V axis');
}
/** Original dimensionless parameter domain. Never assumes normalized0..1 or millimetres. */
export function refinementDomain(surface:Surface,axis:SurfaceKnotInsertionOptions['axis']):[number,number] {
 checkAxis(axis);const domain=surfaceDomain(surface);return [...domain[axis]];
}
/** Exact numeric multiplicity; +0 and -0 denote the same native knot parameter. */
export function refinementMultiplicity(surface:Surface,axis:SurfaceKnotInsertionOptions['axis'],knot:number):number {
 checkAxis(axis);if(!Number.isFinite(knot))throw Error('Finite original Surface parameter required');
 surfaceDomain(surface);return (axis==='u'?surface.knotsU:surface.knotsV).filter(value=>value===knot).length;
}

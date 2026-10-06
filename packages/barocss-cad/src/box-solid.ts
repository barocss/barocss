import { validateAxisBoxShell } from './box-shell.js';
import type { AxisBoxShell } from './box-shell.js';
import type { Point } from './types.js';

export interface AxisBoxSolidValidationReport {
  valid: true;
  geometryFamily: 'exact-axis-box-solid-v0';
  closed: true;
  solid: true;
  volumeMM3: number;
  areaMM2: number;
  boundsMM: { min: Point; max: Point };
}

function requireValue(condition: boolean, message: string): asserts condition { if (!condition) throw new Error('Axis box solid gate: '+message); }
function snapshot(input: unknown): unknown {
  let remaining = 32768;
  const copy = (value: unknown, depth: number): unknown => {
    requireValue(--remaining >= 0 && depth <= 18,'bounded structure exceeded');
    if (typeof value === 'number') { requireValue(Number.isFinite(value),'finite numbers required'); return value; }
    if (typeof value === 'string') { requireValue(value.length <= 128,'string exceeds128'); return value; }
    if (typeof value === 'boolean') return value;
    requireValue(value !== null && typeof value === 'object','plain values required');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    requireValue(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null,'plain data required');
    const keys = Reflect.ownKeys(value);
    requireValue(keys.length <= (array ? 129 : 16),'own field bound exceeded');
    const descriptors = Object.getOwnPropertyDescriptors(value);
    requireValue(keys.every(key => typeof key === 'string' && 'value' in descriptors[key] && (array && key==='length' || descriptors[key].enumerable===true)),'accessors, symbols or nonenumerable fields');
    if (array) {
      const length = descriptors.length.value as number;
      requireValue(Number.isInteger(length) && length <= 128 && keys.length===length+1,'bounded dense array required');
      const result: unknown[] = [];
      for (let i=0;i<length;i++) { requireValue(Object.hasOwn(descriptors,String(i)),'sparse or foreign array field'); result.push(copy(descriptors[String(i)].value,depth+1)); }
      return result;
    }
    const result: Record<string,unknown> = {};
    for (const key of keys as string[]) Object.defineProperty(result,key,{value:copy(descriptors[key].value,depth+1),enumerable:true,writable:true,configurable:true});
    return result;
  };
  return copy(input,0);
}

/** One caller snapshot, actual shell validation, then calculation from that same copy. */
export function validateAxisBoxSolid(input: unknown): AxisBoxSolidValidationReport {
  const owned = snapshot(input);
  const boundary = validateAxisBoxShell(owned);
  requireValue(boundary.incidenceValid === true && boundary.geometryFamily === 'exact-axis-box-shell-v0' && boundary.closed === true && boundary.solid === false && boundary.solidProductImplemented === false, 'actual restricted shell report required');
  const shell = owned as AxisBoxShell;
  const [x,y,z] = shell.sides;
  const volumeMM3 = x*y*z;
  const areaMM2 = 2*(x*y+y*z+z*x);
  requireValue(Number.isSafeInteger(volumeMM3) && volumeMM3 > 0 && volumeMM3 <= 1e12 && Number.isSafeInteger(areaMM2) && areaMM2 > 0 && areaMM2 <= 6e8, 'exact safe integer analysis required');
  const min: Point = [...shell.origin];
  const max = shell.origin.map((value,axis)=>value+shell.sides[axis]) as Point;
  requireValue(max.every(Number.isSafeInteger) && min.every(Number.isSafeInteger), 'exact integer bounds required');
  return {valid:true,geometryFamily:'exact-axis-box-solid-v0',closed:true,solid:true,volumeMM3,areaMM2,boundsMM:{min,max}};
}

export type ModelingDiagnostic = {
  stage: 'input' | 'native' | 'transport' | 'display'; message: string; code?: string; operation?: string;
};
const stages = new Set(['input', 'native', 'transport', 'display']);
const codes = new Set(['INPUT', 'PARAMETER', 'OWNERSHIP', 'CAPABILITY', 'SELECTION', 'FORMAT', 'BUDGET', 'NATIVE']);
const ownValue = (value: object, key: string): unknown => {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined;
};

/** Only bounded public Error fields are projected; causes, stacks and native objects stay private. */
export function modelingDiagnostic(cause: unknown, stage: ModelingDiagnostic['stage']): ModelingDiagnostic {
  const message = cause instanceof Error ? ownValue(cause, 'message') : undefined;
  const result: ModelingDiagnostic = { stage, message: typeof message === 'string' ? message.slice(0, 2048) : 'CAD modeling refused.' };
  // Provider-reported metadata is diagnostic only, never evidence of native authority.
  // An own name keeps the controller free of CAD runtime/native dependencies.
  if (cause instanceof Error && ownValue(cause, 'name') === 'CadModelError') {
    const code = ownValue(cause, 'code'), operation = ownValue(cause, 'operation');
    if (typeof code === 'string' && codes.has(code)) result.code = code;
    if (typeof operation === 'string') result.operation = operation.slice(0, 64);
  }
  return result;
}

/** Admit only the finite diagnostic transport shape, without invoking arbitrary properties. */
export function admitModelingDiagnostic(value: unknown): ModelingDiagnostic {
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype)
    throw new Error('Invalid modeling diagnostic.');
  const keys = Reflect.ownKeys(value);
  if (keys.length < 2 || keys.length > 4 || keys.some(key => typeof key !== 'string'
    || !['stage', 'message', 'code', 'operation'].includes(key)
    || !Object.getOwnPropertyDescriptor(value, key)?.enumerable
    || !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key)!, 'value')))
    throw new Error('Invalid modeling diagnostic.');
  const stage = ownValue(value, 'stage'), message = ownValue(value, 'message');
  const code = ownValue(value, 'code'), operation = ownValue(value, 'operation');
  if (typeof stage !== 'string' || !stages.has(stage) || typeof message !== 'string' || message.length > 2048
    || (Object.hasOwn(value, 'code') && (typeof code !== 'string' || !codes.has(code)))
    || (Object.hasOwn(value, 'operation') && (typeof operation !== 'string' || operation.length > 64)))
    throw new Error('Invalid modeling diagnostic.');
  return { stage: stage as ModelingDiagnostic['stage'], message,
    ...(code === undefined ? {} : { code: code as string }), ...(operation === undefined ? {} : { operation: operation as string }) };
}

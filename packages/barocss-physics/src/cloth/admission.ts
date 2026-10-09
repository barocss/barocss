import { PhysicsError } from '../types.js';
import { CLOTH_PROFILE_NAME, CLOTH_STEP_SECONDS } from './profile.js';

function invalid(): never {
  throw new PhysicsError('INVALID_CONFIG', 'Unsupported ClothSceneV1 contract');
}

export function admitClothScene(value: unknown): string {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) invalid();
    const fields = ['format', 'version', 'revision', 'basis', 'fixedStepSeconds', 'profile'];
    const keys = Reflect.ownKeys(value);
    if (keys.length !== fields.length || keys.some(key => typeof key !== 'string' || !fields.includes(key))) invalid();
    const scene: Record<string, unknown> = Object.create(null);
    for (const key of fields) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) invalid();
      scene[key] = descriptor.value;
    }
    if (scene.format !== 'barocss-cloth-scene' || scene.version !== 1
      || scene.basis !== 'right-handed-xyz-metres' || scene.fixedStepSeconds !== CLOTH_STEP_SECONDS
      || scene.profile !== CLOTH_PROFILE_NAME || typeof scene.revision !== 'string'
      || !/^[A-Za-z][A-Za-z0-9._:-]{0,63}$/.test(scene.revision)) invalid();
    return scene.revision;
  } catch (error) {
    if (error instanceof PhysicsError) throw error;
    invalid();
  }
}

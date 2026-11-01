// An occurrence's stored joint values (PartInstance.joints, assembly/flexible.ts), checked as the file reader and the pose both need.

/** Why stored values are not joint values at all (not an object of finite numbers), in words naming the part and the key, or null. */
export function valuesProblem(values: unknown, who: string): string | null {
  if (typeof values !== 'object' || values === null || Array.isArray(values)) return `${who}: "joints" is an object of joint key to number`;
  for (const [k, v] of Object.entries(values)) if (typeof v !== 'number' || !Number.isFinite(v)) return `${who}: joint "${k}" holds ${typeof v === 'number' ? String(v) : JSON.stringify(v) ?? 'nothing'}, not a finite number`;
  return null;
}

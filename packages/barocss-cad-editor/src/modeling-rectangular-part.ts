export interface RectangularPartInput { width: string; height: string; thickness: string }
/** Authored intent only. The existing CAD loader remains the native geometry authority. */
export function createRectangularPartSource(input: RectangularPartInput): string {
  const parameters = Object.fromEntries((['width', 'height', 'thickness'] as const).map(name => {
    const raw = input[name];
    if (typeof raw !== 'string' || raw.length > 64 || !/^\+?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw.trim()))
      throw Error(`${name} must be a positive decimal dimension in mm.`);
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0 || value > 10000)
      throw Error(`${name} must be greater than 0 and at most 10000 mm.`);
    return [name, value];
  }));
  return JSON.stringify({ format: 'barocss-cad-model', schema: 1, units: 'mm', parameters,
    nodes: [
      { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [{ parameter: 'width' }, { parameter: 'height' }] },
      { kind: 'extrude', sketch: 0, height: { parameter: 'thickness' } },
    ], outputs: { part: { node: 1, side: 'solid' } },
  }, null, 2) + '\n';
}

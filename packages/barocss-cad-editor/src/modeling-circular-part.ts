export interface CircularPartInput { diameter: string; thickness: string }
/** Public authored intent only; native loading and receiving display admission remain authoritative. */
export function createCircularPartSource(input: CircularPartInput): string {
  const parameters = Object.fromEntries((['diameter', 'thickness'] as const).map(name => {
    const raw = input[name], minimum = name === 'diameter' ? 0.002 : 0.001;
    if (typeof raw !== 'string' || raw.length > 64 || !/^\+?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw.trim()))
      throw Error(`${name} must be a positive decimal dimension in mm.`);
    const value = Number(raw);
    if (!Number.isFinite(value) || value < minimum || value > 10000)
      throw Error(`${name} must be at least ${minimum} and at most 10000 mm.`);
    return [name, value];
  }));
  return JSON.stringify({ format: 'barocss-cad-model', schema: 1, units: 'mm', parameters,
    nodes: [
      { kind: 'sketch', profile: 'circle', center: [0, 0], radius: { op: 'scale', value: { parameter: 'diameter' }, factor: 0.5 } },
      { kind: 'extrude', sketch: 0, height: { parameter: 'thickness' } },
    ], outputs: { part: { node: 1, side: 'solid' } },
  }, null, 2) + '\n';
}

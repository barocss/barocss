export function createSheet(fixture) {
  const { size, sideM, heightM, densityKgM2 } = fixture;
  const positions = new Float64Array(size * size * 3);
  const triangles = [];
  const constraints = [];
  const spacing = sideM / (size - 1);
  for (let z = 0; z < size; z++) for (let x = 0; x < size; x++) {
    positions.set([-sideM / 2 + x * spacing, heightM, -sideM / 2 + z * spacing],
      3 * (z * size + x));
    if (x < size - 1 && z < size - 1) {
      const a = z * size + x;
      triangles.push(a, a + size, a + 1, a + 1, a + size, a + size + 1);
    }
  }
  const masses = new Float64Array(size * size);
  const triangleVertexMass = densityKgM2 * spacing ** 2 / 6;
  for (const index of triangles) masses[index] += triangleVertexMass;
  const pins = [0, size - 1];
  const inverseMasses = Float64Array.from(masses, (mass, index) =>
    pins.includes(index) ? 0 : 1 / mass);
  const edge = (a, b, kind) => {
    const rest = Math.hypot(...[0, 1, 2].map(axis => positions[3 * a + axis] - positions[3 * b + axis]));
    constraints.push({ a, b, rest, kind, lambda: 0 });
  };
  for (let z = 0; z < size; z++) for (let x = 0; x < size; x++) {
    const a = z * size + x;
    if (x + 1 < size) edge(a, a + 1, 'stretch');
    if (z + 1 < size) edge(a, a + size, 'stretch');
    if (x + 1 < size && z + 1 < size) {
      edge(a, a + size + 1, 'shear');
      edge(a + 1, a + size, 'shear');
    }
    if (x + 2 < size) edge(a, a + 2, 'bend-distance');
    if (z + 2 < size) edge(a, a + 2 * size, 'bend-distance');
  }
  return { positions, restPositions: positions.slice(), inverseMasses, pins,
    triangles: Uint16Array.from(triangles), constraints, totalMassKg: masses.reduce((a, b) => a + b, 0) };
}

// The materials a body can be made of (a body's look names one; the part has a default), by density.
export const MATERIALS = [
  { id: 'al6061', label: 'Aluminium 6061', gPerCm3: 2.70 }, { id: 'steel', label: 'Steel (mild)', gPerCm3: 7.85 }, { id: 'ss304', label: 'Stainless 304', gPerCm3: 8.00 },
  { id: 'brass', label: 'Brass', gPerCm3: 8.50 }, { id: 'ti64', label: 'Titanium Ti-6Al-4V', gPerCm3: 4.43 }, { id: 'abs', label: 'ABS', gPerCm3: 1.04 },
  { id: 'pla', label: 'PLA', gPerCm3: 1.24 }, { id: 'pa12', label: 'Nylon PA12', gPerCm3: 1.01 },
];
/** A material by id (the first, aluminium, for none or an unknown one). */
export const materialOf = (id: string | undefined) => MATERIALS.find(m => m.id === id) ?? MATERIALS[0];

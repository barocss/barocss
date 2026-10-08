// Normalization cancels in the measured density ratio and its constraint gradient.
export function densityKernel(distanceSquared, radiusSquared) {
  const q = 1 - distanceSquared / radiusSquared;
  return q > 0 ? q * q * q : 0;
}

export function gradientScale(distanceSquared, radiusSquared) {
  const q = 1 - distanceSquared / radiusSquared;
  return q > 0 ? -6 * q * q / radiusSquared : 0;
}

export function densities(positions, grid, radiusSquared, output) {
  grid.rebuild(positions);
  for (let index = 0; index < output.length; index++) {
    let density = 0;
    grid.each(index, (_other, _x, _y, _z, distanceSquared) => {
      density += densityKernel(distanceSquared, radiusSquared);
    });
    output[index] = density;
  }
  return output;
}

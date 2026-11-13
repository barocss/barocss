import type { DrawingDimension } from './types';

/** The geometry names an authored dimension reads, including pitch circle members. */
export function dimensionEdgeNames(dim: DrawingDimension): (string | undefined)[] {
  if (dim.kind === 'linear') return [dim.a?.edge, dim.b?.edge, ...(dim.a?.ring ?? []).map(member => member.edge), ...(dim.b?.ring ?? []).map(member => member.edge)];
  if (dim.kind === 'angle') return [dim.a?.edge, dim.b?.edge];
  if (dim.kind === 'pcd') return (dim.ring ?? []).map(member => member.edge);
  return [dim.edge];
}

/** The occurrence path prefix of a projected compound edge. */
export function drawingOccurrencePath(edge: string): string | undefined {
  const firstFace = edge.split('|', 1)[0], slash = firstFace.lastIndexOf('/');
  return slash > 0 ? firstFace.slice(0, slash) : undefined;
}

// Kernel refusals are precise but written for kernel authors. Map them to what a designer can act on.
export interface FriendlyError { title: string; hint: string; detail: string }

const rules: { test: RegExp; title: string; hint: string }[] = [
  { test: /misses the target/i,
    title: 'The hole misses the body',
    hint: 'Move the centre onto the body (a hole may run off an edge as a notch, but it must cut something).' },
  { test: /no edge named/i,
    title: 'The selected edge no longer exists',
    hint: 'An earlier edit changed the shape around it. Select the edge again and re-apply the chamfer or fillet.' },
  { test: /too large for walls/i,
    title: 'The chamfer or fillet is too large',
    hint: 'It must be shorter than both walls meeting at the corner. Use a smaller size.' },
  { test: /only vertical edges can be filleted|corners between two straight walls/i,
    title: 'This edge can’t be rounded yet',
    hint: 'Fillets round vertical corners between two straight walls (corners seen from above).' },
  { test: /branch points|touch tangentially/i,
    title: 'These round features only graze each other',
    hint: 'Two crossing cylinders that touch tangentially meet in curves the kernel can’t represent yet. Move one so it passes clearly through the other, or keep them apart.' },
  { test: /need(s)? an upright/i,
    title: 'This needs an upright body',
    hint: 'Fillets work on bodies built along Z. Turn the body back, or fillet before rotating it about X or Y.' },
  { test: /multiples of 90/i,
    title: 'Only quarter turns about X and Y',
    hint: 'Rotate about X or Y by 90°, 180° or 270°. About Z any angle works.' },
  { test: /does not cross the target/i,
    title: 'The split plane misses the body',
    hint: 'Choose a position between the body’s minimum and maximum along that axis.' },
  { test: /crosses itself/i,
    title: 'The outline crosses itself',
    hint: 'Move a point or bend an arc the other way so the outline does not overlap itself.' },
  { test: /not on one circle|full circle|radius .* is below|encloses no area|is degenerate/i,
    title: 'This outline isn’t a valid profile',
    hint: 'Each arc needs a radius of at least half its chord, points must not repeat, and the outline must enclose an area.' },
  { test: /must be positive|must not be zero|below max/i,
    title: 'Sizes must be greater than zero',
    hint: 'Every width, depth, height and radius needs a positive value.' },
  { test: /within ±10000|at most 10000/i,
    title: 'The value is out of range',
    hint: 'Lengths are limited to ±10000 mm.' },
  { test: /edges must list/i,
    title: 'This chamfer has no edges',
    hint: 'Select the edges again and re-apply it (files saved before edges had names keep the chamfer without its selection).' },
  { test: /touches the axis|crosses the axis/i,
    title: 'The profile reaches the revolve axis',
    hint: 'Draw the profile beside the axis (the sketch’s X or Y axis), not on or across it.' },
  { test: /not a manifold solid|touch along an edge or at a vertex/i,
    title: 'The bodies only touch along an edge or a point',
    hint: 'Overlap the bodies (or keep them apart) so the result is a proper solid.' },
];

export function friendly(message: string): FriendlyError {
  const detail = message.replace(/^n\d+:\s*/, '').trim();
  for (const rule of rules) if (rule.test.test(message)) return { title: rule.title, hint: rule.hint, detail };
  return { title: 'The kernel could not build this', hint: 'Undo the last change, or adjust the values and try again.', detail };
}

// G15d.1–2: the Render workspace's post as the viewer's environment takes it — the grade's preset (white balance and a
// split tone: warm shadows lifted amber, highlights a little cooled, or the reverse), the contrast and saturation over
// it, the vignette and the bloom. Neutral at 1, 1 and no vignette: nothing, and the output pass skips the grading.
import type { ColorGrading, Environment } from '@barocss/gpu/viewer';
import type { RenderPost } from '@barocss/cad-model/engine/render';

/** The grades: a warm studio (amber, the shadows lifted warm) and a cool daylight (blue, the shadows lifted cool). */
export const GRADES: Readonly<Record<RenderPost['grade'], ColorGrading>> = {
  neutral: {},
  warm: { temperature: 0.35, tint: 0.05, lift: [0.02, 0.012, 0], gain: [1.02, 1, 0.96] },
  cool: { temperature: -0.35, lift: [0, 0.008, 0.022], gain: [0.97, 1, 1.03] },
};
/** The vignette's clear radius and fade (shares of the half-diagonal): a lens's, soft and wide. */
const VIGNETTE = { size: 0.45, softness: 0.65 };

/** Bloom at its slider's end: the share of the light above white added back as its glow. */
const BLOOM_MAX = 0.2;

/** The viewer's grading, vignette and bloom for the settings' post (none: none of them). */
export function postOf(post: RenderPost | undefined): Pick<Environment, 'grading' | 'vignette' | 'bloom' | 'depthOfField'> {
  if (!post) return {};
  const graded = post.grade !== 'neutral' || post.contrast !== 1 || post.saturation !== 1;
  return {
    ...(graded ? { grading: { ...GRADES[post.grade], contrast: post.contrast, saturation: post.saturation } } : {}),
    ...(post.vignette > 0 ? { vignette: { amount: post.vignette, ...VIGNETTE } } : {}),
    // (G15d.2: the slider's 0 – 1 as up to a fifth of the bright light added back as glow.)
    ...(post.bloom ? { bloom: { strength: post.bloom * BLOOM_MAX } } : {}),
    // Focus stays in scene units; blur stays in CSS pixels, independent of device pixel ratio.
    ...(post.depthOfField && post.depthOfField.blur > 0 ? { depthOfField: { ...post.depthOfField } } : {}),
  };
}

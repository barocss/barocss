import { buildMultiSpanVLinearSurfacePlaneSection } from '../intersect/multispan-vlinear-plane-section.js';
import type { MultiSpanVLinearSurfacePlaneSectionAsset } from '../intersect/multispan-vlinear-plane-section.js';
import { buildSectionExactSurfaceBinding } from '../section-exact-surface-binding.js';
import { buildExactSurfaceLowerTrim } from '../exact-proof/exact-surface-lower-trim.js';
import { buildPairedSectionPlaneCap } from '../paired/paired-section-plane-cap.js';
import { buildTranslatedSurfaceBaseFace } from './translated-surface-base-face.js';
import { buildTranslatedSurfaceEndFaces } from './translated-surface-end-faces.js';
import { measureTranslatedSurfaceStripVolume } from './translated-surface-strip-volume.js';
import { buildQualifiedTranslatedStripBody } from './qualified-translated-strip-body.js';
import type { QualifiedTranslatedStripBodyResult } from './qualified-translated-strip-body.js';
import type { SectionRationalContext } from '../section-rational-internal.js';
import type { TranslatedStripIntervalBooleanOutput } from './translated-strip-interval-boolean.js';

/** Source authority is selected and fully validated by the public core, never generated here. */
export type TranslatedStripIntervalConstructionDonor = {
  operand:'a'|'b';side:'lower'|'upper';bodyId:string;
  asset:MultiSpanVLinearSurfacePlaneSectionAsset;
};
export type TranslatedStripIntervalConstructionPair = {
  componentIndex:number;
  lower:TranslatedStripIntervalConstructionDonor;
  upper:TranslatedStripIntervalConstructionDonor;
  planeAsset:MultiSpanVLinearSurfacePlaneSectionAsset;
};
export type TranslatedStripIntervalConstructionCheck = (condition:boolean,detail:string)=>void;
export type TranslatedStripIntervalConstructionReceipt = {
  body:QualifiedTranslatedStripBodyResult;
  recipe:TranslatedStripIntervalBooleanOutput['recipe'];
  directCounts:{
    sectionBuildCount:2;bindingBuildCount:2;wallBuildCount:2;
    capBuildCount:1;baseBuildCount:1;endBuildCount:1;
    volumeBuildCount:1;qualifiedBodyBuildCount:1;
  };
};

/**
 * Private delegation only. The public core admits both complete operands,
 * selects unchanged original endpoint assets, proves the positive interval,
 * and reserves every fresh recipe identity before calling this function.
 * Provider errors propagate unchanged to the core's CONSTRUCTION wrapper.
 */
export function reconstructTranslatedStripIntervalBodyTrusted(
  pair:TranslatedStripIntervalConstructionPair,
  recipe:TranslatedStripIntervalBooleanOutput['recipe'],
  q:SectionRationalContext,
  check:TranslatedStripIntervalConstructionCheck,
):TranslatedStripIntervalConstructionReceipt {
  check(pair.componentIndex===0||pair.componentIndex===1,'Trusted component index must be 0 or 1');
  check(recipe.lowerWall.orientation==='forward'&&recipe.upperWall.orientation==='reverse','Fresh walls must use canonical lower-forward/upper-reverse orientations');
  check(recipe.base.baseLeftCurveId===recipe.ends.baseLeftCurveId&&recipe.base.baseRightCurveId===recipe.ends.baseRightCurveId,'Base and ends must share the same explicit fresh Line identities');
  check(q.counts().floatConversions===0,'Shared root exact context must have no float conversions');

  // Each source/selected Surface is the actual unchanged donor. No offset,
  // literal patch, identity rewrite, or derived Body source substitutes for it.
  const lowerSection=buildMultiSpanVLinearSurfacePlaneSection(pair.lower.asset,pair.planeAsset,recipe.lowerSection);
  const upperSection=buildMultiSpanVLinearSurfacePlaneSection(pair.upper.asset,pair.planeAsset,recipe.upperSection);
  const lowerBinding=buildSectionExactSurfaceBinding(lowerSection,recipe.lowerBinding);
  const upperBinding=buildSectionExactSurfaceBinding(upperSection,recipe.upperBinding);
  const lowerWall=buildExactSurfaceLowerTrim(lowerBinding,recipe.lowerWall);
  const upperWall=buildExactSurfaceLowerTrim(upperBinding,recipe.upperWall);
  const cap=buildPairedSectionPlaneCap(lowerSection,upperSection,recipe.cap);

  // These exact newly produced caller objects feed every sibling. All actual
  // World/UV geometry, source-qualified namespaces and parent proofs survive.
  const base=buildTranslatedSurfaceBaseFace(lowerWall,upperWall,recipe.base);
  const ends=buildTranslatedSurfaceEndFaces(lowerWall,upperWall,cap,recipe.ends);
  const volume=measureTranslatedSurfaceStripVolume(lowerWall,upperWall,cap,recipe.volume);
  const body=buildQualifiedTranslatedStripBody(base,ends,volume,recipe.body);

  check(q.counts().floatConversions===0,'Delegated construction must preserve zero root float conversions');
  return {
    body,recipe,
    // Eleven real calls above. Child validation/source/native work remains in
    // the full Body receipts and is excluded from these direct stage counts.
    directCounts:{sectionBuildCount:2,bindingBuildCount:2,wallBuildCount:2,capBuildCount:1,baseBuildCount:1,endBuildCount:1,volumeBuildCount:1,qualifiedBodyBuildCount:1},
  };
}

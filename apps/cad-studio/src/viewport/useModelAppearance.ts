import { useMemo, useRef } from 'react';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { Vec3 } from '@barocss/cad-model/engine/mesh';
import { bodyNodeOf } from '@barocss/cad-model/engine/ids';
import { lookOf, rgbOf, rootOf } from '@barocss/cad-model/app/bodies';
import type { ProposalOverlay } from '../engine/client';
import type { Active } from '../app/commandState';
import { meshSig, sameMeshes } from '../app/bodyResults';
import { PREVIEW_TINT } from '../app/studioConstants';
import { PROPOSAL_ADDED, PROPOSAL_REMOVED } from './renderer';

export interface AppearanceModel {
  doc: StudioDoc;
  evaluated: StudioDoc;
  bodies: BodyResult[];
}

export interface AppearancePreview {
  active: Active | null;
  previewBodies: BodyResult[] | null;
  routePreviewBodies: BodyResult[] | null;
  /** Pass the original proposal object: the memo follows its identity, not just after. */
  ghost: { after: boolean } | null;
  proposalOverlay: ProposalOverlay | null;
  compareOverlay: ProposalOverlay | null;
}

export interface AppearanceDisplay {
  bodyDrag: boolean;
  section: boolean;
  sketch: boolean;
  sectionBodies: BodyResult[] | null;
  sectionExactShown: boolean;
  /** Pass the original exact-section object, preserving its memo dependency identity. */
  sectionExact: { from: ReadonlyMap<string, string> } | null;
  animatedAt: ReadonlyMap<string, Vec3> | null;
}

export interface ModelAppearanceOptions {
  model: AppearanceModel;
  preview: AppearancePreview;
  display: AppearanceDisplay;
}

/** Drawn-array identity, shown-body precedence and per-index viewport appearance. */
export function useModelAppearance({ model, preview, display }: ModelAppearanceOptions) {
  const { doc, evaluated, bodies } = model;
  const { active, previewBodies, routePreviewBodies, ghost, proposalOverlay, compareOverlay } = preview;
  const { bodyDrag, section, sketch, sectionBodies, sectionExactShown, sectionExact, animatedAt } = display;
  // (O18: the viewport keeps the bodies it has while only their masses come — the same meshes, the same array — so a mass
  // patch is no change of what is drawn: WebGPU rebuilt the part on a new array and left the copies sharing its shapes out.)
  const drawnRef = useRef(bodies);
  if (!sameMeshes(drawnRef.current, bodies)) drawnRef.current = bodies;
  const drawnBodies = drawnRef.current;
  const shownBodies = bodyDrag ? drawnBodies : routePreviewBodies ?? previewBodies ?? (section && sectionBodies && !sketch ? sectionBodies : drawnBodies);
  // The Render workspace's animated offsets on the bodies shown: each by its body's key — an exact section's piece by the
  // body it was cut from (G19.5: by index they fell on other bodies once the section left some out or split them).
  const animatedOffsets = useMemo(() => {
    if (!animatedAt) return undefined;
    const from = shownBodies === sectionBodies && sectionExactShown ? sectionExact!.from : null, out = new Map<number, Vec3>();
    shownBodies.forEach((b, i) => { const o = animatedAt.get(from?.get(b.key) ?? b.key); if (o) out.set(i, o); });
    return out;
  }, [animatedAt, shownBodies, sectionBodies, sectionExactShown, sectionExact]);
  // Bodies' own colours and hidden ones (StudioDoc.bodies), by index of what is shown.
  // (A command's preview: the bodies it adds — first made by one of its new features, not built on a body
  // the part has — tinted, so what is new reads at a glance.)
  const previewNodes = useMemo(() => { if (!active?.cmd.build || !previewBodies) return null; try { return active.cmd.build(active.ctx, active.values).nodes; } catch { return null; } }, [active, previewBodies]);
  const bodyColors = useMemo(() => {
    // (A proposal's ghost: the bodies it adds or changes — not tinted while the engine draws its two-colour overlay, G12.)
    const overlaid = !!ghost && proposalOverlay?.method === 'boolean';
    const had = ghost ? new Set(bodies.map(b => `${b.key}:${meshSig(b.mesh)}`)) : null;
    const fresh = (b: BodyResult) => { if (had) return !had.has(`${b.key}:${meshSig(b.mesh)}`); const at = previewNodes && bodyNodeOf(previewNodes, b.key); return !!previewNodes && !!at && rootOf(previewNodes, at.node) >= evaluated.nodes.length; };
    return new Map(shownBodies.flatMap((b, i) => { const c = shownBodies === routePreviewBodies ? PREVIEW_TINT : lookOf(doc, b).color ?? (shownBodies === previewBodies && fresh(b) && !overlaid ? PREVIEW_TINT : undefined); return c ? [[i, rgbOf(c)] as [number, [number, number, number]]] : []; }));
  }, [shownBodies, doc, previewBodies, routePreviewBodies, previewNodes, evaluated.nodes.length, ghost, bodies, proposalOverlay]);
  const hiddenBodies = useMemo(() => new Set(shownBodies.flatMap((b, i) => lookOf(doc, b).hidden ? [i] : [])), [shownBodies, doc]);
  // Faces coloured on their own, by body index and face index (their names kept with the body's look).
  // (G12: a shown proposal's faces tinted — where the Boolean refused (WebGL2 draws the overlay too, G16) — those it adds or changes
  // green on the after view, those it removes or changes red on the before view.)
  // (CG6: a compared version the same way — the working document is the after view.)
  const proposalTint = useMemo(() => {
    const o = ghost ? proposalOverlay : compareOverlay, after = ghost ? ghost.after : true; if (!o || o.method === 'boolean') return null;
    const on = new Set(o.changedFaces.filter(f => after ? f.kind !== 'removed' : f.kind !== 'added').map(f => f.name));
    return { on, color: rgbOf(after ? PROPOSAL_ADDED : PROPOSAL_REMOVED) };
  }, [proposalOverlay, compareOverlay, ghost]);
  const faceColors = useMemo(() => new Map(shownBodies.flatMap((b, i) => {
    const own = lookOf(doc, b).faces; if (!own && !proposalTint) return [];
    const m = new Map(b.mesh.faces.flatMap(f => { const c = proposalTint?.on.has(f.name) ? proposalTint.color : own?.[f.name] ? rgbOf(own[f.name]) : null; return c ? [[f.index, c] as [number, [number, number, number]]] : []; }));
    return m.size ? [[i, m] as [number, Map<number, [number, number, number]>]] : [];
  })), [shownBodies, doc, proposalTint]);
  // (While placing, the pointer looks through the shape being placed: the preview's new bodies.)
  const placeSkip = useMemo(() => { const have = new Set(bodies.map(b => b.key)); return new Set((previewBodies ?? []).filter(b => !have.has(b.key)).map(b => b.key)); }, [bodies, previewBodies]);
  return { drawnBodies, shownBodies, animatedOffsets, previewNodes, bodyColors, hiddenBodies, proposalTint, faceColors, placeSkip };
}

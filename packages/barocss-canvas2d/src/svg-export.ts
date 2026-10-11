import { Canvas2DError, validateScene, validateSize } from './schema.js';
import type { Color, NodeV5, NodeV29, PathCommand, Scene, SceneV5, SceneV29, Size, Transform } from './schema.js';

export type SVGExportDiagnostic = { nodeId: string | null; code: 'UNSUPPORTED_FEATURE'; feature: string };
export type SVGExportResult =
  | { ok: true; svg: string; sourceIdMap: { sourceId: string; svgId: string }[]; diagnostics: [] }
  | { ok: false; diagnostics: SVGExportDiagnostic[] };

function number(value: number): string { return String(Object.is(value, -0) ? 0 : value); }
function paint(color: Color): string | null {
  const bytes = color.slice(0, 3).map(channel => Math.round(channel * 255));
  if (bytes.some((byte, index) => Math.abs(color[index] - byte / 255) > 1e-12)) return null;
  return `#${bytes.map(byte => byte.toString(16).padStart(2, '0')).join('')}`;
}
function transform(pose: Transform): string | null {
  const parts: string[] = [];
  if (pose.x || pose.y) parts.push(`translate(${number(pose.x)} ${number(pose.y)})`);
  if (pose.rotation) {
    const degrees = pose.rotation * 180 / Math.PI;
    if (Math.abs(degrees) > 360) return null;
    parts.push(`rotate(${number(degrees)})`);
  }
  if (pose.scaleX !== 1 || pose.scaleY !== 1) {
    parts.push(`scale(${number(pose.scaleX)} ${number(pose.scaleY)})`);
  }
  return parts.length ? ` transform="${parts.join(' ')}"` : '';
}
function pathData(commands: PathCommand[]): string {
  return commands.map(command => {
    switch (command.kind) {
      case 'M': case 'L': return `${command.kind} ${number(command.x)} ${number(command.y)}`;
      case 'Q': return `Q ${number(command.cx)} ${number(command.cy)} ${number(command.x)} ${number(command.y)}`;
      case 'C': return `C ${number(command.c1x)} ${number(command.c1y)} ${number(command.c2x)} ` +
        `${number(command.c2y)} ${number(command.x)} ${number(command.y)}`;
      case 'Z': return 'Z';
    }
  }).join(' ');
}

/** Map only representable Scene29 paint/hit semantics to the existing SVG subset. */
function currentSVGScene(scene: SceneV29, size: Size, diagnostics: SVGExportDiagnostic[]): SceneV5 {
  function unsupported(nodeId: string | null, feature: string): void {
    diagnostics.push({ nodeId, code: 'UNSUPPORTED_FEATURE', feature });
  }
  const used = new Set([scene.contextId]);
  function visit(nodes: NodeV29[], inheritedAlpha: number): NodeV5[] {
    return nodes.flatMap((node): NodeV5[] => {
      used.add(node.id);
      if (node.hitMode !== 'auto') unsupported(node.id, 'hitMode must be auto');
      if (node.pivot && (node.pivot.x !== 0 || node.pivot.y !== 0)) {
        unsupported(node.id, 'nonzero pivot has no SVG subset mapping');
      }
      if (node.transform.scaleX <= 0 || node.transform.scaleY <= 0) {
        unsupported(node.id, 'signed scale has no SVG subset mapping');
      }
      // Zero paint keeps hidden geometry/IDs while preserving the renderer's no-hit rule.
      const alpha = node.visible ? inheritedAlpha * node.alpha : 0;
      const base = { id: node.id, layer: node.layer, transform: node.transform };
      if (node.kind === 'group') {
        if (node.hitArea) unsupported(node.id, 'group hitArea has no SVG subset mapping');
        if (node.mask) unsupported(node.id, 'polygon group mask has no SVG subset mapping');
        return [{ kind: 'group', ...base, children: visit(node.children, alpha) }];
      }
      if (node.kind !== 'path') {
        unsupported(node.id, `${node.kind} has no lossless SVG subset mapping`);
        // Unsupported hidden containers do not suppress descendant diagnostics.
        if (node.kind === 'frame') visit(node.children, alpha);
        return [];
      }
      if (node.fill && !('color' in node.fill)) {
        unsupported(node.id, 'gradient fill has no SVG subset mapping');
      }
      if (node.stroke && (node.stroke.cap !== 'butt' || node.stroke.join !== 'bevel' ||
          node.stroke.dash.lengths.length !== 0 || node.stroke.dash.offset !== 0 ||
          node.stroke.miterLimit !== 4)) {
        unsupported(node.id, 'stroke requires butt/bevel, empty zero-offset dash and miterLimit 4');
      }
      function color(value: Color): Color { return [value[0], value[1], value[2], value[3] * alpha]; }
      return [{ kind: 'path', ...base, commands: node.commands,
        ...(node.fill && 'color' in node.fill
          ? { fill: { rule: node.fill.rule, color: color(node.fill.color) } } : {}),
        ...(node.stroke ? { stroke: { width: node.stroke.width, color: color(node.stroke.color) } } : {}) }];
    });
  }
  const canonical: SceneV5 = { version: 5, unit: scene.unit, contextId: scene.contextId,
    nodes: visit(scene.nodes, 1) };
  if (diagnostics.length) return canonical;
  function generated(prefix: string): string {
    let index = 1;
    while (used.has(`${prefix}${index}`)) index++;
    const id = `${prefix}${index}`;
    used.add(id);
    return id;
  }
  // Model the unchanged importer's generated IDs and parsed numeric values before success.
  const viewId = generated('SvgViewBox'), frameId = generated('SvgViewport');
  const identity = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
  function importedNodes(nodes: NodeV5[]): NodeV5[] {
    return nodes.map(node => {
      const base = { id: node.id, layer: node.layer, transform: { ...node.transform,
        rotation: (node.transform.rotation * 180 / Math.PI) * Math.PI / 180 } };
      if (node.kind === 'group') return { ...base, kind: 'group', children: importedNodes(node.children) };
      if (node.kind !== 'path') return node;
      function color(value: Color): Color {
        return [Math.round(value[0] * 255) / 255, Math.round(value[1] * 255) / 255,
          Math.round(value[2] * 255) / 255, value[3]];
      }
      return { ...base, kind: 'path', commands: node.commands,
        ...(node.fill ? { fill: { rule: node.fill.rule, color: color(node.fill.color) } } : {}),
        ...(node.stroke ? { stroke: { width: node.stroke.width, color: color(node.stroke.color) } } : {}) };
    });
  }
  try {
    validateScene({ ...canonical, nodes: [{ kind: 'frame', id: frameId, layer: 0,
      transform: { ...identity }, width: size.width, height: size.height, fill: [0, 0, 0, 0], clip: true,
      children: [{ kind: 'group', id: viewId, layer: 0, transform: { ...identity },
        children: importedNodes(canonical.nodes) }] }] });
  } catch (error) {
    if (!(error instanceof Canvas2DError)) throw error;
    unsupported(null, `SVG importer wrapper admission: ${error.code}: ${error.message}`);
  }
  return canonical;
}

export function exportSceneSVG(input: unknown, logicalSize: Size): SVGExportResult {
  const accepted = validateScene(input);
  const { size } = validateSize(logicalSize, 1);
  const diagnostics: SVGExportDiagnostic[] = [];
  const scene = accepted.version === 29 ? currentSVGScene(accepted, size, diagnostics) : accepted;
  if (diagnostics.length) return { ok: false, diagnostics };
  if (scene.version !== 5) {
    diagnostics.push({ nodeId: null, code: 'UNSUPPORTED_FEATURE', feature: 'scene version must be 5' });
    function inspect(nodes: Scene['nodes']): void {
      for (const node of nodes) {
        if (node.kind === 'group' && 'mask' in node && node.mask) {
          diagnostics.push({ nodeId: node.id, code: 'UNSUPPORTED_FEATURE', feature: 'polygon group mask has no SVG subset mapping' });
        }
        if (node.kind !== 'group' && node.kind !== 'path') {
          diagnostics.push({ nodeId: node.id, code: 'UNSUPPORTED_FEATURE',
            feature: `${node.kind} has no lossless SVG subset mapping` });
        }
        if (node.kind === 'group' || node.kind === 'frame') inspect(node.children);
      }
    }
    inspect(scene.nodes);
    return { ok: false, diagnostics };
  }
  const sourceIdMap = [{ sourceId: scene.contextId, svgId: scene.contextId }];
  function unsupported(nodeId: string, feature: string): void {
    diagnostics.push({ nodeId, code: 'UNSUPPORTED_FEATURE', feature });
  }
  function visit(nodes: SceneV5['nodes']): string[] {
    return nodes.map((node: NodeV5, index) => {
      if (node.layer !== index) unsupported(node.id, 'layer must equal sibling index');
      if (node.id === scene.contextId) unsupported(node.id, 'node ID duplicates SVG root ID');
      const pose = transform(node.transform);
      if (pose === null) unsupported(node.id, 'transform cannot be represented');
      if (node.kind === 'group') {
        sourceIdMap.push({ sourceId: node.id, svgId: node.id });
        const children = visit(node.children);
        return `<g id="${node.id}"${pose ?? ''}>${children.join('')}</g>`;
      }
      if (node.kind !== 'path') {
        unsupported(node.id, `${node.kind} has no lossless SVG subset mapping`);
        return '';
      }
      const attributes = [`id="${node.id}"`, `d="${pathData(node.commands)}"`];
      if (pose) attributes.push(pose.trim());
      if (node.fill) {
        const value = paint(node.fill.color);
        if (value === null) unsupported(node.id, 'fill RGB is outside the 8-bit SVG paint grid');
        else attributes.push(`fill="${value}"`, `fill-rule="${node.fill.rule}"`,
          `fill-opacity="${number(node.fill.color[3])}"`);
      } else attributes.push('fill="none"');
      if (node.stroke) {
        const value = paint(node.stroke.color);
        if (value === null) unsupported(node.id, 'stroke RGB is outside the 8-bit SVG paint grid');
        else attributes.push(`stroke="${value}"`, `stroke-width="${number(node.stroke.width)}"`,
          `stroke-opacity="${number(node.stroke.color[3])}"`,
          'stroke-linejoin="bevel"', 'stroke-linecap="butt"');
      }
      sourceIdMap.push({ sourceId: node.id, svgId: node.id });
      return `<path ${attributes.join(' ')}/>`;
    });
  }
  const children = visit(scene.nodes);
  if (diagnostics.length) return { ok: false, diagnostics };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" id="${scene.contextId}" ` +
    `width="${size.width}" height="${size.height}" viewBox="0 0 ${size.width} ${size.height}" ` +
    `preserveAspectRatio="none">${children.join('')}</svg>`;
  return { ok: true, svg, sourceIdMap, diagnostics: [] };
}

/** Export the Scene29 solid/two-opaque-stop linear subset for native SVG display. */
export function exportSceneLinearSVG(input: unknown, logicalSize: Size): SVGExportResult {
  return exportGradientProfile(input, logicalSize, 'linear');
}

/** Export copied Scene29 solid, linear and concentric opaque radial paint to native SVG. */
export function exportSceneGradientSVG(input: unknown, logicalSize: Size): SVGExportResult {
  return exportGradientProfile(input, logicalSize, 'gradient');
}

function exportGradientProfile(input: unknown, logicalSize: Size, profile: 'linear' | 'gradient'): SVGExportResult {
  const scene = validateScene(input);
  const { size } = validateSize(logicalSize, 1);
  const diagnostics: SVGExportDiagnostic[] = [];
  const used = new Set([scene.contextId]);
  function unsupported(nodeId: string | null, feature: string): void {
    diagnostics.push({ nodeId, code: 'UNSUPPORTED_FEATURE', feature });
  }
  if (scene.version !== 29) unsupported(null, 'scene version must be 29');

  // Inspect the entire copied scene before producing any SVG or assigning definition IDs.
  function inspect(nodes: Scene['nodes']): void {
    nodes.forEach((node, index) => {
      used.add(node.id);
      if (node.layer !== index) unsupported(node.id, 'layer must equal sibling index');
      if (node.id === scene.contextId) unsupported(node.id, 'node ID duplicates SVG root ID');
      if ('hitMode' in node && node.hitMode !== 'auto') unsupported(node.id, 'hitMode must be auto');
      if ('pivot' in node && node.pivot && (node.pivot.x !== 0 || node.pivot.y !== 0)) {
        unsupported(node.id, 'nonzero pivot has no SVG subset mapping');
      }
      if (node.transform.scaleX <= 0 || node.transform.scaleY <= 0) {
        unsupported(node.id, 'signed scale has no SVG subset mapping');
      }
      if (transform(node.transform) === null) unsupported(node.id, 'transform cannot be represented');
      if (node.kind === 'group') {
        if ('hitArea' in node && node.hitArea) unsupported(node.id, 'group hitArea has no SVG subset mapping');
        if ('mask' in node && node.mask) unsupported(node.id, 'polygon group mask has no SVG subset mapping');
        inspect(node.children);
        return;
      }
      if (node.kind !== 'path') {
        unsupported(node.id, `${node.kind} has no lossless SVG subset mapping`);
        if (node.kind === 'frame') inspect(node.children);
        return;
      }
      if ('fill' in node && node.fill) {
        if ('color' in node.fill) {
          if (paint(node.fill.color) === null) unsupported(node.id, 'fill RGB is outside the 8-bit SVG paint grid');
        } else if ('linear' in node.fill) {
          const linear = node.fill.linear;
          if (linear.startColor[3] !== 1 || linear.endColor[3] !== 1) {
            unsupported(node.id, 'linear stop alpha must be 1');
          }
          if (paint(linear.startColor) === null) {
            unsupported(node.id, 'linear start RGB is outside the 8-bit SVG paint grid');
          }
          if (paint(linear.endColor) === null) {
            unsupported(node.id, 'linear end RGB is outside the 8-bit SVG paint grid');
          }
        } else if (profile === 'gradient' && 'radial' in node.fill) {
          const radial = node.fill.radial;
          if (radial.startColor[3] !== 1 || radial.endColor[3] !== 1) unsupported(node.id, 'radial stop alpha must be 1');
          if (paint(radial.startColor) === null) unsupported(node.id, 'radial start RGB is outside the 8-bit SVG paint grid');
          if (paint(radial.endColor) === null) unsupported(node.id, 'radial end RGB is outside the 8-bit SVG paint grid');
        } else unsupported(node.id, 'radial fill has no SVG subset mapping');
      }
      if (node.stroke) {
        if (('cap' in node.stroke && node.stroke.cap !== 'butt') ||
            ('join' in node.stroke && node.stroke.join !== 'bevel') ||
            ('dash' in node.stroke && (node.stroke.dash.lengths.length !== 0 || node.stroke.dash.offset !== 0)) ||
            ('miterLimit' in node.stroke && node.stroke.miterLimit !== 4)) {
          unsupported(node.id, 'stroke requires butt/bevel, empty zero-offset dash and miterLimit 4');
        }
        const strokeColor = 'color' in node.stroke ? node.stroke.color : node.stroke;
        if (paint(strokeColor) === null) {
          unsupported(node.id, 'stroke RGB is outside the 8-bit SVG paint grid');
        }
      }
    });
  }
  inspect(scene.nodes);
  if (scene.version !== 29 || diagnostics.length) return { ok: false, diagnostics };

  const gradientIds = new Map<string, string>();
  let candidateIndex = 0;
  function definitions(nodes: NodeV29[]): void {
    for (const node of nodes) {
      if (node.kind === 'group') definitions(node.children);
      else if (node.kind === 'path' && node.fill && ('linear' in node.fill || (profile === 'gradient' && 'radial' in node.fill))) {
        if (gradientIds.size >= 32) throw new Canvas2DError('SCENE_LIMIT', profile === 'linear' ? 'SVG exceeds 32 linear definitions' : 'SVG exceeds 32 gradient definitions');
        let id: string;
        do {
          if (++candidateIndex > 289) throw new Canvas2DError('SCENE_LIMIT', 'SVG gradient ID search exceeds its bound');
          id = `${profile === 'linear' ? 'C2DLinearGradient' : 'C2DGradient'}${candidateIndex}`;
        } while (used.has(id));
        used.add(id);
        gradientIds.set(node.id, id);
      }
    }
  }
  definitions(scene.nodes);

  // All interpolated data is validated ASCII: IDs, finite numbers and hex colors.
  // Check total code units before storing fragments; ASCII has the same UTF-8 length.
  const fragments: string[] = [];
  let length = 0;
  function append(fragment: string): void {
    if (fragment.length > 1_048_576 - length) {
      throw new Canvas2DError('SCENE_LIMIT', 'SVG output exceeds 1 MiB');
    }
    length += fragment.length;
    fragments.push(fragment);
  }
  append(`<svg xmlns="http://www.w3.org/2000/svg" id="${scene.contextId}" ` +
    `width="${size.width}" height="${size.height}" viewBox="0 0 ${size.width} ${size.height}" ` +
    'preserveAspectRatio="none">');
  function emitDefinitions(nodes: NodeV29[]): void {
    for (const node of nodes) {
      if (node.kind === 'group') emitDefinitions(node.children);
      else if (node.kind === 'path' && node.fill && ('linear' in node.fill || (profile === 'gradient' && 'radial' in node.fill))) {
        const fill = node.fill;
        if ('linear' in fill) {
          const linear = fill.linear;
          append(`<linearGradient id="${gradientIds.get(node.id)}" gradientUnits="userSpaceOnUse" ` +
            'spreadMethod="pad" color-interpolation="sRGB" ' +
            `x1="${number(linear.from.x)}" y1="${number(linear.from.y)}" ` +
            `x2="${number(linear.to.x)}" y2="${number(linear.to.y)}">`);
        } else if ('radial' in fill) {
          const radial = fill.radial;
          append(`<radialGradient id="${gradientIds.get(node.id)}" gradientUnits="userSpaceOnUse" ` +
            'spreadMethod="pad" color-interpolation="sRGB" ' +
            `cx="${number(radial.center.x)}" cy="${number(radial.center.y)}" ` +
            `fx="${number(radial.center.x)}" fy="${number(radial.center.y)}" fr="0" r="${number(radial.radius)}">`);
        }
        const gradient = 'linear' in fill ? fill.linear : 'radial' in fill ? fill.radial : null;
        if (!gradient) continue;
        append(`<stop offset="0" stop-color="${paint(gradient.startColor)}" stop-opacity="1"/>`);
        append(`<stop offset="1" stop-color="${paint(gradient.endColor)}" stop-opacity="1"/>`);
        append('linear' in fill ? '</linearGradient>' : '</radialGradient>');
      }
    }
  }
  if (gradientIds.size) {
    append('<defs>');
    emitDefinitions(scene.nodes);
    append('</defs>');
  }
  const sourceIdMap = [{ sourceId: scene.contextId, svgId: scene.contextId }];
  function emit(nodes: NodeV29[], inheritedAlpha: number): void {
    for (const node of nodes) {
      const alpha = node.visible ? inheritedAlpha * node.alpha : 0;
      const pose = transform(node.transform) ?? '';
      sourceIdMap.push({ sourceId: node.id, svgId: node.id });
      if (node.kind === 'group') {
        append(`<g id="${node.id}"${pose}>`);
        emit(node.children, alpha);
        append('</g>');
        continue;
      }
      // The complete admission pass permits only groups and paths.
      if (node.kind !== 'path') continue;
      const attributes = [`id="${node.id}"`, `d="${pathData(node.commands)}"`];
      if (pose) attributes.push(pose.trim());
      if (node.fill) {
        if ('color' in node.fill) {
          attributes.push(`fill="${paint(node.fill.color)}"`, `fill-rule="${node.fill.rule}"`,
            `fill-opacity="${number(node.fill.color[3] * alpha)}"`);
        } else if ('linear' in node.fill || (profile === 'gradient' && 'radial' in node.fill)) {
          attributes.push(`fill="url(#${gradientIds.get(node.id)})"`, `fill-rule="${node.fill.rule}"`,
            `fill-opacity="${number(alpha)}"`);
        }
      } else attributes.push('fill="none"');
      if (node.stroke) {
        attributes.push(`stroke="${paint(node.stroke.color)}"`, `stroke-width="${number(node.stroke.width)}"`,
          `stroke-opacity="${number(node.stroke.color[3] * alpha)}"`,
          'stroke-linejoin="bevel"', 'stroke-linecap="butt"');
      }
      append(`<path ${attributes.join(' ')}/>`);
    }
  }
  emit(scene.nodes, 1);
  append('</svg>');
  return { ok: true, svg: fragments.join(''), sourceIdMap, diagnostics: [] };
}

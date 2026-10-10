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

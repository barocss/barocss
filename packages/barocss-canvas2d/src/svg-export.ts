import { validateScene, validateSize } from './schema.js';
import type { Color, NodeV5, PathCommand, Scene, SceneV5, Size, Transform } from './schema.js';

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

export function exportSceneSVG(input: unknown, logicalSize: Size): SVGExportResult {
  const scene = validateScene(input);
  const { size } = validateSize(logicalSize, 1);
  const diagnostics: SVGExportDiagnostic[] = [];
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

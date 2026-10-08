import { Canvas2DError, validateScene } from './schema.js';
import type { Color, NodeV5, PathCommand, SceneV5, Transform } from './schema.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const idPattern = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const numberPattern = /[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?/g;
const pathPattern = /[MLQCZ]|[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?/g;
const identity: Transform = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };

export type SVGImportDiagnostics = {
  viewport: { width: number; height: number };
  viewBox: { x: number; y: number; width: number; height: number };
  generatedIds: string[]; pathIds: string[]; groupIds: string[];
};

function unsupported(location: string, feature: string): never {
  throw new Canvas2DError('UNSUPPORTED_FEATURE', `${location}: unsupported ${feature}`);
}
function invalid(location: string, message: string): never {
  throw new Canvas2DError('INVALID_SCENE', `${location}: ${message}`);
}
function attributes(element: Element, names: string[], location: string): void {
  for (const attribute of Array.from(element.attributes)) {
    if (!names.includes(attribute.name)) unsupported(location, `attribute ${attribute.name}`);
  }
}
function children(element: Element, location: string): Element[] {
  const result: Element[] = [];
  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === 1) result.push(child as Element);
    else if (child.nodeType === 3 && child.textContent?.trim()) unsupported(location, 'text content');
    else if (child.nodeType !== 3 && child.nodeType !== 8) unsupported(location, 'XML node');
  }
  return result;
}
function tokens(source: string, pattern: RegExp, location: string): string[] {
  const result: string[] = [];
  pattern.lastIndex = 0;
  let prior = 0, match: RegExpExecArray | null;
  while ((match = pattern.exec(source))) {
    if (!/^[\s,]*$/.test(source.slice(prior, match.index))) unsupported(location, 'syntax');
    result.push(match[0]); prior = pattern.lastIndex;
  }
  if (!/^[\s,]*$/.test(source.slice(prior))) unsupported(location, 'syntax');
  return result;
}
function numbers(source: string, location: string): number[] {
  return tokens(source, numberPattern, location).map(token => {
    const value = Number(token);
    if (!Number.isFinite(value) || Object.is(value, -0) || Math.abs(value) > 1e6) {
      invalid(location, 'number exceeds finite logical-pixel range');
    }
    return value;
  });
}
function pose(source: string | null, location: string): Transform {
  if (source === null || !source.trim()) return { ...identity };
  const transform: Transform = { ...identity };
  const pattern = /(translate|rotate|scale)\s*\(([^)]*)\)/g;
  const order = { translate: 0, rotate: 1, scale: 2 };
  let prior = 0, last = -1, match: RegExpExecArray | null;
  while ((match = pattern.exec(source))) {
    if (source.slice(prior, match.index).trim()) unsupported(location, 'transform syntax');
    const kind = match[1] as keyof typeof order;
    if (order[kind] <= last) unsupported(location, 'transform order or repetition');
    last = order[kind]; prior = pattern.lastIndex;
    const values = numbers(match[2], `${location} ${kind}`);
    if (kind === 'translate') {
      if (values.length < 1 || values.length > 2) unsupported(location, 'translate arguments');
      transform.x = values[0]; transform.y = values[1] ?? 0;
    } else if (kind === 'rotate') {
      if (values.length !== 1 || Math.abs(values[0]) > 360) unsupported(location, 'rotate arguments');
      transform.rotation = values[0] * Math.PI / 180;
    } else {
      if (values.length < 1 || values.length > 2 || values.some(value => value < 0.01 || value > 100)) {
        unsupported(location, 'scale arguments');
      }
      transform.scaleX = values[0]; transform.scaleY = values[1] ?? values[0];
    }
  }
  if (prior === 0 || source.slice(prior).trim()) unsupported(location, 'transform syntax');
  return transform;
}
function commands(source: string, location: string): PathCommand[] {
  const values = tokens(source, pathPattern, location);
  const count = { M: 2, L: 2, Q: 4, C: 6, Z: 0 };
  const result: PathCommand[] = [];
  for (let i = 0; i < values.length;) {
    const kind = values[i++] as keyof typeof count;
    if (!(kind in count)) unsupported(location, `path command ${kind}`);
    const args = values.slice(i, i + count[kind]);
    if (args.length !== count[kind] || args.some(arg => /^[MLQCZ]$/.test(arg))) {
      unsupported(location, `path command ${kind} arguments`);
    }
    const n = numbers(args.join(' '), location); i += count[kind];
    if (kind === 'M' || kind === 'L') result.push({ kind, x: n[0], y: n[1] });
    else if (kind === 'Q') result.push({ kind, cx: n[0], cy: n[1], x: n[2], y: n[3] });
    else if (kind === 'C') result.push({ kind, c1x: n[0], c1y: n[1], c2x: n[2], c2y: n[3], x: n[4], y: n[5] });
    else result.push({ kind: 'Z' });
  }
  if (!result.length) invalid(location, 'path d is empty');
  return result;
}
function color(value: string | null, defaultColor: Color | null, location: string): Color | null {
  if (value === null) return defaultColor;
  if (value === 'none') return null;
  if (!/^#[0-9a-fA-F]{6}$/.test(value)) unsupported(location, `paint ${value}`);
  return [1, 3, 5].map(index => parseInt(value.slice(index, index + 2), 16) / 255)
    .concat(1) as Color;
}
function opacity(value: string | null, location: string): number {
  if (value === null) return 1;
  const parsed = numbers(value, location);
  if (parsed.length !== 1 || parsed[0] < 0 || parsed[0] > 1) invalid(location, 'opacity must be 0..1');
  return parsed[0];
}

export function importSVGElement(root: Element): { scene: SceneV5; diagnostics: SVGImportDiagnostics } {
  if (!root || root.namespaceURI !== SVG_NS || root.localName !== 'svg') {
    unsupported('root', 'non-SVG root');
  }
  if (root.ownerDocument?.doctype) unsupported('root', 'DOCTYPE');
  attributes(root, ['xmlns', 'id', 'width', 'height', 'viewBox', 'preserveAspectRatio'], '<svg>');
  const widthText = root.getAttribute('width'), heightText = root.getAttribute('height');
  if (!widthText || !heightText || !/^\d+$/.test(widthText) || !/^\d+$/.test(heightText)) {
    unsupported('<svg>', 'width/height units or missing size');
  }
  const width = Number(widthText), height = Number(heightText);
  if (width < 1 || width > 8192 || height < 1 || height > 8192) invalid('<svg>', 'viewport exceeds logical-pixel limit');
  const view = root.getAttribute('viewBox');
  if (!view) invalid('<svg>', 'viewBox is required');
  const box = numbers(view, '<svg> viewBox');
  if (box.length !== 4 || box[2] <= 0 || box[3] <= 0) invalid('<svg>', 'viewBox needs x y positive-width positive-height');
  const aspect = root.getAttribute('preserveAspectRatio') ?? 'xMidYMid meet';
  if (aspect !== 'xMidYMid meet' && aspect !== 'none') unsupported('<svg>', 'preserveAspectRatio');
  const scaleX = width / box[2], scaleY = height / box[3];
  const sx = aspect === 'none' ? scaleX : Math.min(scaleX, scaleY);
  const sy = aspect === 'none' ? scaleY : sx;
  const offsetX = aspect === 'none' ? 0 : (width - box[2] * sx) / 2;
  const offsetY = aspect === 'none' ? 0 : (height - box[3] * sy) / 2;
  const viewportPose = { x: offsetX - box[0] * sx, y: offsetY - box[1] * sy,
    scaleX: sx, scaleY: sy, rotation: 0 };

  const explicit = new Set<string>();
  function collect(element: Element): void {
    const id = element.getAttribute('id');
    if (id !== null) {
      if (!idPattern.test(id)) invalid(`<${element.localName}>`, 'id is outside Canvas syntax');
      if (explicit.has(id)) invalid(`<${element.localName}>`, `duplicate id ${id}`);
      explicit.add(id);
    }
    for (const child of children(element, `<${element.localName}>`)) collect(child);
  }
  collect(root);
  const used = new Set(explicit), generatedIds: string[] = [], pathIds: string[] = [], groupIds: string[] = [];
  function generated(prefix: string): string {
    let number = 1;
    while (used.has(`${prefix}${number}`)) number++;
    const id = `${prefix}${number}`; used.add(id); generatedIds.push(id); return id;
  }
  function idFor(element: Element, prefix: string): string {
    return element.getAttribute('id') ?? generated(prefix);
  }
  function visit(element: Element, layer: number): NodeV5 {
    const location = `<${element.localName}${element.getAttribute('id') ? `#${element.getAttribute('id')}` : ''}>`;
    if (element.namespaceURI !== SVG_NS) unsupported(location, 'foreign namespace');
    if (element.localName === 'g') {
      attributes(element, ['id', 'transform'], location);
      const id = idFor(element, 'SvgGroup'); groupIds.push(id);
      return { kind: 'group', id, layer, transform: pose(element.getAttribute('transform'), location),
        children: children(element, location).map((child, index) => visit(child, index)) };
    }
    if (element.localName !== 'path') unsupported(location, `element ${element.localName}`);
    attributes(element, ['id', 'transform', 'd', 'fill', 'fill-rule', 'fill-opacity',
      'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linejoin', 'stroke-linecap', 'opacity'], location);
    if (children(element, location).length) unsupported(location, 'path children');
    if (opacity(element.getAttribute('opacity'), location) !== 1) unsupported(location, 'object opacity');
    const id = idFor(element, 'SvgPath'); pathIds.push(id);
    const fillColor = color(element.getAttribute('fill'), [0, 0, 0, 1], location);
    const strokeColor = color(element.getAttribute('stroke'), null, location);
    const fillRule = element.getAttribute('fill-rule') ?? 'nonzero';
    if (fillRule !== 'nonzero' && fillRule !== 'evenodd') unsupported(location, 'fill-rule');
    if (!fillColor && !strokeColor) invalid(location, 'path needs fill or stroke');
    const strokeWidth = element.getAttribute('stroke-width');
    if (strokeColor) {
      if (element.getAttribute('stroke-linejoin') !== 'bevel') unsupported(location, 'stroke-linejoin');
      if (element.getAttribute('stroke-linecap') !== null &&
          element.getAttribute('stroke-linecap') !== 'butt') unsupported(location, 'stroke-linecap');
    } else if (strokeWidth !== null || element.hasAttribute('stroke-linejoin') ||
        element.hasAttribute('stroke-linecap') || element.hasAttribute('stroke-opacity')) {
      unsupported(location, 'stroke attributes without stroke');
    }
    const widthValue = strokeWidth === null ? 1 : numbers(strokeWidth, `${location} stroke-width`)[0];
    if (strokeColor && (!Number.isFinite(widthValue) || widthValue <= 0 || widthValue > 1000)) {
      invalid(location, 'stroke-width is outside Canvas range');
    }
    const d = element.getAttribute('d');
    if (d === null) invalid(location, 'path d is required');
    return { kind: 'path', id, layer, transform: pose(element.getAttribute('transform'), location),
      commands: commands(d, location),
      ...(fillColor ? { fill: { color: [...fillColor.slice(0, 3),
        fillColor[3] * opacity(element.getAttribute('fill-opacity'), location)] as Color, rule: fillRule } } : {}),
      ...(strokeColor ? { stroke: { color: [...strokeColor.slice(0, 3),
        strokeColor[3] * opacity(element.getAttribute('stroke-opacity'), location)] as Color,
        width: widthValue } } : {}),
    };
  }
  const rootChildren = children(root, '<svg>').map((child, index) => visit(child, index));
  const viewId = generated('SvgViewBox'), frameId = generated('SvgViewport');
  const scene: SceneV5 = { version: 5, unit: 'logical-px', contextId: root.getAttribute('id') ?? 'SvgImport',
    nodes: [{ kind: 'frame', id: frameId, layer: 0, transform: { ...identity },
      width, height, fill: [0, 0, 0, 0], clip: true,
      children: [{ kind: 'group', id: viewId, layer: 0, transform: viewportPose,
        children: rootChildren }] }] };
  const accepted = validateScene(scene);
  if (accepted.version !== 5) invalid('<svg>', 'internal scene version');
  return { scene: accepted, diagnostics: { viewport: { width, height },
    viewBox: { x: box[0], y: box[1], width: box[2], height: box[3] },
    generatedIds, pathIds, groupIds } };
}

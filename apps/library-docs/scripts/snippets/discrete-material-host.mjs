import * as DiscreteMaterialAPI from '@barocss/gpu';

const sourceProfile = '23321ac563f7ec5335d755239534d0a17da303d2';
const width = 640, height = 400;
function expressionWork(expression) {
  let nodes = 0, depth = 0;
  function visit(node, d = 1) {
    nodes++; depth = Math.max(depth, d);
    if (node.kind === 'unary') visit(node.value, d + 1);
    if (node.kind === 'binary') { visit(node.left, d + 1); visit(node.right, d + 1); }
    if (node.kind === 'call') node.args.forEach(child => visit(child, d + 1));
    if (node.kind === 'select') [node.value, node.threshold, node.below, node.otherwise].forEach(child => visit(child, d + 1));
  }
  visit(expression);
  return { nodes, depth, scope: 'Complete final expanded IR; compiler also charges definitions and reuse' };
}
function encodedRGB(linearRGB) {
  return linearRGB.map(value => Math.round(255 * (value <= .0031308 ? 12.92 * value : 1.055 * Math.pow(value, 1 / 2.4) - .055)));
}
function compile(source) {
  const result = DiscreteMaterialAPI.compileDiscreteMeshMaterial(source);
  if (!result.ok) {
    const diagnostic = result.diagnostics[0], error = new Error(diagnostic.message);
    Object.assign(error, { name: 'MeshMaterialError', code: diagnostic.code, diagnostics: result.diagnostics });
    throw error;
  }
  return DiscreteMaterialAPI.validateDiscreteMeshMaterialIR(result.material);
}
/** Canvas2D is only a display for public CPU values; lowered GLSL is not executed. */
export function createExample(canvas, key, source) {
  if (key !== 'discrete-material') throw Error('Unknown discrete material example');
  const context = canvas.getContext('2d');
  if (!context) throw Error('Canvas2D is required');
  let accepted, disposed = false;
  function ensureLive() { if (disposed) throw Error('Discrete material example is disposed'); }
  function candidate(text, level) {
    const material = compile(text);
    const lowered = DiscreteMaterialAPI.lowerDiscreteMeshMaterial(material);
    const sample = DiscreteMaterialAPI.evaluateDiscreteAuthoredMaterial({ material, uniforms: { level } });
    const references = [.49, .5, .51].map(value => {
      const reference = DiscreteMaterialAPI.evaluateDiscreteAuthoredMaterial({ material, uniforms: { level: value } });
      return { level: value, linearRGB: [...reference.linearRGB], sRGB8: encodedRGB(reference.linearRGB) };
    });
    const report = { backend: 'Public CPU material evaluation → app Canvas2D swatches', sourceProfile,
      level, linearRGB: [...sample.linearRGB], sRGB8: encodedRGB(sample.linearRGB), references,
      canonicalExpression: expressionWork(material.expression), shaderId: material.shaderId,
      materialProfile: material.profile, sampleProfile: sample.profile, source: text,
      material, sample, lowered, actualGL: false, displayEncoding: 'Standard piecewise linear RGB → sRGB, rounded to 8-bit channels',
      logicalSize: [width, height], shaderExecution: 'Lowered GLSL retained as text; not linked or executed' };
    const bitmap = canvas.ownerDocument.createElement('canvas'); bitmap.width = width; bitmap.height = height;
    const draw = bitmap.getContext('2d'); if (!draw) throw Error('Canvas2D staging is required');
    draw.fillStyle = '#101820'; draw.fillRect(0, 0, width, height);
    draw.font = 'bold 22px sans-serif'; draw.fillStyle = '#EDF3F8'; draw.fillText('Discrete threshold palette', 28, 38);
    draw.font = '15px sans-serif'; draw.fillStyle = '#B7C7D5'; draw.fillText('CPU linear RGB → sRGB8 display · no GPU shader execution', 28, 65);
    references.forEach((entry, index) => {
      const x = 28 + index * 202;
      draw.fillStyle = `rgb(${entry.sRGB8.join(',')})`; draw.fillRect(x, 94, 180, 93);
      draw.fillStyle = '#EDF3F8'; draw.fillText(`Reference level ${entry.level}`, x, 211);
    });
    draw.fillStyle = `rgb(${report.sRGB8.join(',')})`; draw.fillRect(28, 242, 584, 89);
    draw.fillStyle = '#EDF3F8'; draw.font = 'bold 17px sans-serif'; draw.fillText(`Current level ${level} · sRGB8 [${report.sRGB8.join(', ')}]`, 28, 359);
    draw.font = '13px sans-serif'; draw.fillStyle = '#B7C7D5'; draw.fillText(`linear RGB [${report.linearRGB.map(value => value.toFixed(6)).join(', ')}]`, 28, 384);
    return { report, bitmap };
  }
  function adopt(next) {
    // All compilation, evaluation and staging completed before changing the visible canvas.
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    context.drawImage(next.bitmap, 0, 0);
    accepted = next.report; next.bitmap.width = next.bitmap.height = 0;
    return report();
  }
  function report() { return accepted ? structuredClone(accepted) : null; }
  function update(text) { ensureLive(); return adopt(candidate(text, accepted?.level ?? .5)); }
  function setAmount(value) { ensureLive(); return adopt(candidate(accepted.source, value)); }
  function dispose() { if (disposed) return; disposed = true; }
  try { update(source); } catch (error) { dispose(); throw error; }
  return { update, setAmount, report, dispose };
}

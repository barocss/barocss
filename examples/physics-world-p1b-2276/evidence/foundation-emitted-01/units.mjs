// examples/physics-motion-foundations-2276/units.test.ts
import test from "node:test";
import assert from "node:assert/strict";

// packages/barocss-physics/dist/types.js
var PhysicsError = class extends Error {
  code;
  details;
  constructor(code, message, details) {
    super(message);
    this.code = code;
    this.name = "PhysicsError";
    this.details = { code, reason: message, operation: "create", phase: "admission", domain: "world", entityIds: [], accepted: null, ...details };
  }
};

// packages/barocss-physics/dist/index.js
var DT = 1 / 120;
var WALKABLE = Math.cos(10 * Math.PI / 180);

// packages/barocss-cad/dist/core/math.js
function requireValue(condition, message) {
  if (!condition)
    throw new Error(message);
}
function validatePoint(point) {
  requireValue(Array.isArray(point) && point.length === 3, "A control point must have three coordinates");
  for (let axis = 0; axis < 3; axis++) {
    requireValue(Number.isFinite(point[axis]) && Math.abs(point[axis]) <= 1e6, "Coordinates must be finite and within 1e6 mm");
  }
}
function validateWeight(weight) {
  requireValue(Number.isFinite(weight) && weight >= 1e-6 && weight <= 1e6, "Weights must be in [1e-6, 1e6]");
}
function validateKnots(knots, degree, count) {
  requireValue(Number.isInteger(degree) && degree >= 1 && degree <= 5 && degree < count, "Degree must be in 1..5 and smaller than the control point count");
  requireValue(Array.isArray(knots) && knots.length === count + degree + 1, "Knot count must equal control point count + degree + 1");
  for (let i = 0; i < knots.length; i++) {
    requireValue(Number.isFinite(knots[i]), "Knots must be finite");
    if (i > 0)
      requireValue(knots[i] >= knots[i - 1], "Knots must be nondecreasing");
  }
  const left = knots[degree];
  const right = knots[count];
  requireValue(left < right, "The knot domain must have positive length");
  for (let i = 0; i <= degree; i++) {
    requireValue(knots[i] === left && knots[count + i] === right, "Knots must be open and clamped");
  }
  let repeated = 0;
  let previous = left;
  for (let i = degree + 1; i < count; i++) {
    const value = knots[i];
    requireValue(value > left && value < right, "Endpoint multiplicity must equal degree + 1");
    repeated = value === previous ? repeated + 1 : 1;
    requireValue(repeated <= degree, "Interior knot multiplicity must not exceed degree");
    previous = value;
  }
}
function validateId(id2) {
  requireValue(typeof id2 === "string" && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(id2), "Object ID must be a supported identifier");
}
function validateCurve(curve) {
  requireValue(curve !== null && typeof curve === "object" && curve.kind === "curve", "Expected a curve");
  validateId(curve.id);
  requireValue(Array.isArray(curve.controlPoints) && curve.controlPoints.length >= 2 && curve.controlPoints.length <= 64, "Curve control point count must be in 2..64");
  validateKnots(curve.knots, curve.degree, curve.controlPoints.length);
  requireValue(Array.isArray(curve.weights) && curve.weights.length === curve.controlPoints.length, "Curve weights must match control points");
  for (let index = 0; index < curve.controlPoints.length; index++) {
    validatePoint(curve.controlPoints[index]);
    validateWeight(curve.weights[index]);
  }
}
function validateSurface(surface) {
  requireValue(surface !== null && typeof surface === "object" && surface.kind === "surface", "Expected a surface");
  validateId(surface.id);
  requireValue(Array.isArray(surface.controlPoints) && surface.controlPoints.length >= 2 && surface.controlPoints.length <= 16, "Surface U control point count must be in 2..16");
  const countU = surface.controlPoints.length;
  const firstRow = surface.controlPoints[0];
  requireValue(Array.isArray(firstRow) && firstRow.length >= 2 && firstRow.length <= 16, "Surface V control point count must be in 2..16");
  const countV = firstRow.length;
  requireValue(countU * countV <= 256, "Surface must have at most 256 control points");
  validateKnots(surface.knotsU, surface.degreeU, countU);
  validateKnots(surface.knotsV, surface.degreeV, countV);
  requireValue(Array.isArray(surface.weights) && surface.weights.length === countU, "Surface weight rows must match control points");
  for (let u = 0; u < countU; u++) {
    const points = surface.controlPoints[u];
    const weights = surface.weights[u];
    requireValue(Array.isArray(points) && points.length === countV, "Surface control point grid must be rectangular");
    requireValue(Array.isArray(weights) && weights.length === countV, "Surface weights must match control points");
    for (let v = 0; v < countV; v++) {
      validatePoint(points[v]);
      validateWeight(weights[v]);
    }
  }
}

// packages/barocss-cad/dist/core/vec3.js
var sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
var scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
var dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
var cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
var len = (a) => Math.hypot(a[0], a[1], a[2]);
var unit = (a) => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

// packages/barocss-cad/dist/features/extrusion-validation.js
function dyadic(value) {
  const view4 = new DataView(new ArrayBuffer(8));
  view4.setFloat64(0, value);
  const bits = view4.getBigUint64(0);
  const exponentBits = Number(bits >> 52n & 2047n);
  const fraction = bits & (1n << 52n) - 1n;
  const integer = exponentBits === 0 ? fraction : 1n << 52n | fraction;
  return {
    integer: bits >> 63n === 0n ? integer : -integer,
    exponent: exponentBits === 0 ? -1074 : exponentBits - 1023 - 52
  };
}
function difference(a, b) {
  const exponent = Math.min(a.exponent, b.exponent);
  return {
    integer: (a.integer << BigInt(a.exponent - exponent)) - (b.integer << BigInt(b.exponent - exponent)),
    exponent
  };
}
function product(a, b) {
  return { integer: a.integer * b.integer, exponent: a.exponent + b.exponent };
}
function equal(a, b) {
  return difference(a, b).integer === 0n;
}
function whollyCollinear(curve, vector) {
  const direction = vector.map(dyadic);
  const origin = curve.controlPoints[0].map(dyadic);
  for (let index = 1; index < curve.controlPoints.length; index++) {
    const offset = curve.controlPoints[index].map((value, axis) => difference(dyadic(value), origin[axis]));
    for (let axis = 0; axis < 3; axis++) {
      const next = (axis + 1) % 3;
      if (!equal(product(offset[axis], direction[next]), product(offset[next], direction[axis])))
        return false;
    }
  }
  return true;
}
function preflightExtrusion(curve, options) {
  validateCurve(curve);
  if (curve.controlPoints.length > 16)
    throw new Error("Extrusion supports at most 16 curve control points");
  if (!options || typeof options !== "object")
    throw new Error("Extrusion options are required");
  const { id: id2, vector } = options;
  if (typeof id2 !== "string" || !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(id2) || id2 === curve.id) {
    throw new Error("Extrusion output ID must be a supported ASCII identifier distinct from the curve ID");
  }
  if (!Array.isArray(vector) || vector.length !== 3)
    throw new Error("Extrusion vector must have three coordinates");
  let nonzero = false;
  for (let axis = 0; axis < 3; axis++) {
    if (!Number.isFinite(vector[axis]))
      throw new Error("Extrusion vector must be finite");
    nonzero ||= vector[axis] !== 0;
  }
  if (!nonzero)
    throw new Error("Extrusion vector must be nonzero");
  let translated = false;
  for (const point of curve.controlPoints) {
    for (let axis = 0; axis < 3; axis++) {
      const value = point[axis] + vector[axis];
      if (!Number.isFinite(value) || Math.abs(value) > 1e6)
        throw new Error("Extruded coordinates must be finite and within 1e6 mm");
      translated ||= value !== point[axis];
    }
  }
  if (!translated)
    throw new Error("Extrusion vector produces no representable pole displacement");
  if (whollyCollinear(curve, vector))
    throw new Error("Extrusion is wholly collapsed: all pole displacements are collinear with the vector");
  return { id: id2, vector };
}

// packages/barocss-cad/dist/core/extrusion.js
function extrudeCurve(curve, options) {
  const { id: id2, vector } = preflightExtrusion(curve, options);
  return {
    kind: "surface",
    id: id2,
    degreeU: curve.degree,
    degreeV: 1,
    knotsU: [...curve.knots],
    knotsV: [0, 0, 1, 1],
    controlPoints: curve.controlPoints.map((point) => [
      [point[0], point[1], point[2]],
      [point[0] + vector[0], point[1] + vector[1], point[2] + vector[2]]
    ]),
    weights: curve.weights.map((weight) => [weight, weight])
  };
}

// packages/barocss-cad/dist/language/expression-parser.js
var CAD_EXPRESSION_LIMITS = Object.freeze({ nodes: 256, depth: 32, aggregateNodes: 32768, literalMagnitude: 1e12 });
function parseCadExpression(cursor) {
  let nodes = 0;
  const depth = (tree, ancestors) => {
    if (tree + ancestors > CAD_EXPRESSION_LIMITS.depth)
      cursor.fail("LIMIT", "Expression exceeds AST depth 32");
  };
  const reserve = () => {
    if (nodes >= CAD_EXPRESSION_LIMITS.nodes)
      cursor.fail("LIMIT", "Expression exceeds 256 nodes");
    cursor.reserveNode();
    nodes++;
  };
  const consume = (text) => {
    cursor.skip();
    if (!cursor.source.startsWith(text, cursor.offset()))
      cursor.fail("SYNTAX", "Expected " + text);
    cursor.token();
    cursor.advance(text.length);
  };
  const primary = (ancestors) => {
    cursor.skip();
    const start = cursor.offset();
    depth(1, ancestors);
    if (cursor.source[start] === "(") {
      depth(2, ancestors);
      reserve();
      consume("(");
      const inner = sum(ancestors + 1);
      consume(")");
      depth(inner.depth + 1, ancestors);
      return { expression: { kind: "group", expression: inner.expression, range: cursor.range(start, cursor.offset()) }, depth: inner.depth + 1 };
    }
    if (cursor.source[start] === "$") {
      reserve();
      consume("$");
      const match2 = /^[A-Za-z_][A-Za-z0-9_]*/.exec(cursor.source.slice(cursor.offset()));
      if (!match2)
        cursor.fail("SYNTAX", "Expected parameter identifier");
      cursor.token();
      cursor.advance(match2[0].length);
      return { expression: { kind: "parameter-reference", id: match2[0], range: cursor.range(start, cursor.offset()) }, depth: 1 };
    }
    if (cursor.allowCalls) {
      const name = /^[A-Za-z_][A-Za-z0-9_]*/.exec(cursor.source.slice(start));
      if (name) {
        if (name[0].length > 48)
          cursor.fail("LIMIT", "Function names exceed 48 characters", start, start + name[0].length);
        reserve();
        cursor.token();
        cursor.advance(name[0].length);
        const functionRange = cursor.range(start, cursor.offset());
        consume("(");
        cursor.skip();
        const arguments_ = [], names = /* @__PURE__ */ new Set();
        let treeDepth = 1;
        if (cursor.source[cursor.offset()] !== ")")
          while (true) {
            cursor.skip();
            const argumentStart = cursor.offset();
            if (arguments_.length >= 4)
              cursor.fail("LIMIT", "A call has at most four named arguments", argumentStart);
            const argumentName = /^[A-Za-z_][A-Za-z0-9_]*/.exec(cursor.source.slice(argumentStart));
            if (!argumentName)
              cursor.fail("FUNCTION_ARGUMENT", "A named function argument is required", argumentStart);
            if (argumentName[0].length > 48)
              cursor.fail("LIMIT", "Argument names exceed 48 characters", argumentStart, argumentStart + argumentName[0].length);
            cursor.token();
            cursor.advance(argumentName[0].length);
            const nameRange = cursor.range(argumentStart, cursor.offset());
            cursor.skip();
            if (cursor.source[cursor.offset()] !== ":")
              cursor.fail("FUNCTION_ARGUMENT", "Only named function arguments are supported", argumentStart, cursor.offset());
            if (names.has(argumentName[0]))
              cursor.fail("FUNCTION_ARGUMENT", "Duplicate function argument " + argumentName[0], argumentStart, cursor.offset());
            names.add(argumentName[0]);
            consume(":");
            cursor.reserveRecord?.();
            const parsed = sum(ancestors + 1);
            treeDepth = Math.max(treeDepth, parsed.depth + 1);
            depth(treeDepth, ancestors);
            arguments_.push({
              kind: "named-argument",
              name: argumentName[0],
              nameRange,
              value: parsed.expression,
              range: cursor.range(argumentStart, parsed.expression.range.end)
            });
            cursor.skip();
            if (cursor.source[cursor.offset()] !== ",")
              break;
            consume(",");
            cursor.skip();
            if (cursor.source[cursor.offset()] === ")")
              cursor.fail("FUNCTION_ARGUMENT", "Trailing function argument comma is unsupported");
          }
        consume(")");
        return { expression: {
          kind: "call",
          functionId: name[0],
          functionRange,
          arguments: arguments_,
          range: cursor.range(start, cursor.offset())
        }, depth: treeDepth };
      }
    }
    const match = /^(?:\d+(?:\.\d*)?|\.\d+)/.exec(cursor.source.slice(start));
    if (!match)
      cursor.fail("SYNTAX", "Expected number, $parameter or parenthesized expression");
    const value = Number(match[0]);
    if (!Number.isFinite(value) || value > CAD_EXPRESSION_LIMITS.literalMagnitude)
      cursor.fail("VALUE", "Number magnitude must be finite and at most 1e12", start, start + match[0].length);
    reserve();
    cursor.token();
    cursor.advance(match[0].length);
    const numberEnd = cursor.offset();
    cursor.skip();
    let unit2;
    const unitStart = cursor.offset();
    let unitEnd = unitStart;
    const suffix = /^[A-Za-z_][A-Za-z0-9_]*/.exec(cursor.source.slice(unitStart));
    if (suffix) {
      if (suffix[0] !== "mm" && suffix[0] !== "cm" && suffix[0] !== "m")
        cursor.fail("UNIT", "Unsupported length unit " + suffix[0], unitStart, unitStart + suffix[0].length);
      unit2 = suffix[0];
      cursor.token();
      cursor.advance(suffix[0].length);
      unitEnd = cursor.offset();
    }
    const expression3 = { kind: "number", value, range: cursor.range(start, unit2 ? unitEnd : numberEnd) };
    if (unit2) {
      expression3.unit = unit2;
      expression3.unitRange = cursor.range(unitStart, unitEnd);
    }
    return { expression: expression3, depth: 1 };
  };
  const unary = (ancestors) => {
    cursor.skip();
    const start = cursor.offset(), operator = cursor.source[start];
    if (operator !== "+" && operator !== "-")
      return primary(ancestors);
    depth(2, ancestors);
    reserve();
    consume(operator);
    const operatorRange = cursor.range(start, start + 1);
    const inner = unary(ancestors + 1);
    depth(inner.depth + 1, ancestors);
    return { expression: { kind: "unary", operator, operand: inner.expression, operatorRange, range: cursor.range(start, inner.expression.range.end) }, depth: inner.depth + 1 };
  };
  const binary = (level, ancestors) => {
    const next = level === "product" ? unary : product2;
    let left = next(ancestors);
    while (true) {
      cursor.skip();
      const position = cursor.offset(), operator = cursor.source[position];
      if (!(level === "product" ? operator === "*" || operator === "/" : operator === "+" || operator === "-"))
        return left;
      depth(left.depth + 1, ancestors);
      reserve();
      consume(operator);
      const operatorRange = cursor.range(position, position + 1), right = next(ancestors + 1);
      const treeDepth = Math.max(left.depth, right.depth) + 1;
      depth(treeDepth, ancestors);
      left = { expression: { kind: "binary", operator, left: left.expression, right: right.expression, operatorRange, range: cursor.range(left.expression.range.start, right.expression.range.end) }, depth: treeDepth };
    }
  };
  const product2 = (ancestors) => binary("product", ancestors);
  const sum = (ancestors) => binary("sum", ancestors);
  return sum(0).expression;
}

// packages/barocss-cad/dist/core/barocss-error.js
var BarocssError = class extends Error {
  code;
  where;
  /** What else the refusal carries: the core's own words, the feature it named. */
  details;
  constructor(code, message, where, details) {
    super(`[${code}] ${message.replace(`[${code}] `, "")}`);
    this.name = "BarocssError";
    this.code = code;
    if (where)
      this.where = where;
    if (details)
      this.details = details;
  }
};
var KernelError = class extends BarocssError {
  constructor(message, options) {
    super(options?.code ?? "", "", void 0, options?.details);
    this.name = "Error";
    this.message = message ?? "";
    Reflect.deleteProperty(this, "where");
    if (!options?.details)
      Reflect.deleteProperty(this, "details");
    if (options && "cause" in options)
      Object.defineProperty(this, "cause", { value: options.cause, writable: true, configurable: true, enumerable: false });
  }
};
function kernelRefusal(source2, code, message, cause) {
  const e = new KernelError(message, cause === void 0 ? { code, details: { source: source2 } } : { code, details: { source: source2 }, cause });
  e.name = "BarocssError";
  return e;
}

// packages/barocss-cad/dist/language/source-ast.js
var CadAstError = class extends KernelError {
  code;
  detail;
  range;
  objectId;
  constructor(code, detail, range, objectId) {
    super(detail);
    this.name = "CadAstError";
    this.code = code;
    this.detail = detail;
    this.range = range;
    this.objectId = objectId;
  }
};
var CAD_AST_LIMITS = Object.freeze({ sourceBytes: 262144, values: 65536, nodes: 65536, tokens: 131072, arrayDepth: 3, declarations: 16 });
var curveFields = ["type", "degree", "knots", "control-points", "weights"];
var surfaceFields = ["type", "degree-u", "degree-v", "knots-u", "knots-v", "control-points", "weights"];
var fieldBounds = { knots: [70], "knots-u": [22], "knots-v": [22], "control-points": [64, 3], weights: [64] };
function parseCadAst(source2, sourceVersion) {
  if (typeof source2 !== "string")
    throw new TypeError("Source must be a string");
  if (sourceVersion !== 0 && sourceVersion !== 1 && sourceVersion !== 2 && sourceVersion !== 3)
    throw new TypeError("Source version must be 0, 1, 2 or 3");
  const emptyRange = { start: 0, end: 0, line: 1, column: 1, endLine: 1, endColumn: 1 };
  const utf8BytesWithinLimit = () => {
    let bytes = 0;
    for (let i = 0; i < source2.length; i++) {
      const code = source2.charCodeAt(i), next = source2.charCodeAt(i + 1);
      if (code < 128)
        bytes++;
      else if (code < 2048)
        bytes += 2;
      else if (code >= 55296 && code <= 56319 && next >= 56320 && next <= 57343) {
        bytes += 4;
        i++;
      } else
        bytes += 3;
      if (bytes > CAD_AST_LIMITS.sourceBytes)
        return false;
    }
    return true;
  };
  if (source2.length > CAD_AST_LIMITS.sourceBytes || !utf8BytesWithinLimit()) {
    throw new CadAstError("LIMIT", "Source exceeds 256 KiB", emptyRange);
  }
  const lineStarts = [0];
  for (let i = 0; i < source2.length; i++)
    if (source2[i] === "\n")
      lineStarts.push(i + 1);
  const location = (offset) => {
    let low = 0, high = lineStarts.length;
    while (high - low > 1) {
      const mid = Math.floor((low + high) / 2);
      if (lineStarts[mid] <= offset)
        low = mid;
      else
        high = mid;
    }
    return { line: low + 1, column: offset - lineStarts[low] + 1 };
  };
  const range = (start, end) => {
    const first = location(start), last = location(end);
    return { start, end, ...first, endLine: last.line, endColumn: last.column };
  };
  let at2 = 0, tokens = 0, values = 0, nodes = 0, expressionNodes = 0, geometryCount = 0, parameterCount = 0, functionCount = 0, objectId;
  const declarations = [], modelFields = [];
  const fail2 = (code, detail, start = at2, end = Math.min(source2.length, start + 1)) => {
    throw new CadAstError(code, detail, range(start, end), objectId);
  };
  const chargeToken = () => {
    if (tokens >= CAD_AST_LIMITS.tokens)
      fail2("LIMIT", "Source exceeds AST token limit");
    tokens++;
  };
  const chargeNode = (isValue = false) => {
    if (nodes >= CAD_AST_LIMITS.nodes || isValue && values >= CAD_AST_LIMITS.values)
      fail2("LIMIT", "Source exceeds AST value/node limit");
    nodes++;
    if (isValue)
      values++;
  };
  const skip = () => {
    while (at2 < source2.length) {
      if (/\s/.test(source2[at2])) {
        at2++;
        continue;
      }
      if (source2.startsWith("/*", at2)) {
        const end = source2.indexOf("*/", at2 + 2);
        if (end < 0)
          fail2("SYNTAX", "Unterminated comment");
        at2 = end + 2;
        continue;
      }
      break;
    }
  };
  const take = (token) => {
    skip();
    if (!source2.startsWith(token, at2))
      fail2("SYNTAX", "Expected " + token);
    chargeToken();
    at2 += token.length;
  };
  const ident = (parameter = false) => {
    skip();
    const start = at2, match = (parameter ? /^[A-Za-z_][A-Za-z0-9_]*/ : /^[A-Za-z_][A-Za-z0-9_-]*/).exec(source2.slice(at2));
    if (!match)
      return fail2("SYNTAX", "Expected identifier");
    chargeToken();
    at2 += match[0].length;
    return { value: match[0], range: range(start, at2) };
  };
  const numeric = (required) => {
    skip();
    const start = at2, match = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)/.exec(source2.slice(at2));
    if (!match) {
      if (required)
        fail2("VALUE", "Expected finite decimal literal");
      return void 0;
    }
    chargeToken();
    at2 += match[0].length;
    const value = Number(match[0]);
    if (!Number.isFinite(value))
      fail2("VALUE", "Number must be finite", required ? start : at2, required ? at2 : Math.min(source2.length, at2 + 1));
    chargeNode(true);
    return { kind: "number", value, range: range(start, at2) };
  };
  const expression3 = () => parseCadExpression({
    source: source2,
    offset: () => at2,
    advance: (count) => {
      at2 += count;
    },
    skip,
    allowCalls: sourceVersion === 3,
    reserveRecord: () => chargeNode(),
    token: chargeToken,
    range,
    fail: fail2,
    reserveNode: () => {
      if (expressionNodes >= CAD_EXPRESSION_LIMITS.aggregateNodes)
        fail2("LIMIT", "Model exceeds 32768 aggregate expression nodes");
      chargeNode(true);
      expressionNodes++;
    }
  });
  const astValue = (bounds, depth = 0, expressions = false) => {
    skip();
    const start = at2;
    if (source2[at2] === "[") {
      if (depth >= bounds.length || depth >= CAD_AST_LIMITS.arrayDepth)
        fail2("DIMENSION", "Array nesting exceeds field dimension");
      chargeNode(true);
      take("[");
      const items = [];
      skip();
      if (source2[at2] !== "]")
        while (true) {
          if (items.length >= bounds[depth])
            fail2("LIMIT", "Array exceeds field limit");
          items.push(astValue(bounds, depth + 1, expressions));
          skip();
          if (source2[at2] !== ",")
            break;
          take(",");
          skip();
          if (source2[at2] === "]")
            fail2("SYNTAX", "Trailing comma is unsupported");
        }
      take("]");
      return { kind: "array", items, range: range(start, at2) };
    }
    if (expressions)
      return expression3();
    const number = numeric(false);
    if (number)
      return number;
    const identifier2 = ident();
    chargeNode(true);
    return { kind: "identifier", value: identifier2.value, range: identifier2.range };
  };
  const field = (allowed, surface, seen, mode) => {
    skip();
    const start = at2, key = ident();
    if (!allowed.includes(key.value))
      fail2("FIELD", "Unsupported " + (sourceVersion === 1 && mode !== "literal" ? mode === "model" ? "model " : "extrusion " : "") + "field " + key.value, start, sourceVersion === 1 && mode !== "literal" ? at2 : Math.min(source2.length, start + 1));
    if (sourceVersion === 1 && mode !== "literal" && seen.has(key.value))
      fail2("DUPLICATE", "Duplicate field " + key.value, start, at2);
    take(":");
    let value;
    if (sourceVersion >= 1 && mode === "model") {
      if (key.value === "version")
        value = numeric(true);
      else {
        const identifier2 = ident();
        chargeNode(true);
        value = { kind: "identifier", value: identifier2.value, range: identifier2.range };
      }
    } else if (sourceVersion >= 2 && mode === "parameter" && key.value === "value" || mode === "function") {
      value = expression3();
    } else if (mode === "extrude") {
      if (key.value === "curve") {
        skip();
        const refStart = at2;
        take("#");
        const ref = ident();
        chargeNode(true);
        value = { kind: "reference", id: ref.value, range: range(refStart, at2) };
      } else {
        skip();
        const vectorStart = at2;
        chargeNode(true);
        take("[");
        const x = sourceVersion >= 2 ? expression3() : numeric(true);
        take(",");
        const y = sourceVersion >= 2 ? expression3() : numeric(true);
        take(",");
        const z = sourceVersion >= 2 ? expression3() : numeric(true);
        take("]");
        value = { kind: "array", items: [x, y, z], range: range(vectorStart, at2) };
      }
    } else {
      const bounds = surface && key.value === "control-points" ? [16, 16, 3] : surface && key.value === "weights" ? [16, 16] : fieldBounds[key.value] ?? [];
      value = astValue(bounds, 0, sourceVersion >= 2 && mode === "literal" && key.value !== "type");
    }
    take(";");
    if (seen.has(key.value))
      fail2("DUPLICATE", "Duplicate field " + key.value, start, Math.min(source2.length, start + 1));
    seen.add(key.value);
    chargeNode();
    return { name: key.value, value, range: range(start, at2), nameRange: key.range };
  };
  skip();
  const modelStart = at2;
  chargeNode();
  take("@");
  if (ident().value !== "model")
    fail2("SYNTAX", "Expected @model", sourceVersion === 1 ? 0 : at2);
  const modelIdentifier = ident();
  take("{");
  const headerNames = /* @__PURE__ */ new Set(), ids = /* @__PURE__ */ new Set();
  while (true) {
    skip();
    if (source2[at2] === "}") {
      take("}");
      break;
    }
    objectId = void 0;
    if (source2[at2] !== "@") {
      modelFields.push(field(["version", "length-unit"], false, headerNames, "model"));
      continue;
    }
    const start = at2;
    take("@");
    const kind = ident().value;
    if (!(sourceVersion === 0 ? kind === "curve" || kind === "surface" : sourceVersion === 1 ? kind === "curve" || kind === "extrude" : kind === "curve" || kind === "surface" || kind === "extrude" || kind === "parameter" || sourceVersion === 3 && kind === "function"))
      fail2("KIND", (sourceVersion === 0 ? "Unsupported object " : "Unsupported declaration ") + kind, start, sourceVersion === 0 ? Math.min(source2.length, start + 1) : at2);
    if (kind === "function" ? functionCount >= 8 : kind === "parameter" ? parameterCount >= 64 : geometryCount >= CAD_AST_LIMITS.declarations)
      fail2("LIMIT", kind === "function" ? "Model exceeds 8 functions" : kind === "parameter" ? "Model exceeds 64 parameters" : "Model exceeds 16 geometry declarations", start);
    skip();
    const idStart = at2;
    take("#");
    const identifier2 = ident(kind === "parameter" || kind === "function");
    objectId = identifier2.value;
    if (ids.has(objectId))
      fail2("DUPLICATE", "Duplicate ID " + objectId, start, sourceVersion === 0 ? Math.min(source2.length, start + 1) : at2);
    ids.add(objectId);
    if (kind === "function") {
      if (identifier2.value.length > 48)
        fail2("LIMIT", "Function names exceed 48 characters", identifier2.range.start, identifier2.range.end);
      functionCount++;
      take("(");
      skip();
      const arguments_ = [], formalNames = /* @__PURE__ */ new Set();
      if (source2[at2] !== ")")
        while (true) {
          skip();
          const formalStart = at2;
          if (arguments_.length >= 4)
            fail2("LIMIT", "A function has at most four formal arguments", formalStart);
          const name = ident(true);
          if (name.value.length > 48)
            fail2("LIMIT", "Formal names exceed 48 characters", name.range.start, name.range.end);
          if (formalNames.has(name.value))
            fail2("FUNCTION_ARGUMENT", "Duplicate formal argument " + name.value, name.range.start, name.range.end);
          formalNames.add(name.value);
          take(":");
          const type = ident();
          if (type.value !== "length" && type.value !== "scalar")
            fail2("FUNCTION_TYPE", "Formal type must be length or scalar", type.range.start, type.range.end);
          const quantityKind = type.value === "length" ? "length" : "scalar";
          chargeNode();
          skip();
          let defaultExpression = null;
          if (source2[at2] === "=") {
            take("=");
            defaultExpression = expression3();
          }
          arguments_.push({
            kind: "formal-argument",
            name: name.value,
            nameRange: name.range,
            quantityKind,
            typeRange: type.range,
            defaultExpression,
            range: range(formalStart, defaultExpression?.range.end ?? type.range.end)
          });
          skip();
          if (source2[at2] !== ",")
            break;
          take(",");
          skip();
          if (source2[at2] === ")")
            fail2("FUNCTION_ARGUMENT", "Trailing formal comma is unsupported");
        }
      take(")");
      take(":");
      const returnType = ident();
      if (returnType.value !== "length" && returnType.value !== "scalar")
        fail2("FUNCTION_TYPE", "Function return type must be length or scalar", returnType.range.start, returnType.range.end);
      const returnKind = returnType.value === "length" ? "length" : "scalar";
      take("{");
      const fields3 = [], seen2 = /* @__PURE__ */ new Set();
      while (true) {
        skip();
        if (source2[at2] === "}") {
          take("}");
          break;
        }
        fields3.push(field(["return"], false, seen2, "function"));
      }
      if (fields3.length !== 1)
        fail2("FIELD", "A function requires exactly one return expression", start, at2);
      chargeNode();
      declarations.push({
        kind: "function",
        id: objectId,
        range: range(start, at2),
        idRange: range(idStart, identifier2.range.end),
        arguments: arguments_,
        returnKind,
        returnTypeRange: returnType.range,
        fields: fields3
      });
      continue;
    }
    if (kind === "parameter")
      parameterCount++;
    else
      geometryCount++;
    take("{");
    const fields2 = [], seen = /* @__PURE__ */ new Set();
    while (true) {
      skip();
      if (source2[at2] === "}") {
        take("}");
        break;
      }
      fields2.push(field(kind === "curve" ? curveFields : kind === "surface" ? surfaceFields : kind === "parameter" ? ["type", "value"] : ["curve", "vector"], kind === "surface", seen, kind === "extrude" ? "extrude" : kind === "parameter" ? "parameter" : "literal"));
    }
    chargeNode();
    declarations.push({ kind, id: objectId, range: range(start, at2), idRange: range(idStart, identifier2.range.end), fields: fields2 });
  }
  const modelEnd = at2;
  objectId = void 0;
  skip();
  if (at2 !== source2.length)
    fail2("SYNTAX", "Unexpected content after model");
  return { kind: "model", name: modelIdentifier.value, range: range(modelStart, modelEnd), nameRange: modelIdentifier.range, fields: modelFields, declarations };
}

// packages/barocss-cad/dist/data-copy.js
function copyCadData(value) {
  if (Array.isArray(value))
    return value.map((item) => copyCadData(item));
  if (value !== null && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copyCadData(item)]));
  return value;
}

// packages/barocss-cad/dist/document/parameter-semantics.js
var numericFields = /* @__PURE__ */ new Set(["degree", "degree-u", "degree-v", "knots", "knots-u", "knots-v", "control-points", "weights", "vector"]);
function expression(value, owner) {
  if (value.kind === "number" || value.kind === "parameter-reference" || value.kind === "unary" || value.kind === "binary" || value.kind === "group")
    return value;
  throw new CadAstError("TYPE", "A numeric expression is required", value.range, owner);
}
function references(value) {
  if (value.kind === "call")
    throw new CadAstError("TYPE", "Source2 does not support quantity function calls", value.range);
  if (value.kind === "parameter-reference")
    return [{ id: value.id, range: value.range }];
  if (value.kind === "unary")
    return references(value.operand);
  if (value.kind === "group")
    return references(value.expression);
  if (value.kind === "binary")
    return [...references(value.left), ...references(value.right)];
  return [];
}
function literalMillimetres(value) {
  if (value.kind === "number")
    return value.unit === void 0;
  if (value.kind === "group")
    return literalMillimetres(value.expression);
  if (value.kind === "unary")
    return literalMillimetres(value.operand);
  return false;
}
function resolveCadParameters(ast) {
  const byId = new Map(ast.declarations.map((d) => [d.id, d]));
  const inputs = /* @__PURE__ */ new Map();
  const dependencies = [];
  const edges = /* @__PURE__ */ new Map();
  const leaves = [];
  for (const declaration of ast.declarations) {
    if (declaration.kind === "function")
      throw new CadAstError("TYPE", "Source2 does not support quantity functions", declaration.range, declaration.id);
    if (declaration.kind !== "parameter")
      continue;
    const type = declaration.fields.find((f) => f.name === "type"), value = declaration.fields.find((f) => f.name === "value");
    if (!type || !value)
      throw new CadAstError("FIELD", "Parameter requires type and value", declaration.range, declaration.id);
    if (type.value.kind !== "identifier" || type.value.value !== "length" && type.value.value !== "scalar")
      throw new CadAstError("TYPE", "Parameter type must be length or scalar", type.value.range, declaration.id);
    inputs.set(declaration.id, { declaration, kind: type.value.value, expression: expression(value.value, declaration.id) });
  }
  if (inputs.size > 64)
    throw new CadAstError("LIMIT", "At most 64 parameters are supported", ast.range);
  const addReferences = (owner, value) => {
    const found = references(value);
    for (const ref of found) {
      const target = byId.get(ref.id);
      if (!target)
        throw new CadAstError("REFERENCE", "Undefined parameter " + ref.id, ref.range, owner);
      if (target.kind !== "parameter")
        throw new CadAstError("REFERENCE", ref.id + " is geometry, not a parameter", ref.range, owner);
      dependencies.push({ fromId: owner, toId: ref.id, kind: "parameter-input", span: { ...ref.range } });
    }
    return found;
  };
  for (const declaration of ast.declarations) {
    if (declaration.kind === "parameter") {
      edges.set(declaration.id, addReferences(declaration.id, inputs.get(declaration.id).expression));
      continue;
    }
    if (declaration.kind === "extrude") {
      const curve = declaration.fields.find((f) => f.name === "curve");
      if (!curve)
        throw new CadAstError("FIELD", "Extrusion requires a curve field", declaration.range, declaration.id);
      if (curve.value.kind !== "reference")
        throw new CadAstError("TYPE", "Extrusion curve requires a geometry reference", curve.value.range, declaration.id);
      const target = byId.get(curve.value.id);
      if (!target || target.kind !== "curve")
        throw new CadAstError("REFERENCE", "Reference " + curve.value.id + " must name a curve declaration", curve.value.range, declaration.id);
    }
    for (const field of declaration.fields) {
      if (!numericFields.has(field.name))
        continue;
      const required = field.name === "control-points" || field.name === "vector" ? "length" : "scalar";
      const walk = (value, indices) => {
        if (value.kind === "array") {
          value.items.forEach((item, index) => walk(item, [...indices, index]));
          return;
        }
        const expr = expression(value, declaration.id), refs = addReferences(declaration.id, expr);
        leaves.push({ objectId: declaration.id, field: field.name, indices, expression: expr, required, references: refs.map((r) => r.id) });
      };
      walk(field.value, []);
    }
  }
  const states = /* @__PURE__ */ new Map(), order = [];
  const visit = (id2) => {
    if (states.get(id2) === "done")
      return;
    states.set(id2, "visiting");
    for (const ref of edges.get(id2) ?? []) {
      if (states.get(ref.id) === "visiting")
        throw new CadAstError("CYCLE", "Cyclic parameter dependency through " + ref.id, ref.range, id2);
      visit(ref.id);
    }
    states.set(id2, "done");
    order.push(id2);
  };
  for (const id2 of inputs.keys())
    visit(id2);
  const quantities = /* @__PURE__ */ new Map(), evaluated = /* @__PURE__ */ new WeakMap();
  const checked = (kind, value, range, owner) => {
    if (!Number.isFinite(value) || Math.abs(value) > 1e12)
      throw new CadAstError("VALUE", "Quantity must be finite and within 1e12", range, owner);
    return { kind, value };
  };
  const evaluate2 = (node, owner) => {
    if (node.kind === "call")
      throw new CadAstError("TYPE", "Source2 does not support quantity function calls", node.range, owner);
    const cached = evaluated.get(node);
    if (cached)
      return cached;
    let result;
    if (node.kind === "number") {
      checked("scalar", node.value, node.range, owner);
      const scale3 = node.unit === "m" ? 1e3 : node.unit === "cm" ? 10 : 1;
      result = checked(node.unit ? "length" : "scalar", node.value * scale3, node.unitRange ?? node.range, owner);
    } else if (node.kind === "parameter-reference") {
      const quantity2 = quantities.get(node.id);
      if (!quantity2)
        throw new CadAstError("REFERENCE", "Parameter dependency is unresolved", node.range, owner);
      result = { ...quantity2 };
    } else if (node.kind === "group")
      result = { ...evaluate2(node.expression, owner) };
    else if (node.kind === "unary") {
      const operand = evaluate2(node.operand, owner);
      result = checked(operand.kind, node.operator === "-" ? -operand.value : +operand.value, node.operatorRange, owner);
    } else {
      const left = evaluate2(node.left, owner), right = evaluate2(node.right, owner);
      if (node.operator === "/" && right.value === 0)
        throw new CadAstError("DIVISION_ZERO", "Division by zero is unsupported", node.operatorRange, owner);
      let kind, value;
      if (node.operator === "+" || node.operator === "-") {
        if (left.kind !== right.kind)
          throw new CadAstError("UNIT", "Addition and subtraction require matching quantities", node.operatorRange, owner);
        kind = left.kind;
        value = node.operator === "+" ? left.value + right.value : left.value - right.value;
      } else if (node.operator === "*") {
        if (left.kind === "length" && right.kind === "length")
          throw new CadAstError("UNIT", "Length multiplied by length is unsupported", node.operatorRange, owner);
        kind = left.kind === "length" || right.kind === "length" ? "length" : "scalar";
        value = left.value * right.value;
      } else {
        if (left.kind === "scalar" && right.kind === "length")
          throw new CadAstError("UNIT", "Scalar divided by length is unsupported", node.operatorRange, owner);
        kind = left.kind === right.kind ? "scalar" : "length";
        value = left.value / right.value;
      }
      result = checked(kind, value, node.operatorRange, owner);
    }
    evaluated.set(node, result);
    return result;
  };
  for (const id2 of order) {
    const input = inputs.get(id2), quantity2 = evaluate2(input.expression, id2);
    if (quantity2.kind !== input.kind)
      throw new CadAstError("UNIT", "Parameter value does not match its declared " + input.kind + " type", input.expression.range, id2);
    quantities.set(id2, quantity2);
  }
  const parameters = [...inputs].map(([id2, input]) => {
    const q2 = quantities.get(id2);
    return { id: id2, quantityKind: q2.kind, value: q2.value, unit: q2.kind === "length" ? "mm" : "1", expression: copyCadData(input.expression), span: { ...input.declaration.range } };
  });
  const bindings = [], leafValues = /* @__PURE__ */ new Map();
  for (const leaf of leaves) {
    let quantity2 = evaluate2(leaf.expression, leaf.objectId);
    if (leaf.required === "length" && quantity2.kind === "scalar" && literalMillimetres(leaf.expression))
      quantity2 = { kind: "length", value: quantity2.value };
    if (quantity2.kind !== leaf.required)
      throw new CadAstError("UNIT", "Field " + leaf.field + " requires " + leaf.required, leaf.expression.range, leaf.objectId);
    if (leaf.field.startsWith("degree") && !Number.isInteger(quantity2.value))
      throw new CadAstError("DEGREE", "Degree expression must be an integer", leaf.expression.range, leaf.objectId);
    leafValues.set(leaf.expression, quantity2.value);
    bindings.push({ objectId: leaf.objectId, field: leaf.field, indices: [...leaf.indices], expression: copyCadData(leaf.expression), value: quantity2.value, quantityKind: quantity2.kind, span: { ...leaf.expression.range }, references: [...leaf.references] });
  }
  const resolvedValue = (value) => {
    if (value.kind === "array")
      return { kind: "array", items: value.items.map(resolvedValue), range: { ...value.range } };
    const mapped = leafValues.get(value);
    if (mapped !== void 0 || leafValues.has(value))
      return { kind: "number", value: mapped, range: { ...value.range } };
    return copyCadData(value);
  };
  const resolvedAst = {
    kind: "model",
    name: ast.name,
    range: { ...ast.range },
    nameRange: { ...ast.nameRange },
    fields: copyCadData(ast.fields),
    declarations: ast.declarations.filter((d) => d.kind !== "parameter" && d.kind !== "function").map((d) => ({
      kind: d.kind,
      id: d.id,
      range: { ...d.range },
      idRange: { ...d.idRange },
      fields: d.fields.map((f) => ({ name: f.name, range: { ...f.range }, nameRange: { ...f.nameRange }, value: resolvedValue(f.value) }))
    }))
  };
  return { ast: resolvedAst, parameters, bindings, dependencies };
}

// packages/barocss-cad/dist/document/function-quantity-semantics.js
var numericFields2 = /* @__PURE__ */ new Set(["degree", "degree-u", "degree-v", "knots", "knots-u", "knots-v", "control-points", "weights", "vector"]);
function fail(code, detail, range, owner) {
  throw new CadAstError(code, detail, range, owner);
}
function expression2(value, owner) {
  if (value.kind === "number" || value.kind === "parameter-reference" || value.kind === "unary" || value.kind === "binary" || value.kind === "group" || value.kind === "call")
    return value;
  return fail("TYPE", "A numeric quantity expression is required", value.range, owner);
}
function quantity(kind, value, range, owner) {
  if (!Number.isFinite(value) || Math.abs(value) > 1e12)
    fail("VALUE", "Quantity must be finite and within 1e12", range, owner);
  return { kind, unit: kind === "length" ? "mm" : "1", value };
}
function binaryKind(operator, left, right, range, owner) {
  if (operator === "+" || operator === "-") {
    if (left !== right)
      fail("UNIT", "Addition and subtraction require matching quantities", range, owner);
    return left;
  }
  if (operator === "*") {
    if (left === "length" && right === "length")
      fail("UNIT", "Length multiplied by length is unsupported", range, owner);
    return left === "length" || right === "length" ? "length" : "scalar";
  }
  if (left === "scalar" && right === "length")
    fail("UNIT", "Scalar divided by length is unsupported", range, owner);
  return left === right ? "scalar" : "length";
}
function literalMillimetres2(node) {
  if (node.kind === "number")
    return node.unit === void 0;
  if (node.kind === "unary")
    return literalMillimetres2(node.operand);
  if (node.kind === "group")
    return literalMillimetres2(node.expression);
  return false;
}
function globalReferences(node) {
  if (node.kind === "parameter-reference")
    return [{ id: node.id, range: node.range }];
  if (node.kind === "unary")
    return globalReferences(node.operand);
  if (node.kind === "group")
    return globalReferences(node.expression);
  if (node.kind === "binary")
    return [...globalReferences(node.left), ...globalReferences(node.right)];
  if (node.kind === "call")
    return node.arguments.flatMap((argument) => globalReferences(argument.value));
  return [];
}
function resolveCadFunctionParameters(ast) {
  const byId = new Map(ast.declarations.map((declaration) => [declaration.id, declaration]));
  const definitions = /* @__PURE__ */ new Map();
  const inputs = /* @__PURE__ */ new Map(), globalKinds = /* @__PURE__ */ new Map();
  const leaves = [], dependencies = [];
  const work = {
    limits: {
      maximumFunctions: 8,
      maximumArguments: 4,
      maximumCallDepth: 8,
      maximumCallEntries: 256,
      maximumExpressionEvaluations: 65536,
      maximumDefaultAdmissionEvaluations: 32,
      maximumSuccessUTF16: 16777216,
      maximumSuccessUTF8: 16777216,
      maximumOwnValues: 4194304,
      maximumOwnDepth: 128,
      maximumOwnArray: 65536,
      maximumOwnRecord: 64
    },
    preflight: { callEntries: 0, expressionEvaluations: 0, maximumCallDepth: 0 },
    actual: {
      callEntries: 0,
      defaultAdmissionEvaluations: 0,
      defaultRuntimeEvaluations: 0,
      expressionEvaluations: 0,
      maximumCallDepth: 0
    },
    fileSizes: { success: { utf16: 0, utf8: 0 } },
    ownValues: 0
  };
  for (const declaration of ast.declarations) {
    if (declaration.kind === "function") {
      if (definitions.size >= 8)
        fail("LIMIT", "At most eight quantity functions are supported", declaration.range, declaration.id);
      if (declaration.arguments.length > 4)
        fail("LIMIT", "At most four formal arguments are supported", declaration.range, declaration.id);
      definitions.set(declaration.id, declaration);
    } else if (declaration.kind === "parameter") {
      const type = declaration.fields.find((field) => field.name === "type"), value = declaration.fields.find((field) => field.name === "value");
      if (!type || !value)
        fail("FIELD", "Parameter requires type and value", declaration.range, declaration.id);
      if (type.value.kind !== "identifier" || type.value.value !== "length" && type.value.value !== "scalar")
        fail("TYPE", "Parameter type must be length or scalar", type.value.range, declaration.id);
      inputs.set(declaration.id, { kind: type.value.value, expression: expression2(value.value, declaration.id), span: declaration.range });
      globalKinds.set(declaration.id, type.value.value);
    }
  }
  if (inputs.size > 64)
    fail("LIMIT", "At most 64 global parameters are supported", ast.range, ast.name);
  const body = (definition2) => {
    if (definition2.fields.length !== 1 || definition2.fields[0].name !== "return")
      fail("FUNCTION_TYPE", "A function requires exactly one return expression", definition2.range, definition2.id);
    return expression2(definition2.fields[0].value, definition2.id);
  };
  const infer = (node, environment, owner, scope, callsTo) => {
    if (node.kind === "number")
      return node.unit === void 0 ? "scalar" : "length";
    if (node.kind === "parameter-reference") {
      if (scope === "closed")
        fail("FUNCTION_CAPTURE", "Defaults must be closed expressions without references", node.range, owner);
      const kind = environment.get(node.id);
      if (kind === void 0)
        fail(scope === "formal" ? "FUNCTION_CAPTURE" : "REFERENCE", scope === "formal" ? "A function may reference only its own formal arguments" : "Reference must name a global parameter", node.range, owner);
      return kind;
    }
    if (node.kind === "group")
      return infer(node.expression, environment, owner, scope, callsTo);
    if (node.kind === "unary")
      return infer(node.operand, environment, owner, scope, callsTo);
    if (node.kind === "binary")
      return binaryKind(node.operator, infer(node.left, environment, owner, scope, callsTo), infer(node.right, environment, owner, scope, callsTo), node.operatorRange, owner);
    if (scope === "closed")
      fail("FUNCTION_CAPTURE", "Defaults cannot invoke functions", node.range, owner);
    const definition2 = definitions.get(node.functionId);
    if (!definition2)
      fail("FUNCTION_REFERENCE", "Call must name a declared quantity function", node.functionRange, owner);
    if (node.arguments.length > 4)
      fail("FUNCTION_ARGUMENT", "At most four named arguments are supported", node.range, owner);
    const names = /* @__PURE__ */ new Set();
    for (const argument of node.arguments) {
      if (names.has(argument.name))
        fail("FUNCTION_ARGUMENT", "Duplicate named argument", argument.nameRange, owner);
      names.add(argument.name);
      const formal = definition2.arguments.find((value) => value.name === argument.name);
      if (!formal)
        fail("FUNCTION_ARGUMENT", "Unknown named argument", argument.nameRange, owner);
      const kind = infer(argument.value, environment, owner, scope, callsTo);
      if (kind !== formal.quantityKind)
        fail("FUNCTION_TYPE", "Named argument does not match its formal quantity kind", argument.value.range, owner);
    }
    for (const formal of definition2.arguments)
      if (!names.has(formal.name) && formal.defaultExpression === null)
        fail("FUNCTION_ARGUMENT", "Required named argument is missing", node.range, owner);
    if (callsTo)
      callsTo.push({ id: definition2.id, range: node.functionRange });
    return definition2.returnKind;
  };
  const functionEdges = /* @__PURE__ */ new Map();
  for (const definition2 of definitions.values()) {
    const environment = /* @__PURE__ */ new Map();
    for (const formal of definition2.arguments) {
      if (environment.has(formal.name))
        fail("FUNCTION_ARGUMENT", "Duplicate formal argument", formal.nameRange, definition2.id);
      environment.set(formal.name, formal.quantityKind);
      if (formal.defaultExpression !== null && infer(formal.defaultExpression, /* @__PURE__ */ new Map(), definition2.id, "closed") !== formal.quantityKind)
        fail("FUNCTION_TYPE", "Default quantity does not match its formal kind", formal.defaultExpression.range, definition2.id);
    }
    const edges = [];
    if (infer(body(definition2), environment, definition2.id, "formal", edges) !== definition2.returnKind)
      fail("FUNCTION_TYPE", "Return expression does not match the declared quantity kind", definition2.returnTypeRange, definition2.id);
    functionEdges.set(definition2.id, edges);
  }
  const functionStates = /* @__PURE__ */ new Map();
  const visitFunction = (id2) => {
    if (functionStates.get(id2) === "done")
      return;
    functionStates.set(id2, "visiting");
    for (const edge of functionEdges.get(id2) ?? []) {
      if (functionStates.get(edge.id) === "visiting")
        fail("FUNCTION_RECURSION", "Recursive function calls are unsupported", edge.range, id2);
      visitFunction(edge.id);
    }
    functionStates.set(id2, "done");
  };
  for (const id2 of definitions.keys())
    visitFunction(id2);
  const parameterEdges = /* @__PURE__ */ new Map();
  const references2 = (owner, node) => {
    const refs = globalReferences(node);
    for (const ref of refs) {
      if (byId.get(ref.id)?.kind !== "parameter")
        fail("REFERENCE", "Reference must name a global parameter", ref.range, owner);
      dependencies.push({ fromId: owner, toId: ref.id, kind: "parameter-input", span: { ...ref.range } });
    }
    return refs;
  };
  for (const declaration of ast.declarations) {
    if (declaration.kind === "function")
      continue;
    if (declaration.kind === "parameter") {
      const input = inputs.get(declaration.id);
      if (infer(input.expression, globalKinds, declaration.id, "global") !== input.kind)
        fail("UNIT", "Parameter value does not match its declared quantity kind", input.expression.range, declaration.id);
      parameterEdges.set(declaration.id, references2(declaration.id, input.expression));
      continue;
    }
    if (declaration.kind === "extrude") {
      const curve = declaration.fields.find((field) => field.name === "curve");
      if (!curve)
        fail("FIELD", "Extrusion requires a curve field", declaration.range, declaration.id);
      if (curve.value.kind !== "reference" || byId.get(curve.value.id)?.kind !== "curve")
        fail("REFERENCE", "Extrusion input must name a curve", curve.value.range, declaration.id);
    }
    for (const field of declaration.fields) {
      if (!numericFields2.has(field.name))
        continue;
      const required = field.name === "control-points" || field.name === "vector" ? "length" : "scalar";
      const walk = (value, indices) => {
        if (value.kind === "array") {
          value.items.forEach((item, index) => walk(item, [...indices, index]));
          return;
        }
        const node = expression2(value, declaration.id), kind = infer(node, globalKinds, declaration.id, "global");
        if (kind !== required && !(required === "length" && kind === "scalar" && literalMillimetres2(node)))
          fail("UNIT", "Geometry field requires " + required, node.range, declaration.id);
        leaves.push({
          owner: { objectId: declaration.id, field: field.name, indices },
          expression: node,
          required,
          references: references2(declaration.id, node).map((ref) => ref.id)
        });
      };
      walk(field.value, []);
    }
  }
  const parameterStates = /* @__PURE__ */ new Map(), order = [];
  const visitParameter = (id2) => {
    if (parameterStates.get(id2) === "done")
      return;
    parameterStates.set(id2, "visiting");
    for (const edge of parameterEdges.get(id2) ?? []) {
      if (parameterStates.get(edge.id) === "visiting")
        fail("CYCLE", "Cyclic global parameter dependency", edge.range, id2);
      visitParameter(edge.id);
    }
    parameterStates.set(id2, "done");
    order.push(id2);
  };
  for (const id2 of inputs.keys())
    visitParameter(id2);
  const add3 = (a, b) => ({
    callEntries: Math.min(257, a.callEntries + b.callEntries),
    expressionEvaluations: Math.min(65537, a.expressionEvaluations + b.expressionEvaluations),
    maximumCallDepth: Math.min(9, Math.max(a.maximumCallDepth, b.maximumCallDepth))
  });
  const bodyCosts = /* @__PURE__ */ new Map();
  const cost = (node) => {
    let value = { callEntries: 0, expressionEvaluations: 1, maximumCallDepth: 0 };
    if (node.kind === "unary")
      return add3(value, cost(node.operand));
    if (node.kind === "group")
      return add3(value, cost(node.expression));
    if (node.kind === "binary")
      return add3(add3(value, cost(node.left)), cost(node.right));
    if (node.kind !== "call")
      return value;
    for (const argument of node.arguments)
      value = add3(value, cost(argument.value));
    const definition2 = definitions.get(node.functionId);
    let inner = bodyCosts.get(definition2.id);
    if (!inner) {
      inner = cost(body(definition2));
      bodyCosts.set(definition2.id, inner);
    }
    for (const formal of definition2.arguments)
      if (formal.defaultExpression !== null && !node.arguments.some((argument) => argument.name === formal.name))
        inner = add3(inner, cost(formal.defaultExpression));
    return add3(value, {
      callEntries: Math.min(257, inner.callEntries + 1),
      expressionEvaluations: inner.expressionEvaluations,
      maximumCallDepth: Math.min(9, inner.maximumCallDepth + 1)
    });
  };
  const preflight = (node, owner) => {
    work.preflight = add3(work.preflight, cost(node));
    if (work.preflight.callEntries > 256 || work.preflight.expressionEvaluations > 65536 || work.preflight.maximumCallDepth > 8)
      fail("LIMIT", "Function expansion exceeds call, expression or active-frame limits before numerical evaluation", node.range, owner);
  };
  for (const [id2, input] of inputs)
    preflight(input.expression, id2);
  for (const leaf of leaves)
    preflight(leaf.expression, leaf.owner.objectId);
  const quantities = /* @__PURE__ */ new Map(), globalMemo = /* @__PURE__ */ new WeakMap();
  const calls = [];
  const evaluate2 = (node, owner, environment, memo, frameId, depth, admission = false) => {
    if (!admission) {
      if (work.actual.expressionEvaluations >= 65536)
        fail("LIMIT", "Runtime expression evaluation budget exhausted", node.range, owner.objectId);
      work.actual.expressionEvaluations++;
    }
    const cached = memo.get(node);
    if (cached)
      return { ...cached };
    let result;
    if (node.kind === "number") {
      quantity("scalar", node.value, node.range, owner.objectId);
      const scale3 = node.unit === "m" ? 1e3 : node.unit === "cm" ? 10 : 1;
      result = quantity(node.unit ? "length" : "scalar", node.value * scale3, node.unitRange ?? node.range, owner.objectId);
    } else if (node.kind === "parameter-reference") {
      const found = environment.get(node.id);
      if (!found)
        fail("REFERENCE", "Quantity reference is unresolved in this lexical frame", node.range, owner.objectId);
      result = { ...found };
    } else if (node.kind === "group")
      result = evaluate2(node.expression, owner, environment, memo, frameId, depth, admission);
    else if (node.kind === "unary") {
      const operand = evaluate2(node.operand, owner, environment, memo, frameId, depth, admission);
      result = quantity(operand.kind, node.operator === "-" ? -operand.value : +operand.value, node.operatorRange, owner.objectId);
    } else if (node.kind === "binary") {
      const left = evaluate2(node.left, owner, environment, memo, frameId, depth, admission);
      const right = evaluate2(node.right, owner, environment, memo, frameId, depth, admission);
      if (node.operator === "/" && right.value === 0)
        fail("DIVISION_ZERO", "Division by zero is unsupported", node.operatorRange, owner.objectId);
      const kind = binaryKind(node.operator, left.kind, right.kind, node.operatorRange, owner.objectId);
      const value = node.operator === "+" ? left.value + right.value : node.operator === "-" ? left.value - right.value : node.operator === "*" ? left.value * right.value : left.value / right.value;
      result = quantity(kind, value, node.operatorRange, owner.objectId);
    } else {
      const definition2 = definitions.get(node.functionId);
      const explicit = /* @__PURE__ */ new Map();
      for (const argument of node.arguments)
        explicit.set(argument.name, {
          quantity: evaluate2(argument.value, owner, environment, memo, frameId, depth),
          span: argument.range
        });
      if (work.actual.callEntries >= 256 || depth >= 8)
        fail("LIMIT", "Actual function call or frame budget exhausted", node.range, owner.objectId);
      const nextId = work.actual.callEntries++;
      work.actual.maximumCallDepth = Math.max(work.actual.maximumCallDepth, depth + 1);
      const frame = /* @__PURE__ */ new Map(), localMemo = /* @__PURE__ */ new WeakMap();
      const receipt = {
        frameId: nextId,
        parentFrameId: frameId,
        functionId: definition2.id,
        depth: depth + 1,
        callSpan: { ...node.range },
        definitionSpan: { ...definition2.range },
        owner: copyCadData(owner),
        bindings: [],
        result: { kind: definition2.returnKind, unit: definition2.returnKind === "length" ? "mm" : "1", value: 0 }
      };
      calls.push(receipt);
      for (const formal of definition2.arguments) {
        const supplied = explicit.get(formal.name);
        let bound;
        if (supplied)
          bound = { ...supplied.quantity };
        else {
          work.actual.defaultRuntimeEvaluations++;
          bound = evaluate2(formal.defaultExpression, owner, frame, localMemo, nextId, depth + 1);
        }
        if (bound.kind !== formal.quantityKind)
          fail("FUNCTION_TYPE", "Bound quantity differs from formal type", formal.typeRange, owner.objectId);
        frame.set(formal.name, { ...bound });
        receipt.bindings.push({
          formalName: formal.name,
          quantity: { ...bound },
          origin: supplied ? "explicit" : "default",
          argumentSpan: supplied ? { ...supplied.span } : null,
          formalSpan: { ...formal.range },
          defaultSpan: supplied ? null : { ...formal.defaultExpression.range }
        });
      }
      result = evaluate2(body(definition2), owner, frame, localMemo, nextId, depth + 1);
      if (result.kind !== definition2.returnKind)
        fail("FUNCTION_TYPE", "Actual return quantity differs from signature", definition2.returnTypeRange, owner.objectId);
      receipt.result = { ...result };
    }
    memo.set(node, { ...result });
    return { ...result };
  };
  const functions = [];
  for (const definition2 of definitions.values()) {
    const arguments_ = [];
    for (const formal of definition2.arguments) {
      let defaultQuantity = null;
      if (formal.defaultExpression !== null) {
        if (work.actual.defaultAdmissionEvaluations >= 32)
          fail("LIMIT", "Default admission budget exhausted", formal.range, definition2.id);
        work.actual.defaultAdmissionEvaluations++;
        defaultQuantity = evaluate2(formal.defaultExpression, { objectId: definition2.id, field: "default", indices: [] }, /* @__PURE__ */ new Map(), /* @__PURE__ */ new WeakMap(), null, 0, true);
      }
      arguments_.push({ name: formal.name, quantityKind: formal.quantityKind, defaultQuantity });
    }
    functions.push({ id: definition2.id, declaration: copyCadData(definition2), returnKind: definition2.returnKind, arguments: arguments_ });
  }
  for (const id2 of order) {
    const input = inputs.get(id2);
    const value = evaluate2(input.expression, { objectId: id2, field: "value", indices: [] }, quantities, globalMemo, null, 0);
    if (value.kind !== input.kind)
      fail("UNIT", "Parameter quantity does not match its declared type", input.expression.range, id2);
    quantities.set(id2, value);
  }
  const parameters = [...inputs].map(([id2, input]) => {
    const value = quantities.get(id2);
    return { id: id2, quantityKind: value.kind, value: value.value, unit: value.unit, expression: copyCadData(input.expression), span: { ...input.span } };
  });
  const bindings = [], leafValues = /* @__PURE__ */ new Map();
  for (const leaf of leaves) {
    let value = evaluate2(leaf.expression, leaf.owner, quantities, globalMemo, null, 0);
    if (leaf.required === "length" && value.kind === "scalar" && literalMillimetres2(leaf.expression))
      value = { kind: "length", unit: "mm", value: value.value };
    if (value.kind !== leaf.required)
      fail("UNIT", "Field requires " + leaf.required, leaf.expression.range, leaf.owner.objectId);
    if (leaf.owner.field.startsWith("degree") && !Number.isInteger(value.value))
      fail("DEGREE", "Degree expression must be an integer", leaf.expression.range, leaf.owner.objectId);
    leafValues.set(leaf.expression, value.value);
    bindings.push({
      ...copyCadData(leaf.owner),
      expression: copyCadData(leaf.expression),
      value: value.value,
      quantityKind: value.kind,
      span: { ...leaf.expression.range },
      references: [...leaf.references]
    });
  }
  const resolvedValue = (value) => {
    if (value.kind === "array")
      return { kind: "array", items: value.items.map(resolvedValue), range: { ...value.range } };
    if (leafValues.has(value))
      return { kind: "number", value: leafValues.get(value), range: { ...value.range } };
    return copyCadData(value);
  };
  const resolvedAst = {
    kind: "model",
    name: ast.name,
    range: { ...ast.range },
    nameRange: { ...ast.nameRange },
    fields: copyCadData(ast.fields),
    declarations: ast.declarations.filter((declaration) => declaration.kind !== "function" && declaration.kind !== "parameter").map((declaration) => ({
      kind: declaration.kind,
      id: declaration.id,
      range: { ...declaration.range },
      idRange: { ...declaration.idRange },
      fields: declaration.fields.map((field) => ({ name: field.name, range: { ...field.range }, nameRange: { ...field.nameRange }, value: resolvedValue(field.value) }))
    }))
  };
  return { ast: resolvedAst, parameters, bindings, dependencies, functions, calls, work };
}

// packages/barocss-cad/dist/language/semantic-model.js
function raw(value) {
  if (value.kind === "array")
    return value.items.map(raw);
  if (value.kind === "reference")
    return value.id;
  if (value.kind === "number" || value.kind === "identifier")
    return value.value;
  throw new CadAstError("TYPE", "Resolved numeric values are required", value.range);
}
var zeroRange = () => ({ start: 0, end: 0, line: 1, column: 1, endLine: 1, endColumn: 1 });
function nativeCode(message) {
  if (/^Degree /i.test(message))
    return "DEGREE";
  if (/knot|domain|multiplicity/i.test(message))
    return "KNOTS";
  if (/weight/i.test(message))
    return "WEIGHTS";
  if (/at most|exceed|1e6/i.test(message))
    return "LIMIT";
  if (/three|dimension|point/i.test(message))
    return "DIMENSION";
  return "GEOMETRY";
}
function geometryRange(d, message) {
  if (d.kind === "surface" && (nativeCode(message) === "DEGREE" || nativeCode(message) === "KNOTS"))
    return d.range;
  const keys = nativeCode(message) === "DEGREE" ? ["degree"] : nativeCode(message) === "KNOTS" ? ["knots"] : /weight/i.test(message) ? ["weights"] : ["control-points"];
  return d.fields.find((f) => keys.includes(f.name))?.value.range ?? d.range;
}
function analyzeGeometry(ast, sourceVersion) {
  const nodes = [];
  const literals = /* @__PURE__ */ new Map();
  const byId = new Map(ast.declarations.map((d) => [d.id, d]));
  for (const declaration of ast.declarations) {
    if (declaration.kind === "parameter")
      throw new CadAstError("TYPE", "Unresolved parameter cannot enter geometry validation", declaration.range, declaration.id);
    if (declaration.kind === "function")
      throw new CadAstError("TYPE", "Unresolved function cannot enter geometry validation", declaration.range, declaration.id);
    if (declaration.kind === "extrude") {
      if (!declaration.fields.some((f) => f.name === "curve") || !declaration.fields.some((f) => f.name === "vector"))
        throw new CadAstError("FIELD", "Extrusion requires curve and vector fields", declaration.range, declaration.id);
      continue;
    }
    const props = new Map(declaration.fields.map((f) => [f.name, f]));
    const keys = declaration.kind === "curve" ? ["type", "degree", "knots", "control-points", "weights"] : ["type", "degree-u", "degree-v", "knots-u", "knots-v", "control-points", "weights"];
    for (const key of keys)
      if (!props.has(key))
        throw new CadAstError("FIELD", "Missing field " + key, declaration.range, declaration.id);
    if (raw(props.get("type").value) !== "nurbs")
      throw new CadAstError("VALUE", "Only nurbs is supported", props.get("type").value.range, declaration.id);
    const get = (name) => raw(props.get(name).value);
    const geometry = declaration.kind === "curve" ? {
      kind: "curve",
      id: declaration.id,
      degree: get("degree"),
      knots: get("knots"),
      controlPoints: get("control-points"),
      weights: get("weights")
    } : {
      kind: "surface",
      id: declaration.id,
      degreeU: get("degree-u"),
      degreeV: get("degree-v"),
      knotsU: get("knots-u"),
      knotsV: get("knots-v"),
      controlPoints: get("control-points"),
      weights: get("weights")
    };
    try {
      if (geometry.kind === "curve")
        validateCurve(geometry);
      else
        validateSurface(geometry);
    } catch (error) {
      const message = error.message;
      throw new CadAstError(nativeCode(message), message, geometryRange(declaration, message), declaration.id);
    }
    const suffix = declaration.kind === "surface" ? "[][]" : "[]";
    const fieldTypes = Object.fromEntries(keys.map((key) => [key, key === "type" ? "geometry-kind" : key.startsWith("degree") ? "integer" : key.startsWith("knots") ? "dimensionless[]" : key === "control-points" ? "mm-point3" + suffix : "dimensionless" + suffix]));
    const fields2 = { id: declaration.id, span: { ...declaration.range }, fieldTypes };
    literals.set(declaration.id, geometry.kind === "curve" ? { ...fields2, kind: "curve", geometry } : { ...fields2, kind: "surface", geometry });
  }
  const version = ast.fields.find((f) => f.name === "version"), unit2 = ast.fields.find((f) => f.name === "length-unit");
  if (!version || raw(version.value) !== sourceVersion)
    throw new CadAstError("VERSION", "Declared source version must match sourceVersion: " + sourceVersion, version?.value.range ?? zeroRange());
  if (!unit2 || raw(unit2.value) !== "mm")
    throw new CadAstError("UNIT", "length-unit: mm is required", unit2?.value.range ?? zeroRange());
  if (!ast.declarations.length)
    throw new CadAstError("GEOMETRY", "Model must contain geometry", zeroRange(), void 0);
  const dependencies = [];
  for (const declaration of ast.declarations) {
    if (declaration.kind !== "extrude") {
      nodes.push(literals.get(declaration.id));
      continue;
    }
    const reference = declaration.fields.find((f) => f.name === "curve"), vectorField = declaration.fields.find((f) => f.name === "vector");
    if (!reference || !vectorField)
      throw new CadAstError("FIELD", "Extrusion requires curve and vector fields", declaration.range, declaration.id);
    const inputId = raw(reference.value), input = byId.get(inputId), vector = raw(vectorField.value);
    if (!input || input.kind !== "curve") {
      const detail = !input ? "Undefined curve reference " + inputId : "Reference " + inputId + " has kind " + input.kind + "; a curve is required";
      throw new CadAstError("REFERENCE", detail, reference.value.range, declaration.id);
    }
    const curve = literals.get(inputId).geometry;
    try {
      preflightExtrusion(curve, { id: declaration.id, vector });
    } catch (error) {
      const message = error.message;
      throw new CadAstError(nativeCode(message), message, vectorField.value.range, declaration.id);
    }
    nodes.push({ kind: "extrude", id: declaration.id, inputId, vector: copyCadData(vector), span: { ...declaration.range }, referenceSpan: { ...reference.value.range }, fieldTypes: { curve: "curve-reference", vector: "mm-vector3" } });
    dependencies.push({ fromId: declaration.id, toId: inputId, kind: "curve-input", span: { ...reference.value.range } });
  }
  return { name: ast.name, lengthUnit: "mm", nodes, dependencies };
}
function analyzeCadAst(ast, sourceVersion, _source) {
  if (sourceVersion === 3) {
    const resolved2 = resolveCadFunctionParameters(ast);
    const geometry2 = analyzeGeometry(resolved2.ast, 3);
    const dependencies2 = [...geometry2.dependencies, ...resolved2.dependencies].sort((a, b) => a.span.start - b.span.start);
    return {
      schema: "barocss-cad-ir",
      schemaVersion: 3,
      sourceVersion: 3,
      ...geometry2,
      dependencies: dependencies2,
      parameters: resolved2.parameters,
      bindings: resolved2.bindings,
      functions: resolved2.functions,
      calls: resolved2.calls,
      work: resolved2.work
    };
  }
  if (sourceVersion !== 2) {
    const geometry2 = analyzeGeometry(ast, sourceVersion);
    return { schema: "barocss-cad-ir", schemaVersion: 1, sourceVersion, ...geometry2 };
  }
  const resolved = resolveCadParameters(ast);
  const geometry = analyzeGeometry(resolved.ast, 2);
  const dependencies = [...geometry.dependencies, ...resolved.dependencies].sort((a, b) => a.span.start - b.span.start);
  return {
    schema: "barocss-cad-ir",
    schemaVersion: 2,
    sourceVersion: 2,
    ...geometry,
    dependencies,
    parameters: resolved.parameters,
    bindings: resolved.bindings
  };
}

// packages/barocss-cad/dist/language/lower-model.js
function lowerCadIR(ir) {
  const literals = new Map(ir.nodes.filter((n) => n.kind !== "extrude").map((n) => [n.id, n]));
  const constructions = [];
  const objects = ir.nodes.map((node) => {
    if (node.kind !== "extrude")
      return copyCadData(node.geometry);
    const input = literals.get(node.inputId);
    const surface = extrudeCurve(input.geometry, { id: node.id, vector: copyCadData(node.vector) });
    const span = ({ start, end, line, column }) => ({ start, end, line, column });
    constructions.push({ outputId: node.id, inputId: node.inputId, operation: "extrude", vector: copyCadData(node.vector), span: span(node.span), referenceSpan: span(node.referenceSpan) });
    return surface;
  });
  return { model: { name: ir.name, version: 0, lengthUnit: "mm", objects }, constructions };
}

// packages/barocss-cad/dist/model-compiler.js
function compileCadStages(source2, sourceVersion) {
  try {
    const ast = parseCadAst(source2, sourceVersion);
    const ir = analyzeCadAst(ast, sourceVersion, source2);
    const lowered = lowerCadIR(ir);
    return { ok: true, ast, ir, ...lowered };
  } catch (error) {
    if (error instanceof CadAstError)
      return { ok: false, error };
    throw error;
  }
}
function programmingFailure(code, message) {
  return { ok: false, diagnostics: [{ code, severity: "error", message, range: { start: 0, end: 0, line: 1, column: 1, endLine: 1, endColumn: 1 } }] };
}
function diagnosticFailure(error) {
  const diagnostic = { code: error.code, severity: "error", message: error.detail, range: { ...error.range } };
  if (error.objectId !== void 0)
    diagnostic.objectId = error.objectId;
  return { ok: false, diagnostics: [diagnostic] };
}
function settleSource3Success(success) {
  if (success.ir.schemaVersion !== 3)
    return;
  const work = success.ir.work, limits3 = work.limits;
  const fail2 = (message) => {
    throw new CadAstError("LIMIT", message, success.ast.range, success.ast.name);
  };
  const measure = () => {
    let utf16 = 0, utf8 = 0, ownValues = 0;
    const token = (text) => {
      utf16 += text.length;
      for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        if (code < 128)
          utf8++;
        else if (code < 2048)
          utf8 += 2;
        else if (code >= 55296 && code <= 56319 && text.charCodeAt(i + 1) >= 56320 && text.charCodeAt(i + 1) <= 57343) {
          utf8 += 4;
          i++;
        } else
          utf8 += 3;
      }
      if (utf16 > limits3.maximumSuccessUTF16 || utf8 > limits3.maximumSuccessUTF8)
        fail2("Complete Source3 success exceeds its file envelope");
    };
    const visit = (value, depth) => {
      if (++ownValues > limits3.maximumOwnValues || depth > limits3.maximumOwnDepth)
        fail2("Complete Source3 success exceeds its owned-data envelope");
      if (value === null) {
        token("null");
        return;
      }
      if (typeof value === "number") {
        if (!Number.isFinite(value))
          fail2("Source3 success must retain finite numbers");
        token(Object.is(value, -0) ? "-0" : JSON.stringify(value));
        return;
      }
      if (typeof value === "string" || typeof value === "boolean") {
        token(JSON.stringify(value));
        return;
      }
      if (Array.isArray(value)) {
        if (value.length > limits3.maximumOwnArray)
          fail2("Source3 success array exceeds its owned-data limit");
        token("[");
        value.forEach((item, index) => {
          if (index)
            token(",");
          visit(item, depth + 1);
        });
        token("]");
        return;
      }
      if (typeof value !== "object")
        fail2("Source3 success must contain only plain compiler data");
      const record3 = value, keys = Object.keys(record3);
      if (keys.length > limits3.maximumOwnRecord)
        fail2("Source3 success record exceeds its owned-data limit");
      token("{");
      keys.forEach((key, index) => {
        if (index)
          token(",");
        token(JSON.stringify(key));
        token(":");
        visit(record3[key], depth + 1);
      });
      token("}");
    };
    visit(success, 0);
    token("\n");
    return { utf16, utf8, ownValues };
  };
  let settled = false;
  for (let pass = 0; pass < 8; pass++) {
    const size = measure();
    if (size.utf16 === work.fileSizes.success.utf16 && size.utf8 === work.fileSizes.success.utf8 && size.ownValues === work.ownValues) {
      settled = true;
      break;
    }
    work.fileSizes.success = { utf16: size.utf16, utf8: size.utf8 };
    work.ownValues = size.ownValues;
  }
  const final = measure();
  if (!settled || final.utf16 !== work.fileSizes.success.utf16 || final.utf8 !== work.fileSizes.success.utf8 || final.ownValues !== work.ownValues)
    fail2("Source3 success sizes must settle within eight passes");
}
function compileCadModel(source2, options) {
  if (typeof source2 !== "string")
    return programmingFailure("TYPE", "Source must be a string");
  if (!options || typeof options !== "object" || Array.isArray(options))
    return programmingFailure("OPTIONS", "An explicit sourceVersion option is required");
  const prototype = Object.getPrototypeOf(options), descriptors = Object.getOwnPropertyDescriptors(options), keys = Reflect.ownKeys(options);
  if (prototype !== Object.prototype && prototype !== null || keys.length !== 1 || keys[0] !== "sourceVersion" || !descriptors.sourceVersion || !("value" in descriptors.sourceVersion) || !descriptors.sourceVersion.enumerable || descriptors.sourceVersion.value !== 0 && descriptors.sourceVersion.value !== 1 && descriptors.sourceVersion.value !== 2 && descriptors.sourceVersion.value !== 3)
    return programmingFailure("OPTIONS", "Only own sourceVersion: 0, 1, 2 or 3 data is supported");
  const result = compileCadStages(source2, descriptors.sourceVersion.value);
  if (!result.ok) {
    return diagnosticFailure(result.error);
  }
  if (descriptors.sourceVersion.value === 3) {
    const success = { ...result, diagnostics: [] };
    try {
      settleSource3Success(success);
    } catch (error) {
      if (error instanceof CadAstError)
        return diagnosticFailure(error);
      throw error;
    }
    return copyCadData(success);
  }
  return { ok: true, ast: copyCadData(result.ast), ir: copyCadData(result.ir), model: copyCadData(result.model), constructions: copyCadData(result.constructions), diagnostics: [] };
}

// packages/barocss-cad/dist/numeric-policy.js
var CadNumericPolicy = Object.freeze({
  version: 1,
  /** Modeling coordinate range for authored and stored geometry. */
  coordinateAbs: 1e4,
  /** Geometry / interchange coordinate range accepted by math validation (validateCurve, IGES import). */
  geometryCoordinateAbs: 1e6,
  /** Absolute linear comparison floor for native geometry bindings. */
  linearTolerance: 1e-7,
  /**
   * Scale-relative part of the linear tolerance: a 1e-12 parameter bracket on geometry of size S moves
   * points by ~1e-12·S, so comparisons use max(linearToleranceMM, relativeLinearTolerance·S). Equal to the
   * floor for S ≤ 10000 mm (the modeling range), so modeling results are unchanged.
   */
  relativeLinearTolerance: 1e-11,
  /** Comparison for dimensionless chart (UV) bindings; numerically the same as the mm floor, kept apart by meaning. */
  uvBindingTolerance: 1e-7,
  /** Dimensionless relative comparison (derivatives, chains: value · max(1, scale)). */
  relativeComparison: 1e-7,
  /** Normalized parameter bracket width for root refinement. */
  parameterWidth: 1e-12,
  /**
   * A stored binary64 parameter derived from exact geometry is computed exactly and rounded once to
   * nearest. Proofs accept it when it is exact, or when its 3D deviation is within the bound that one
   * such rounding can cause; anything larger is still refused.
   */
  chartParameters: "exact-or-one-rounding-certified-v1"
});
var HALF_ULP = 2 ** -53;
function linearToleranceMM(scaleMM) {
  return Math.max(CadNumericPolicy.linearTolerance, CadNumericPolicy.relativeLinearTolerance * Math.abs(scaleMM));
}

// packages/barocss-cad/dist/nurbs/surfaces/z-axis-revolved-surface.js
var OBSERVATION_MM = CadNumericPolicy.linearTolerance;

// packages/barocss-cad/dist/core/dyadic.js
var view = new DataView(new ArrayBuffer(8));
function binary64Dyadic(v) {
  if (!Number.isFinite(v))
    throw new RangeError("finite coordinates required");
  if (v === 0)
    return { m: 0n, k: 0 };
  view.setFloat64(0, v);
  const bits = view.getBigUint64(0), exp = Number(bits >> 52n & 2047n), frac = bits & 0xfffffffffffffn;
  let m = exp === 0 ? frac : frac | 1n << 52n, e = (exp === 0 ? 1 : exp) - 1075;
  while (m && !(m & 1n) && e < 0) {
    m >>= 1n;
    e++;
  }
  if (bits >> 63n)
    m = -m;
  return e >= 0 ? { m: m << BigInt(e), k: 0 } : { m, k: -e };
}

// packages/barocss-cad/dist/intersect/own-plate-circular-hole-preview.js
var TOL = CadNumericPolicy.linearTolerance;

// packages/barocss-cad/dist/intersect/own-plane-cylinder-clipped.js
var TOL2 = CadNumericPolicy.linearTolerance;

// packages/barocss-cad/dist/core/own-data.js
var FINITE_REPRESENTED_OWN_NUMBERS_REQUIRED = "Finite represented own numbers are required";
var DENSE_BOUNDED_ARRAYS_REQUIRED = "Dense bounded arrays are required";
var SPARSE_OWN_ARRAY_FIELDS_REFUSED = "Sparse/extra own array fields are refused";

// packages/barocss-cad/dist/intersect/own-multispan-curve-plane.js
var TOL3 = CadNumericPolicy.linearTolerance;

// packages/barocss-cad/dist/nurbs/curves/curve-adaptive-sampling.js
var EPS = 64 * Number.EPSILON;

// packages/barocss-cad/dist/nurbs/source-wide/curve-wide-adaptive-sampling.js
var WideAdaptiveCurveSamplingDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  SPAN: "SPAN",
  REPRESENTABILITY: "REPRESENTABILITY",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  BINDING: "BINDING",
  OWNED: "OWNED"
});
var EPS2 = 64 * Number.EPSILON;
var POINT_TOLERANCE = CadNumericPolicy.linearTolerance;
var D1_TOLERANCE = CadNumericPolicy.relativeComparison;

// packages/barocss-cad/dist/nurbs/curves/curve-bezier-spans.js
var CurveBezierSpanExtractionDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  SPAN: "SPAN",
  REPRESENTABILITY: "REPRESENTABILITY",
  NATIVE: "NATIVE",
  BINDING: "BINDING",
  OWNED: "OWNED"
});
var EPS3 = 64 * Number.EPSILON;
var POINT_TOLERANCE2 = CadNumericPolicy.linearTolerance;
var D1_TOLERANCE2 = CadNumericPolicy.relativeComparison;

// packages/barocss-cad/dist/nurbs/source-wide/curve-wide-plane-intersection.js
var WideCurveAffinePlaneIntersectionDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  SPAN: "SPAN",
  REPRESENTABILITY: "REPRESENTABILITY",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  BINDING: "BINDING",
  OWNED: "OWNED"
});

// packages/barocss-cad/dist/intersect/own-coincident-plane-clip.js
var TOL4 = CadNumericPolicy.linearTolerance;

// packages/barocss-cad/dist/intersect/own-convex-loop-clip.js
var TOL5 = CadNumericPolicy.linearTolerance;

// packages/barocss-cad/dist/own-convex-planar-face.js
var TOL6 = CadNumericPolicy.linearTolerance;

// packages/barocss-cad/dist/intersect/own-convex-planar-face-holes.js
var TOL7 = CadNumericPolicy.linearTolerance;

// packages/barocss-cad/dist/intersect/own-convex-planar-face-holes-preview.js
var TOL8 = CadNumericPolicy.linearTolerance;
var EPS4 = 64 * Number.EPSILON;

// packages/barocss-cad/dist/nurbs/curves/curve-join.js
var EPS5 = 64 * Number.EPSILON;
var POINT_TOLERANCE3 = CadNumericPolicy.linearTolerance;
var D1_TOLERANCE3 = CadNumericPolicy.relativeComparison;

// packages/barocss-cad/dist/nurbs/curves/curve-reversal.js
var CurveReversalDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", DOMAIN: "DOMAIN", REPRESENTABILITY: "REPRESENTABILITY", NATIVE: "NATIVE", BINDING: "BINDING", OWNED: "OWNED" });
var EPS6 = 64 * Number.EPSILON;
var POINT_TOLERANCE4 = CadNumericPolicy.linearTolerance;
var D1_TOLERANCE4 = CadNumericPolicy.relativeComparison;

// packages/barocss-cad/dist/nurbs/curves/curve-interval-extraction.js
var CurveIntervalExtractionDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  INTERVAL: "INTERVAL",
  IDENTITY: "IDENTITY",
  REPRESENTABILITY: "REPRESENTABILITY",
  NATIVE_CAPACITY: "NATIVE_CAPACITY",
  NATIVE: "NATIVE",
  BINDING: "BINDING",
  OWNED: "OWNED"
});
var POINT_TOLERANCE5 = CadNumericPolicy.linearTolerance;
var D1_TOLERANCE5 = CadNumericPolicy.relativeComparison;

// packages/barocss-cad/dist/nurbs/surfaces/surface-region.js
var SurfaceRegionDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  INTERVAL: "INTERVAL",
  IDENTITY: "IDENTITY",
  REPRESENTABILITY: "REPRESENTABILITY",
  NATIVE_CAPACITY: "NATIVE_CAPACITY",
  NATIVE: "NATIVE",
  BINDING: "BINDING",
  OWNED: "OWNED"
});
var POINT_TOLERANCE6 = CadNumericPolicy.linearTolerance;
var D1_TOLERANCE6 = CadNumericPolicy.relativeComparison;

// packages/barocss-cad/dist/nurbs/source-wide/curve-wide-refinement.js
var WideCurveRefinementDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  REQUEST: "REQUEST",
  IDENTITY: "IDENTITY",
  REPRESENTABILITY: "REPRESENTABILITY",
  NATIVE_CAPACITY: "NATIVE_CAPACITY",
  NATIVE: "NATIVE",
  BINDING: "BINDING",
  OWNED: "OWNED"
});
var POINT_TOLERANCE7 = CadNumericPolicy.linearTolerance;
var D1_TOLERANCE7 = CadNumericPolicy.relativeComparison;

// packages/barocss-cad/dist/nurbs/surfaces/surface-axis-reversal.js
var SurfaceAxisReversalDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  AXIS: "AXIS",
  IDENTITY: "IDENTITY",
  DOMAIN: "DOMAIN",
  REPRESENTABILITY: "REPRESENTABILITY",
  NATIVE: "NATIVE",
  BINDING: "BINDING",
  OWNED: "OWNED"
});
var POINT_TOLERANCE8 = CadNumericPolicy.linearTolerance;
var D1_TOLERANCE8 = CadNumericPolicy.relativeComparison;

// packages/barocss-cad/dist/nurbs/surfaces/trimmed-surface-axis-reversal.js
var TrimmedSurfaceAxisReversalDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  SUPPORT: "SUPPORT",
  DOMAIN: "DOMAIN",
  TOPOLOGY: "TOPOLOGY",
  REPRESENTABILITY: "REPRESENTABILITY",
  BUDGET: "BUDGET",
  BINDING: "BINDING"
});

// packages/barocss-cad/dist/cad-document.js
var CadDocumentDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  VERSION: "VERSION",
  PROFILE: "PROFILE",
  IDENTITY: "IDENTITY",
  REFERENCE: "REFERENCE",
  SOURCE: "SOURCE",
  FRAME: "FRAME",
  BUDGET: "BUDGET",
  JSON: "JSON",
  OWNED: "OWNED"
});

// packages/barocss-cad/dist/document/cad-document-reference.js
var CadReferenceDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  VERSION: "VERSION",
  REFERENCE: "REFERENCE",
  STALE: "STALE",
  QUERY: "QUERY",
  FRAME: "FRAME",
  REPRESENTABILITY: "REPRESENTABILITY",
  NATIVE: "NATIVE",
  BINDING: "BINDING",
  OWNED: "OWNED"
});

// packages/barocss-cad/dist/intersect/own-cubic-curve-plane-intersection.js
var CubicCurveAffinePlaneIntersectionDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  REPRESENTABILITY: "REPRESENTABILITY",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  BINDING: "BINDING",
  OWNED: "OWNED"
});

// packages/barocss-cad/dist/nurbs/source-wide/curve-wide-cubic-plane-intersection.js
var WideCubicCurveAffinePlaneIntersectionDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  SPAN: "SPAN",
  REPRESENTABILITY: "REPRESENTABILITY",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  BINDING: "BINDING",
  OWNED: "OWNED"
});

// packages/barocss-cad/dist/nurbs/source-wide/curve-wide-control-polygon.js
var WideCurveControlPolygonEditDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  BINDING: "BINDING",
  OWNED: "OWNED"
});

// packages/barocss-cad/dist/nurbs/source-wide/curve-wide-reversal.js
var WideCurveReversalDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  DOMAIN: "DOMAIN",
  REPRESENTABILITY: "REPRESENTABILITY",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  BINDING: "BINDING",
  OWNED: "OWNED"
});

// packages/barocss-cad/dist/features/three-section-loft.js
var ThreeSectionLoftDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  BASIS: "BASIS",
  REPRESENTABILITY: "REPRESENTABILITY",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  BINDING: "BINDING",
  OWNED: "OWNED"
});
var EPS7 = 64 * Number.EPSILON;

// packages/barocss-cad/dist/document/cad-document-bounds.js
var CadDocumentBoundsDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  REFERENCE: "REFERENCE",
  STALE: "STALE",
  NATIVE: "NATIVE",
  BINDING: "BINDING",
  OWNED: "OWNED"
});

// packages/barocss-cad/dist/nurbs/curves/cad-curve-arc-length.js
var CadCurveArcLengthDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  REFERENCE: "REFERENCE",
  STALE: "STALE",
  INTERVAL: "INTERVAL",
  REPRESENTABILITY: "REPRESENTABILITY",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  BINDING: "BINDING",
  OWNED: "OWNED"
});
var EPS8 = 64 * Number.EPSILON;

// packages/barocss-cad/dist/nurbs/surfaces/cad-surface-area.js
var CadSurfaceAreaDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  REFERENCE: "REFERENCE",
  STALE: "STALE",
  REGION: "REGION",
  REPRESENTABILITY: "REPRESENTABILITY",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  BINDING: "BINDING",
  OWNED: "OWNED"
});
var EPS9 = 64 * Number.EPSILON;

// packages/barocss-cad/dist/document/cad-assembly.js
var CadAssemblyDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  VERSION: "VERSION",
  IDENTITY: "IDENTITY",
  REFERENCE: "REFERENCE",
  STALE: "STALE",
  HIERARCHY: "HIERARCHY",
  REVISION: "REVISION",
  PLACEMENT: "PLACEMENT",
  REPRESENTABILITY: "REPRESENTABILITY",
  BUDGET: "BUDGET",
  JSON: "JSON",
  OWNED: "OWNED",
  QUERY: "QUERY",
  NATIVE: "NATIVE"
});

// packages/barocss-cad/dist/planar-solids/coplanar-face-boolean.js
var CoplanarFaceBooleanDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  SUPPORT: "SUPPORT",
  CONTACT: "CONTACT",
  UNCERTAINTY: "UNCERTAINTY",
  REPRESENTABILITY: "REPRESENTABILITY",
  BUDGET: "BUDGET",
  INCIDENCE: "INCIDENCE",
  NESTING: "NESTING",
  NATIVE: "NATIVE",
  BINDING: "BINDING",
  OWNED: "OWNED"
});
var POINT_TOLERANCE9 = CadNumericPolicy.linearTolerance;
var D1_TOLERANCE9 = CadNumericPolicy.relativeComparison;

// packages/barocss-cad/dist/planar-solids/coplanar-face-boolean-mesh.js
var CoplanarFaceBooleanMeshDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  REPRESENTABILITY: "REPRESENTABILITY",
  UNCERTAINTY: "UNCERTAINTY",
  TRIANGULATION: "TRIANGULATION",
  INCIDENCE: "INCIDENCE",
  COVERAGE: "COVERAGE",
  BINDING: "BINDING",
  OWNED: "OWNED"
});
var TOLERANCE = CadNumericPolicy.linearTolerance;

// packages/barocss-cad/dist/planar-solids/coplanar-face-boolean-extrusion.js
var CoplanarFaceBooleanExtrusionDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  REPRESENTABILITY: "REPRESENTABILITY",
  BINDING: "BINDING",
  INCIDENCE: "INCIDENCE",
  OWNED: "OWNED"
});
var TOLERANCE2 = CadNumericPolicy.linearTolerance;

// packages/barocss-cad/dist/planar-solids/coplanar-face-boolean-extrusion-mesh.js
var CoplanarFaceBooleanExtrusionMeshDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  REPRESENTABILITY: "REPRESENTABILITY",
  BINDING: "BINDING",
  INCIDENCE: "INCIDENCE",
  COVERAGE: "COVERAGE",
  OWNED: "OWNED"
});
var TOLERANCE3 = CadNumericPolicy.linearTolerance;

// packages/barocss-cad/dist/features/boolean-extrusion-feature-graph.js
var BooleanExtrusionFeatureGraphDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  PARAMETER: "PARAMETER",
  DEPENDENCY: "DEPENDENCY",
  REVISION: "REVISION",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  REPRESENTABILITY: "REPRESENTABILITY",
  JSON: "JSON",
  OWNED: "OWNED"
});

// packages/barocss-cad/dist/planar-solids/coplanar-face-boolean-extrusion-properties.js
var CoplanarFaceBooleanExtrusionPropertiesDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  REPRESENTABILITY: "REPRESENTABILITY",
  OWNED: "OWNED"
});
var AREA_EPSILON = 128 * Number.EPSILON;

// packages/barocss-cad/dist/nurbs/surfaces/translational-sweep-surface.js
var TranslationalSweepDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  REPRESENTABILITY: "REPRESENTABILITY",
  BINDING: "BINDING",
  OWNED: "OWNED"
});
var TOLERANCE4 = CadNumericPolicy.linearTolerance;

// packages/barocss-cad/dist/nurbs/curves/curve-interpolation-kernel-internal.js
var CODE = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  REPRESENTABILITY: "REPRESENTABILITY",
  CONDITIONING: "CONDITIONING",
  BINDING: "BINDING",
  OWNED: "OWNED"
});
var PIVOT_EPSILON = 128 * Number.EPSILON;
var TOLERANCE5 = CadNumericPolicy.linearTolerance;

// packages/barocss-cad/dist/nurbs/curves/curve-interpolation.js
var CurveInterpolationDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  REPRESENTABILITY: "REPRESENTABILITY",
  CONDITIONING: "CONDITIONING",
  BINDING: "BINDING",
  OWNED: "OWNED"
});

// packages/barocss-cad/dist/nurbs/surfaces/surface-interpolation.js
var SurfaceInterpolationDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  REPRESENTABILITY: "REPRESENTABILITY",
  CONDITIONING: "CONDITIONING",
  BINDING: "BINDING",
  OWNED: "OWNED"
});
var TOLERANCE6 = CadNumericPolicy.linearTolerance;

// packages/barocss-cad/dist/nurbs/curves/curve-parameterization.js
var CurveParameterizationDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  REPRESENTABILITY: "REPRESENTABILITY",
  CONDITIONING: "CONDITIONING",
  BINDING: "BINDING",
  OWNED: "OWNED"
});

// packages/barocss-cad/dist/nurbs/curves/weighted-curve-interpolation.js
var WeightedCurveInterpolationDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  REPRESENTABILITY: "REPRESENTABILITY",
  CONDITIONING: "CONDITIONING",
  BINDING: "BINDING",
  OWNED: "OWNED"
});

// packages/barocss-cad/dist/features/multi-section-loft.js
var MultiSectionLoftDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  BASIS: "BASIS",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  REPRESENTABILITY: "REPRESENTABILITY",
  CONDITIONING: "CONDITIONING",
  BINDING: "BINDING",
  OWNED: "OWNED"
});
var TOLERANCE7 = CadNumericPolicy.linearTolerance;

// packages/barocss-cad/dist/features/affine-geometry-transform.js
var AffineGeometryTransformDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  MATRIX: "MATRIX",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  REPRESENTABILITY: "REPRESENTABILITY",
  BINDING: "BINDING",
  OWNED: "OWNED"
});
var TOLERANCE8 = CadNumericPolicy.linearTolerance;

// packages/barocss-cad/dist/features/linear-geometry-pattern.js
var LinearGeometryPatternDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  REPRESENTABILITY: "REPRESENTABILITY",
  BINDING: "BINDING",
  OWNED: "OWNED"
});

// packages/barocss-cad/dist/features/circular-geometry-pattern.js
var CircularGeometryPatternDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  REPRESENTABILITY: "REPRESENTABILITY",
  BINDING: "BINDING",
  OWNED: "OWNED"
});
var ROTATION_TOLERANCE = 512 * Number.EPSILON;

// packages/barocss-cad/dist/core/second-derivatives.js
var NativeSecondDerivativeDiagnosticCode = Object.freeze({ INPUT: "INPUT", CONTINUITY: "CONTINUITY", ARITHMETIC: "ARITHMETIC", NATIVE: "NATIVE" });

// packages/barocss-cad/dist/nurbs/surfaces/local-curvature.js
var NativeCurvatureDiagnosticCode = Object.freeze({
  DERIVATIVE: "DERIVATIVE",
  REGULARITY: "REGULARITY",
  ARITHMETIC: "ARITHMETIC"
});
var ROUNDING = 512 * Number.EPSILON;

// packages/barocss-cad/dist/nurbs/curves/curve-planar-face-material.js
var CurvePlanarFaceMaterialDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  BUDGET: "BUDGET",
  UNSUPPORTED: "UNSUPPORTED",
  NATIVE: "NATIVE",
  UNCERTAINTY: "UNCERTAINTY",
  BINDING: "BINDING",
  OWNED: "OWNED"
});
var HULL_EPS = 512 * Number.EPSILON;
var SIDE_EPS = 64 * Number.EPSILON;

// packages/barocss-cad/dist/features/section-knot-alignment.js
var SectionKnotAlignmentDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  BASIS: "BASIS",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  BINDING: "BINDING",
  OWNED: "OWNED"
});

// packages/barocss-cad/dist/intersect/vlinear-plane-section.js
var VLinearSurfacePlaneSectionDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", SOURCE: "SOURCE", SUPPORT: "SUPPORT", CROSSING: "CROSSING", CHART: "CHART", REPRESENTABILITY: "REPRESENTABILITY", BINDING: "BINDING", NATIVE: "NATIVE", OWNED: "OWNED" });

// packages/barocss-cad/dist/nurbs/source-wide/source-surface-control-net.js
var SourceSurfaceControlNetDiagnosticCode = Object.freeze({ INPUT: "INPUT", VERSION: "VERSION", IDENTITY: "IDENTITY", SOURCE: "SOURCE", TARGET: "TARGET", BINDING: "BINDING", BUDGET: "BUDGET", NATIVE: "NATIVE", OWNED: "OWNED" });

// packages/barocss-cad/dist/nurbs/source-wide/source-surface-control-net-wide.js
var SourceSurfaceControlNetWideDiagnosticCode = Object.freeze({ INPUT: "INPUT", VERSION: "VERSION", IDENTITY: "IDENTITY", SOURCE: "SOURCE", TARGET: "TARGET", BINDING: "BINDING", BUDGET: "BUDGET", NATIVE: "NATIVE", OWNED: "OWNED" });
var SourceSurfaceControlNetWideError = class extends KernelError {
  code;
  constructor(code, detail, cause) {
    super(("Source Surface control-net wide: " + detail).slice(0, 1024), cause === void 0 ? void 0 : { cause });
    this.name = "SourceSurfaceControlNetWideError";
    this.code = code;
  }
};
var CODE2 = SourceSurfaceControlNetWideDiagnosticCode;
var OWN = { input: CODE2.INPUT, owned: CODE2.OWNED, budget: CODE2.BUDGET, fail: (code, detail) => {
  throw new SourceSurfaceControlNetWideError(code, detail);
}, wrap: (code, detail, cause) => {
  throw new SourceSurfaceControlNetWideError(code, detail, cause);
}, isRefusal: (e) => e instanceof SourceSurfaceControlNetWideError };

// packages/barocss-cad/dist/nurbs/source-wide/source-curve-control-polygon.js
var SourceCurveControlPolygonDiagnosticCode = Object.freeze({ INPUT: "INPUT", VERSION: "VERSION", IDENTITY: "IDENTITY", SOURCE: "SOURCE", TARGET: "TARGET", BINDING: "BINDING", BUDGET: "BUDGET", NATIVE: "NATIVE", OWNED: "OWNED" });
var SourceCurveControlPolygonError = class extends KernelError {
  code;
  constructor(code, detail, cause) {
    super(("Source Curve control-polygon: " + detail).slice(0, 1024), cause === void 0 ? void 0 : { cause });
    this.name = "SourceCurveControlPolygonError";
    this.code = code;
  }
};
var CODE3 = SourceCurveControlPolygonDiagnosticCode;
var OWN2 = { input: CODE3.INPUT, owned: CODE3.OWNED, budget: CODE3.BUDGET, fail: (code, detail) => {
  throw new SourceCurveControlPolygonError(code, detail);
}, wrap: (code, detail, cause) => {
  throw new SourceCurveControlPolygonError(code, detail, cause);
}, isRefusal: (e) => e instanceof SourceCurveControlPolygonError };

// packages/barocss-cad/dist/features/piecewise-rational-loft.js
var PiecewiseRationalLoftDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", BASIS: "BASIS", STATIONS: "STATIONS", NATIVE: "NATIVE", REPRESENTABILITY: "REPRESENTABILITY", SOURCE: "SOURCE", OWNED: "OWNED" });
var PiecewiseRationalLoftError = class extends KernelError {
  code;
  constructor(code, detail, cause) {
    super(("Piecewise rational loft: " + detail).slice(0, 1024), cause === void 0 ? void 0 : { cause });
    this.name = "PiecewiseRationalLoftError";
    this.code = code;
  }
};
var CODE4 = PiecewiseRationalLoftDiagnosticCode;
var OWN3 = { input: CODE4.INPUT, owned: CODE4.OWNED, budget: CODE4.BUDGET, fail: (code, detail) => {
  throw new PiecewiseRationalLoftError(code, detail);
}, wrap: (code, detail, cause) => {
  throw new PiecewiseRationalLoftError(code, detail, cause);
}, isRefusal: (e) => e instanceof PiecewiseRationalLoftError, sparse: SPARSE_OWN_ARRAY_FIELDS_REFUSED };

// packages/barocss-cad/dist/intersect/vlinear-plane-trim.js
var VLinearSurfacePlaneTrimDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", SECTION: "SECTION", UV: "UV", INTERVAL: "INTERVAL", REPRESENTABILITY: "REPRESENTABILITY", BINDING: "BINDING", NATIVE: "NATIVE", OWNED: "OWNED" });

// packages/barocss-cad/dist/intersect/vlinear-plane-trim-classification.js
var VLinearSurfacePlaneTrimUVDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", TRIM: "TRIM", BINDING: "BINDING", OWNED: "OWNED" });
var VLinearSurfacePlaneTrimUVError = class extends KernelError {
  code;
  constructor(code, detail, cause) {
    super(("V-linear trim UV classification: " + detail).slice(0, 1024), cause === void 0 ? void 0 : { cause });
    this.name = "VLinearSurfacePlaneTrimUVError";
    this.code = code;
  }
};
var CODE5 = VLinearSurfacePlaneTrimUVDiagnosticCode;
var OWN4 = { input: CODE5.INPUT, owned: CODE5.OWNED, budget: CODE5.BUDGET, fail: (code, detail) => {
  throw new VLinearSurfacePlaneTrimUVError(code, detail);
}, wrap: (code, detail, cause) => {
  throw new VLinearSurfacePlaneTrimUVError(code, detail, cause);
}, isRefusal: (e) => e instanceof VLinearSurfacePlaneTrimUVError, finite: FINITE_REPRESENTED_OWN_NUMBERS_REQUIRED, dense: DENSE_BOUNDED_ARRAYS_REQUIRED };

// packages/barocss-cad/dist/axis-box-boolean.js
var AxisBoxSolidBooleanDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", SOURCE: "SOURCE", BINDING: "BINDING", CONTACT: "CONTACT", TOPOLOGY: "TOPOLOGY", NATIVE: "NATIVE", OWNED: "OWNED" });

// packages/barocss-cad/dist/planar-solids/axis-box-point-classification.js
var AxisBoxSolidBooleanPointDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", BOOLEAN: "BOOLEAN", BINDING: "BINDING", OWNED: "OWNED" });
var AxisBoxSolidBooleanPointError = class extends KernelError {
  code;
  constructor(code, detail, cause) {
    super(("Axis-box Solid point classification: " + detail).slice(0, 1024), cause === void 0 ? void 0 : { cause });
    this.name = "AxisBoxSolidBooleanPointError";
    this.code = code;
  }
};
var CODE6 = AxisBoxSolidBooleanPointDiagnosticCode;
var OWN5 = { input: CODE6.INPUT, owned: CODE6.OWNED, budget: CODE6.BUDGET, fail: (code, detail) => {
  throw new AxisBoxSolidBooleanPointError(code, detail);
}, wrap: (code, detail, cause) => {
  throw new AxisBoxSolidBooleanPointError(code, detail, cause);
}, isRefusal: (e) => e instanceof AxisBoxSolidBooleanPointError, finite: FINITE_REPRESENTED_OWN_NUMBERS_REQUIRED, sparse: SPARSE_OWN_ARRAY_FIELDS_REFUSED };

// packages/barocss-cad/dist/axis-box-solid-mass.js
var AxisBoxSolidMassDiagnosticCode = Object.freeze({ INPUT: "INPUT", BUDGET: "BUDGET", BOOLEAN: "BOOLEAN", BINDING: "BINDING", REPRESENTABILITY: "REPRESENTABILITY", OWNED: "OWNED" });
var AxisBoxSolidMassError = class extends KernelError {
  code;
  constructor(code, detail, cause) {
    super(("Axis-box Solid mass: " + detail).slice(0, 1024), cause === void 0 ? void 0 : { cause });
    this.name = "AxisBoxSolidMassError";
    this.code = code;
  }
};
var CODE7 = AxisBoxSolidMassDiagnosticCode;
var OWN6 = { input: CODE7.INPUT, owned: CODE7.OWNED, budget: CODE7.BUDGET, fail: (code, detail) => {
  throw new AxisBoxSolidMassError(code, detail);
}, wrap: (code, detail, cause) => {
  throw new AxisBoxSolidMassError(code, detail, cause);
}, isRefusal: (e) => e instanceof AxisBoxSolidMassError };

// packages/barocss-cad/dist/planar-solids/axis-box-principal-inertia.js
var AxisBoxSolidPrincipalInertiaDiagnosticCode = Object.freeze({ INPUT: "INPUT", BUDGET: "BUDGET", MASS: "MASS", SELECTION: "SELECTION", REPRESENTABILITY: "REPRESENTABILITY", OWNED: "OWNED" });
var AxisBoxSolidPrincipalInertiaError = class extends KernelError {
  code;
  constructor(code, detail, cause) {
    super(("Axis-box Solid principal inertia: " + detail).slice(0, 1024), cause === void 0 ? void 0 : { cause });
    this.name = "AxisBoxSolidPrincipalInertiaError";
    this.code = code;
  }
};
var CODE8 = AxisBoxSolidPrincipalInertiaDiagnosticCode;
var ROUNDING2 = 512 * Number.EPSILON;
var OWN7 = { input: CODE8.INPUT, owned: CODE8.OWNED, budget: CODE8.BUDGET, fail: (code, detail) => {
  throw new AxisBoxSolidPrincipalInertiaError(code, detail);
}, wrap: (code, detail, cause) => {
  throw new AxisBoxSolidPrincipalInertiaError(code, detail, cause);
}, isRefusal: (e) => e instanceof AxisBoxSolidPrincipalInertiaError, sparse: SPARSE_OWN_ARRAY_FIELDS_REFUSED };

// packages/barocss-cad/dist/sketch/xy-angle-arc.js
var XYAngleArcDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", UNIT: "UNIT", RANGE: "RANGE", ARITHMETIC: "ARITHMETIC", NATIVE: "NATIVE", SOURCE: "SOURCE", BUDGET: "BUDGET", OWNED: "OWNED" });
var TURN = 2 * Math.PI;
var QUARTER = Math.PI / 2;

// packages/barocss-cad/dist/sketch/xy-angle-arc-artifact.js
var XYAngleArcArtifactDiagnosticCode = Object.freeze({ INPUT: "INPUT", REQUEST: "REQUEST", SOURCE: "SOURCE", BINDING: "BINDING", STRUCTURE: "STRUCTURE", ASSOCIATION: "ASSOCIATION", OBSERVATION: "OBSERVATION", BUDGET: "BUDGET", OWNED: "OWNED", CODEC: "CODEC", VERSION: "VERSION" });

// packages/barocss-cad/dist/intersect/multispan-vlinear-plane-section.js
var MultiSpanVLinearSurfacePlaneSectionDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", SOURCE: "SOURCE", SUPPORT: "SUPPORT", CROSSING: "CROSSING", CHART: "CHART", REPRESENTABILITY: "REPRESENTABILITY", BINDING: "BINDING", NATIVE: "NATIVE", OWNED: "OWNED" });

// packages/barocss-cad/dist/intersect/multispan-vlinear-plane-trim.js
var MultiSpanVLinearSurfacePlaneTrimDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", SECTION: "SECTION", UV: "UV", INTERVAL: "INTERVAL", REPRESENTABILITY: "REPRESENTABILITY", BINDING: "BINDING", NATIVE: "NATIVE", OWNED: "OWNED" });

// packages/barocss-cad/dist/intersect/multispan-vlinear-plane-trim-classification.js
var MultiSpanVLinearSurfacePlaneTrimUVDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", TRIM: "TRIM", BINDING: "BINDING", OWNED: "OWNED" });
var MultiSpanVLinearSurfacePlaneTrimUVError = class extends KernelError {
  code;
  constructor(code, detail, cause) {
    super(("Multi-span V-linear trim UV classification: " + detail).slice(0, 1024), cause === void 0 ? void 0 : { cause });
    this.name = "MultiSpanVLinearSurfacePlaneTrimUVError";
    this.code = code;
  }
};
var CODE9 = MultiSpanVLinearSurfacePlaneTrimUVDiagnosticCode;
var OWN8 = { input: CODE9.INPUT, owned: CODE9.OWNED, budget: CODE9.BUDGET, fail: (code, detail) => {
  throw new MultiSpanVLinearSurfacePlaneTrimUVError(code, detail);
}, wrap: (code, detail, cause) => {
  throw new MultiSpanVLinearSurfacePlaneTrimUVError(code, detail, cause);
}, isRefusal: (e) => e instanceof MultiSpanVLinearSurfacePlaneTrimUVError, finite: FINITE_REPRESENTED_OWN_NUMBERS_REQUIRED, dense: DENSE_BOUNDED_ARRAYS_REQUIRED };

// packages/barocss-cad/dist/paired/paired-section-plane-cap.js
var PairedSectionPlaneCapDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", SECTION: "SECTION", BASIS: "BASIS", GRAPH: "GRAPH", REPRESENTABILITY: "REPRESENTABILITY", BINDING: "BINDING", NATIVE: "NATIVE", OWNED: "OWNED" });
var PairedSectionPlaneCapError = class extends KernelError {
  code;
  constructor(code, detail, cause) {
    super(("Paired section Plane cap: " + detail).slice(0, 1024), cause === void 0 ? void 0 : { cause });
    this.name = "PairedSectionPlaneCapError";
    this.code = code;
  }
};
var CODE10 = PairedSectionPlaneCapDiagnosticCode;
var OWN9 = { input: CODE10.INPUT, owned: CODE10.OWNED, budget: CODE10.BUDGET, fail: (code, detail) => {
  throw new PairedSectionPlaneCapError(code, detail);
}, wrap: (code, detail, cause) => {
  throw new PairedSectionPlaneCapError(code, detail, cause);
}, isRefusal: (e) => e instanceof PairedSectionPlaneCapError, finite: FINITE_REPRESENTED_OWN_NUMBERS_REQUIRED, dense: DENSE_BOUNDED_ARRAYS_REQUIRED };

// packages/barocss-cad/dist/features/section-exact-surface-binding.js
var SectionExactSurfaceBindingDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", SECTION: "SECTION", SUPPORT: "SUPPORT", REPRESENTABILITY: "REPRESENTABILITY", BINDING: "BINDING", NATIVE: "NATIVE", OWNED: "OWNED" });
var SectionExactSurfaceBindingError = class extends KernelError {
  code;
  constructor(code, detail, cause) {
    super(("Exact section Surface binding: " + detail).slice(0, 1024), cause === void 0 ? void 0 : { cause });
    this.name = "SectionExactSurfaceBindingError";
    this.code = code;
  }
};
var CODE11 = SectionExactSurfaceBindingDiagnosticCode;
var OWN10 = { input: CODE11.INPUT, owned: CODE11.OWNED, budget: CODE11.BUDGET, fail: (code, detail) => {
  throw new SectionExactSurfaceBindingError(code, detail);
}, wrap: (code, detail, cause) => {
  throw new SectionExactSurfaceBindingError(code, detail, cause);
}, isRefusal: (e) => e instanceof SectionExactSurfaceBindingError, finite: FINITE_REPRESENTED_OWN_NUMBERS_REQUIRED, dense: DENSE_BOUNDED_ARRAYS_REQUIRED };

// packages/barocss-cad/dist/exact-proof/exact-surface-lower-trim.js
var ExactSurfaceLowerTrimDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", BINDING: "BINDING", PARENT: "PARENT", SUPPORT: "SUPPORT", EMBEDDING: "EMBEDDING", REPRESENTABILITY: "REPRESENTABILITY", NATIVE: "NATIVE", OWNED: "OWNED" });
var ExactSurfaceLowerTrimError = class extends KernelError {
  code;
  constructor(code, detail, cause) {
    super(("Exact original Surface lower trim: " + detail).slice(0, 1024), cause === void 0 ? void 0 : { cause });
    this.name = "ExactSurfaceLowerTrimError";
    this.code = code;
  }
};
var CODE12 = ExactSurfaceLowerTrimDiagnosticCode;
var OWN11 = { input: CODE12.INPUT, owned: CODE12.OWNED, budget: CODE12.BUDGET, fail: (code, detail) => {
  throw new ExactSurfaceLowerTrimError(code, detail);
}, wrap: (code, detail, cause) => {
  throw new ExactSurfaceLowerTrimError(code, detail, cause);
}, isRefusal: (e) => e instanceof ExactSurfaceLowerTrimError, finite: FINITE_REPRESENTED_OWN_NUMBERS_REQUIRED, dense: DENSE_BOUNDED_ARRAYS_REQUIRED };

// packages/barocss-cad/dist/translated-strip/translated-surface-base-face.js
var TranslatedSurfaceBaseFaceDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", PARENT: "PARENT", PAIR: "PAIR", SUPPORT: "SUPPORT", TRANSLATION: "TRANSLATION", REPRESENTABILITY: "REPRESENTABILITY", BINDING: "BINDING", NATIVE: "NATIVE", OWNED: "OWNED" });

// packages/barocss-cad/dist/translated-strip/translated-surface-strip-volume.js
var TranslatedSurfaceStripVolumeDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", PARENT: "PARENT", PAIR: "PAIR", SUPPORT: "SUPPORT", TRANSLATION: "TRANSLATION", REPRESENTABILITY: "REPRESENTABILITY", BINDING: "BINDING", NATIVE: "NATIVE", OWNED: "OWNED" });

// packages/barocss-cad/dist/translated-strip/translated-surface-end-faces.js
var TranslatedSurfaceEndFacesDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", PARENT: "PARENT", PAIR: "PAIR", SUPPORT: "SUPPORT", TRANSLATION: "TRANSLATION", REPRESENTABILITY: "REPRESENTABILITY", BINDING: "BINDING", NATIVE: "NATIVE", OWNED: "OWNED" });
var TranslatedSurfaceEndFacesError = class extends KernelError {
  code;
  constructor(code, detail, cause) {
    super(("Translated Surface end Faces: " + detail).slice(0, 1024), cause === void 0 ? void 0 : { cause });
    this.name = "TranslatedSurfaceEndFacesError";
    this.code = code;
  }
};
var CODE13 = TranslatedSurfaceEndFacesDiagnosticCode;
var OWN12 = { input: CODE13.INPUT, owned: CODE13.OWNED, budget: CODE13.BUDGET, fail: (code, detail) => {
  throw new TranslatedSurfaceEndFacesError(code, detail);
}, wrap: (code, detail, cause) => {
  throw new TranslatedSurfaceEndFacesError(code, detail, cause);
}, isRefusal: (e) => e instanceof TranslatedSurfaceEndFacesError, finite: FINITE_REPRESENTED_OWN_NUMBERS_REQUIRED, dense: DENSE_BOUNDED_ARRAYS_REQUIRED };

// packages/barocss-cad/dist/translated-strip/qualified-translated-strip-body.js
var QualifiedTranslatedStripBodyDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", PARENT: "PARENT", PAIR: "PAIR", SOURCE: "SOURCE", TOPOLOGY: "TOPOLOGY", MATERIAL: "MATERIAL", ORIENTATION: "ORIENTATION", REPRESENTABILITY: "REPRESENTABILITY", BINDING: "BINDING", NATIVE: "NATIVE", OWNED: "OWNED" });

// packages/barocss-cad/dist/translated-strip/translated-surface-strip-world-points.js
var TranslatedSurfaceStripWorldPointDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", PARENT: "PARENT", SUPPORT: "SUPPORT", REPRESENTABILITY: "REPRESENTABILITY", BINDING: "BINDING", OWNED: "OWNED" });

// packages/barocss-cad/dist/features/nurbs-source-loft-feature-graph.js
var NurbsSourceLoftFeatureGraphDiagnosticCode = Object.freeze({ INPUT: "INPUT", VERSION: "VERSION", IDENTITY: "IDENTITY", REVISION: "REVISION", BUDGET: "BUDGET", SOURCE: "SOURCE", REFERENCE: "REFERENCE", DEPENDENCY: "DEPENDENCY", BASIS: "BASIS", STATIONS: "STATIONS", NATIVE: "NATIVE", REPRESENTABILITY: "REPRESENTABILITY", CODEC: "CODEC", OWNED: "OWNED" });

// packages/barocss-cad/dist/exact-proof/exact-surface-band-trim.js
var ExactSurfaceBandTrimDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", PARENT: "PARENT", PAIR: "PAIR", SUPPORT: "SUPPORT", BAND: "BAND", EMBEDDING: "EMBEDDING", REPRESENTABILITY: "REPRESENTABILITY", BINDING: "BINDING", NATIVE: "NATIVE", OWNED: "OWNED" });
var ExactSurfaceBandTrimError = class extends KernelError {
  code;
  constructor(code, detail, cause) {
    super(("Exact original Surface band trim: " + detail).slice(0, 1024), cause === void 0 ? void 0 : { cause });
    this.name = "ExactSurfaceBandTrimError";
    this.code = code;
  }
};
var CODE14 = ExactSurfaceBandTrimDiagnosticCode;
var OWN13 = { input: CODE14.INPUT, owned: CODE14.OWNED, budget: CODE14.BUDGET, fail: (code, detail) => {
  throw new ExactSurfaceBandTrimError(code, detail);
}, wrap: (code, detail, cause) => {
  throw new ExactSurfaceBandTrimError(code, detail, cause);
}, isRefusal: (e) => e instanceof ExactSurfaceBandTrimError, finite: FINITE_REPRESENTED_OWN_NUMBERS_REQUIRED, dense: DENSE_BOUNDED_ARRAYS_REQUIRED };

// packages/barocss-cad/dist/translated-strip/translated-strip-interval-boolean.js
var TranslatedStripIntervalBooleanDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", PARENT: "PARENT", SUPPORT: "SUPPORT", PAIR: "PAIR", REPRESENTABILITY: "REPRESENTABILITY", BINDING: "BINDING", CONSTRUCTION: "CONSTRUCTION", OWNED: "OWNED" });

// packages/barocss-cad/dist/translated-strip/qualified-translated-strip-body-mesh.js
var QualifiedTranslatedStripBodyMeshDiagnosticCode = Object.freeze({ INPUT: "INPUT", BUDGET: "BUDGET", BODY: "BODY", SOURCE: "SOURCE", TOPOLOGY: "TOPOLOGY", UV: "UV", NATIVE: "NATIVE", ORIENTATION: "ORIENTATION", REPRESENTABILITY: "REPRESENTABILITY", FILE: "FILE", OWNED: "OWNED" });

// packages/barocss-cad/dist/nurbs/source-wide/source-curve-knot-insertion.js
var SourceCurveKnotInsertionDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  VERSION: "VERSION",
  IDENTITY: "IDENTITY",
  SOURCE: "SOURCE",
  TARGET: "TARGET",
  REQUEST: "REQUEST",
  BUDGET: "BUDGET",
  REPRESENTABILITY: "REPRESENTABILITY",
  BINDING: "BINDING",
  NATIVE: "NATIVE",
  OWNED: "OWNED",
  FILE: "FILE"
});

// packages/barocss-cad/dist/nurbs/source-wide/source-surface-knot-insertion.js
var SourceSurfaceKnotInsertionDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  VERSION: "VERSION",
  IDENTITY: "IDENTITY",
  SOURCE: "SOURCE",
  TARGET: "TARGET",
  REQUEST: "REQUEST",
  BUDGET: "BUDGET",
  REPRESENTABILITY: "REPRESENTABILITY",
  BINDING: "BINDING",
  NATIVE: "NATIVE",
  OWNED: "OWNED",
  FILE: "FILE"
});

// packages/barocss-cad/dist/nurbs/source-wide/source-curve-interval-extraction.js
var SourceCurveIntervalExtractionDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  VERSION: "VERSION",
  IDENTITY: "IDENTITY",
  SOURCE: "SOURCE",
  TARGET: "TARGET",
  INTERVAL: "INTERVAL",
  BUDGET: "BUDGET",
  REPRESENTABILITY: "REPRESENTABILITY",
  BINDING: "BINDING",
  NATIVE: "NATIVE",
  OWNED: "OWNED",
  FILE: "FILE"
});

// packages/barocss-cad/dist/nurbs/source-wide/source-knot-aligned-loft.js
var SourceKnotAlignedLoftDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  VERSION: "VERSION",
  IDENTITY: "IDENTITY",
  SOURCE: "SOURCE",
  TARGET: "TARGET",
  BASIS: "BASIS",
  STATIONS: "STATIONS",
  BUDGET: "BUDGET",
  REPRESENTABILITY: "REPRESENTABILITY",
  INSERTION: "INSERTION",
  LOFT: "LOFT",
  BINDING: "BINDING",
  NATIVE: "NATIVE",
  OWNED: "OWNED",
  FILE: "FILE"
});

// packages/barocss-cad/dist/nurbs/source-wide/source-curve-degree-elevation.js
var SourceCurveDegreeElevationDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  VERSION: "VERSION",
  IDENTITY: "IDENTITY",
  SOURCE: "SOURCE",
  TARGET: "TARGET",
  DEGREE: "DEGREE",
  BASIS: "BASIS",
  BUDGET: "BUDGET",
  REPRESENTABILITY: "REPRESENTABILITY",
  BINDING: "BINDING",
  NATIVE: "NATIVE",
  OWNED: "OWNED",
  FILE: "FILE"
});

// packages/barocss-cad/dist/nurbs/source-wide/source-surface-degree-elevation.js
var SourceSurfaceDegreeElevationDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  VERSION: "VERSION",
  IDENTITY: "IDENTITY",
  SOURCE: "SOURCE",
  TARGET: "TARGET",
  BASIS: "BASIS",
  BUDGET: "BUDGET",
  REPRESENTABILITY: "REPRESENTABILITY",
  BINDING: "BINDING",
  NATIVE: "NATIVE",
  OWNED: "OWNED",
  FILE: "FILE"
});

// packages/barocss-cad/dist/io/iges-import.js
var IGESImportDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  FILE: "FILE",
  RECORD: "RECORD",
  GLOBAL: "GLOBAL",
  DIRECTORY: "DIRECTORY",
  PARAMETER: "PARAMETER",
  UNSUPPORTED: "UNSUPPORTED",
  BUDGET: "BUDGET",
  NUMBER: "NUMBER",
  NATIVE: "NATIVE",
  SOURCE: "SOURCE",
  BINDING: "BINDING",
  OWNED: "OWNED"
});

// packages/barocss-cad/dist/nurbs/source-wide/source-line-width-face.js
var SourceLineWidthFaceDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  VERSION: "VERSION",
  IDENTITY: "IDENTITY",
  SOURCE: "SOURCE",
  TARGET: "TARGET",
  PROFILE: "PROFILE",
  WIDTH: "WIDTH",
  REPRESENTABILITY: "REPRESENTABILITY",
  BUDGET: "BUDGET",
  RULED: "RULED",
  BOUNDARY: "BOUNDARY",
  FACE: "FACE",
  BINDING: "BINDING",
  OWNED: "OWNED",
  FILE: "FILE"
});

// packages/barocss-cad/dist/paired/paired-surface-intersection-branch.js
var PairedSurfaceIntersectionBranchDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  SOURCE: "SOURCE",
  REFERENCE: "REFERENCE",
  SUPPORT: "SUPPORT",
  DOMAIN: "DOMAIN",
  CONTINUITY: "CONTINUITY",
  REGULARITY: "REGULARITY",
  TANGENCY: "TANGENCY",
  CHART: "CHART",
  CONDITION: "CONDITION",
  REPRESENTABILITY: "REPRESENTABILITY",
  NATIVE: "NATIVE",
  STAGNATION: "STAGNATION",
  WORK: "WORK",
  BUDGET: "BUDGET",
  BINDING: "BINDING",
  FILE: "FILE",
  OWNED: "OWNED"
});
var TOLERANCE9 = CadNumericPolicy.linearTolerance;

// packages/barocss-cad/dist/translated-strip/translated-strip-plane-split.js
var TranslatedStripPlaneSplitDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  BUDGET: "BUDGET",
  PARENT: "PARENT",
  SOURCE: "SOURCE",
  REFERENCE: "REFERENCE",
  SUPPORT: "SUPPORT",
  CUT: "CUT",
  PARTITION: "PARTITION",
  ORIENTATION: "ORIENTATION",
  REPRESENTABILITY: "REPRESENTABILITY",
  BINDING: "BINDING",
  CONSTRUCTION: "CONSTRUCTION",
  VOLUME: "VOLUME",
  FILE: "FILE",
  CODEC: "CODEC",
  OWNED: "OWNED"
});

// packages/barocss-cad/dist/nurbs/source-wide/source-curve-adaptive-sampling.js
var SourceCurveAdaptiveSamplingDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  SOURCE: "SOURCE",
  REFERENCE: "REFERENCE",
  IDENTITY: "IDENTITY",
  SPAN: "SPAN",
  REPRESENTABILITY: "REPRESENTABILITY",
  BUDGET: "BUDGET",
  NATIVE: "NATIVE",
  BINDING: "BINDING",
  FILE: "FILE",
  OWNED: "OWNED"
});
var EPS10 = 64 * Number.EPSILON;

// packages/barocss-cad/dist/exact-proof/exact-paired-vlinear-surface-intersection.js
var ExactPairedVLinearSurfaceIntersectionDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  SOURCE: "SOURCE",
  REFERENCE: "REFERENCE",
  SUPPORT: "SUPPORT",
  DOMAIN: "DOMAIN",
  REPRESENTABILITY: "REPRESENTABILITY",
  BUDGET: "BUDGET",
  BINDING: "BINDING",
  NATIVE: "NATIVE",
  FILE: "FILE",
  OWNED: "OWNED"
});

// packages/barocss-cad/dist/paired/paired-surface-uv-split-faces.js
var PairedSurfaceUVSplitFacesDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  PARENT: "PARENT",
  SUPPORT: "SUPPORT",
  DOMAIN: "DOMAIN",
  ISO: "ISO",
  INTERVAL: "INTERVAL",
  REGION: "REGION",
  REPRESENTABILITY: "REPRESENTABILITY",
  BINDING: "BINDING",
  NATIVE: "NATIVE",
  BUDGET: "BUDGET",
  FILE: "FILE",
  OWNED: "OWNED"
});

// packages/barocss-cad/dist/paired/paired-surface-b-uv-split-faces.js
var PairedSurfaceBUVSplitFacesDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  PARENT: "PARENT",
  SUPPORT: "SUPPORT",
  DOMAIN: "DOMAIN",
  ISO: "ISO",
  INTERVAL: "INTERVAL",
  REGION: "REGION",
  REPRESENTABILITY: "REPRESENTABILITY",
  BINDING: "BINDING",
  NATIVE: "NATIVE",
  BUDGET: "BUDGET",
  FILE: "FILE",
  OWNED: "OWNED"
});

// packages/barocss-cad/dist/paired/paired-surface-uv-face-classification.js
var PairedSurfaceUVFaceClassificationDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  PARENT: "PARENT",
  BINDING: "BINDING",
  DOMAIN: "DOMAIN",
  BUDGET: "BUDGET",
  FILE: "FILE",
  OWNED: "OWNED"
});

// packages/barocss-cad/dist/paired/paired-surface-material-body.js
var PairedSurfaceMaterialBodyDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  PARENT: "PARENT",
  PROFILE: "PROFILE",
  SOURCE: "SOURCE",
  NATIVE: "NATIVE",
  CLOSURE: "CLOSURE",
  TOPOLOGY: "TOPOLOGY",
  MATERIAL: "MATERIAL",
  ORIENTATION: "ORIENTATION",
  DOMAIN: "DOMAIN",
  REPRESENTABILITY: "REPRESENTABILITY",
  BINDING: "BINDING",
  BUDGET: "BUDGET",
  FILE: "FILE",
  OWNED: "OWNED"
});

// packages/barocss-cad/dist/paired/paired-surface-material-body-world-points.js
var PairedSurfaceMaterialBodyWorldPointDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  IDENTITY: "IDENTITY",
  PARENT: "PARENT",
  BINDING: "BINDING",
  DOMAIN: "DOMAIN",
  BUDGET: "BUDGET",
  FILE: "FILE",
  OWNED: "OWNED"
});

// packages/barocss-cad/dist/sketch/xy-numerical-sketch-admission-internal.js
var XYNumericalSketchDiagnosticCode = Object.freeze({ INVALID_DOCUMENT: "INVALID_DOCUMENT", UNSUPPORTED: "UNSUPPORTED", LIMIT: "LIMIT", REFERENCE: "REFERENCE", NONCONVERGENCE: "NONCONVERGENCE", NUMERICAL: "NUMERICAL", BUDGET: "BUDGET", BRANCH: "BRANCH", DEGENERATE_GEOMETRY: "DEGENERATE_GEOMETRY", COMPILATION: "COMPILATION", OWNED: "OWNED" });

// packages/barocss-cad/dist/sketch/xy-numerical-sketch-solver-internal.js
var limits = Object.freeze({
  points: 16,
  segments: 16,
  constraints: 32,
  scalarResiduals: 64,
  unknowns: 32,
  branchGuards: 16,
  coordinateAbs: 1e4,
  minimumSegment: 1e-3,
  iterations: 100,
  evaluations: 1200
});
var limitsV1 = Object.freeze({ ...limits, points: 64, segments: 64, constraints: 128, scalarResiduals: 256, unknowns: 128, branchGuards: 32 });
var tolerances = Object.freeze({ linear: 1e-7, angular: 1e-9, rankRelative: 1e-10 });

// packages/barocss-cad/dist/convex-planar-solid-proof-internal.js
var ConvexPlanarSolidDiagnosticCode = Object.freeze({ INPUT: "INPUT", IDENTITY: "IDENTITY", BUDGET: "BUDGET", NATIVE: "NATIVE", OWNED: "OWNED", COVERAGE: "COVERAGE", BINDING: "BINDING", INCIDENCE: "INCIDENCE", CONVEXITY: "CONVEXITY", DEGENERATE: "DEGENERATE", REPRESENTABILITY: "REPRESENTABILITY" });

// packages/barocss-cad/dist/sketch/xy-circular-numerical-sketch-admission-internal.js
var XYCircularNumericalSketchDiagnosticCode = Object.freeze({ INVALID_DOCUMENT: "INVALID_DOCUMENT", UNSUPPORTED: "UNSUPPORTED", LIMIT: "LIMIT", REFERENCE: "REFERENCE", NONCONVERGENCE: "NONCONVERGENCE", NUMERICAL: "NUMERICAL", BUDGET: "BUDGET", BRANCH: "BRANCH", DEGENERATE_GEOMETRY: "DEGENERATE_GEOMETRY", COMPILATION: "COMPILATION", OWNED: "OWNED" });

// packages/barocss-cad/dist/sketch/xy-circular-numerical-sketch-solver-internal.js
var limits2 = Object.freeze({
  points: 16,
  segments: 8,
  circles: 4,
  constraints: 32,
  scalarResiduals: 64,
  unknowns: 32,
  branchGuards: 16,
  coordinateAbs: 1e4,
  minimumSegment: 1e-3,
  minimumRadiusMM: 1e-3,
  maximumRadiusMM: 1e4,
  iterations: 100,
  evaluations: 1200,
  sourceCharacters: 262144,
  sourceBytes: 262144
});

// packages/barocss-cad/dist/planar-solids/convex-planar-slab-subtraction-internal.js
var SLAB_LIMITS = Object.freeze({ inputBytes: 33554432, resultBytes: 67108864, cumulativeSnapshotBytes: 201326592, retainedSnapshotBytes: 134217728, inputValues: 2097152, resultValues: 4194304, inputDepth: 48, resultDepth: 56, inputStringCharacters: 16777216, resultStringCharacters: 33554432, arrayElements: 4096, recordFields: 64, keyCharacters: 128, stringCharacters: 262144, facesPerChild: 12, edgesPerFace: 8, usesPerChild: 64, verticesPerChild: 32, facetPlanePasses: 48, temporaryPolygonVertices: 20, classifications: 960, crossings: 96, candidateRecords: 256, coveragePredicates: 320, faceCompilations: 72, sourceCompilations: 72, bindingObservations: 1152, totalD1: 3456, rationalContexts: 5, rationalOperationsPerContext: 2e5, aggregateRationalOperations: 1e6, aggregateGcdSteps: 1e6, integerBits: 8192 });

// packages/barocss-cad/dist/features/extruded-profile-solid.js
var ExtrudedProfileDiagnosticCode = Object.freeze({
  INPUT: "INPUT",
  BUDGET: "BUDGET",
  GEOMETRY: "GEOMETRY",
  TOPOLOGY: "TOPOLOGY",
  SELF_INTERSECTION: "SELF_INTERSECTION"
});
var ExtrudedProfileLimits = Object.freeze({ segments: 64, coordinateMM: 1e4, minimumRadiusMM: 0.01, minimumLengthMM: 1e-4, tolerance: 1e-7 });
var TAU = Math.PI * 2;
function segmentCurve(s, z, id2) {
  if (s.kind === "line")
    return { kind: "curve", id: id2, degree: 1, knots: [0, 0, 1, 1], controlPoints: [[s.start[0], s.start[1], z], [s.end[0], s.end[1], z]], weights: [1, 1] };
  const spans = Math.max(1, Math.ceil(Math.abs(s.sweep) / (Math.PI / 2) - 1e-12));
  const dt = s.sweep / spans, w = Math.cos(Math.abs(dt) / 2);
  const cp = [], wt = [], knots = [0, 0, 0];
  for (let k = 0; k < spans; k++) {
    const t0 = s.startAngle + dt * k, tm = t0 + dt / 2;
    const p0 = k === 0 ? [s.start[0], s.start[1], z] : [s.center[0] + s.radius * Math.cos(t0), s.center[1] + s.radius * Math.sin(t0), z];
    const rm = s.radius / w;
    if (k === 0) {
      cp.push(p0);
      wt.push(1);
    }
    cp.push([s.center[0] + rm * Math.cos(tm), s.center[1] + rm * Math.sin(tm), z]);
    wt.push(w);
    const t1 = t0 + dt;
    cp.push(k === spans - 1 ? [s.end[0], s.end[1], z] : [s.center[0] + s.radius * Math.cos(t1), s.center[1] + s.radius * Math.sin(t1), z]);
    wt.push(1);
    if (k < spans - 1)
      knots.push((k + 1) / spans, (k + 1) / spans);
  }
  knots.push(1, 1, 1);
  return { kind: "curve", id: id2, degree: 2, knots, controlPoints: cp, weights: wt };
}
function extrudedSurface(curve, z0, z1, id2) {
  return {
    kind: "surface",
    id: id2,
    degreeU: curve.degree,
    degreeV: 1,
    knotsU: [...curve.knots],
    knotsV: [0, 0, 1, 1],
    controlPoints: curve.controlPoints.map((p) => [[p[0], p[1], z0], [p[0], p[1], z1]]),
    weights: curve.weights.map((w) => [w, w])
  };
}
function capSurface(bounds, z, id2, up) {
  const [x0, y0] = bounds.min, [x1, y1] = bounds.max;
  const grid = up ? [[[x0, y0, z], [x0, y1, z]], [[x1, y0, z], [x1, y1, z]]] : [[[x0, y0, z], [x1, y0, z]], [[x0, y1, z], [x1, y1, z]]];
  return { kind: "surface", id: id2, degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: grid, weights: [[1, 1], [1, 1]] };
}

// packages/barocss-cad/dist/mesh/facet-patch.js
function boundsOf(positions) {
  const b = new Float64Array([Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]);
  for (let i = 0; i < positions.length; i += 3)
    for (let k = 0; k < 3; k++) {
      const x = positions[i + k];
      if (x < b[k])
        b[k] = x;
      if (x > b[k + 3])
        b[k + 3] = x;
    }
  return b;
}
function transformFacetPatch(f, m, t) {
  const P = f.positions, out = new Float64Array(P.length);
  for (let i = 0; i < P.length; i += 3) {
    const x = P[i], y = P[i + 1], z = P[i + 2];
    out[i] = m[0] * x + m[1] * y + m[2] * z + t[0];
    out[i + 1] = m[3] * x + m[4] * y + m[5] * z + t[1];
    out[i + 2] = m[6] * x + m[7] * y + m[8] * z + t[2];
  }
  return { ...f, positions: out, bounds: boundsOf(out) };
}

// packages/barocss-cad/dist/brep/brep-core.js
var BrepError = class extends KernelError {
  code;
  report;
  reason;
  constructor(code, detail, report, reason) {
    super(("B-rep: " + detail).slice(0, 1024));
    this.code = code;
    this.report = report;
    this.reason = reason;
    this.name = "BrepError";
  }
};
var isFacetFace = (face) => face.surface.kind === "facets";
function buildBrep(input) {
  let scale3 = 0;
  for (const v of input.vertices)
    for (const x of v.point)
      scale3 = Math.max(scale3, Math.abs(x));
  for (const b of input.bodies)
    for (const s of b.shells)
      for (const f of s.faces)
        if (f.surface.kind === "facets")
          for (const x of f.surface.bounds)
            scale3 = Math.max(scale3, Math.abs(x));
  const tol = input.tolerance ?? Math.max(CadNumericPolicy.linearTolerance, CadNumericPolicy.relativeLinearTolerance * scale3);
  const bodies = [], shells = [], faces = [], loops = [], coedges = [];
  const mutable = [];
  for (const b of input.bodies) {
    const shellIds = [];
    for (const s of b.shells) {
      const shellId = `${b.id}/${s.id}`;
      shellIds.push(shellId);
      const faceIds = [];
      for (const f of s.faces) {
        const faceId = `${shellId}/${f.id}`;
        faceIds.push(faceId);
        const loopIds = [];
        f.loops.forEach((l, li) => {
          const loopId = `${faceId}/l${li}`;
          loopIds.push(loopId);
          const ids = l.uses.map((_, ci) => `${loopId}/c${ci}`);
          l.uses.forEach((u, ci) => mutable.push({ id: ids[ci], edge: u.edge, sense: u.sense, loop: loopId, next: ids[(ci + 1) % ids.length], prev: ids[(ci - 1 + ids.length) % ids.length], twin: null, pcurve: u.pcurve ?? null }));
          loops.push({ id: loopId, face: faceId, kind: l.kind, coedges: ids });
        });
        faces.push({ id: faceId, shell: shellId, surface: f.surface, sense: f.sense, loops: loopIds, ...f.name === void 0 ? {} : { name: f.name } });
      }
      shells.push({ id: shellId, body: b.id, faces: faceIds, closed: s.closed });
    }
    bodies.push({ id: b.id, kind: b.kind, shells: shellIds });
  }
  const byEdge = /* @__PURE__ */ new Map();
  for (const c of mutable) {
    const list = byEdge.get(c.edge);
    if (list)
      list.push(c);
    else
      byEdge.set(c.edge, [c]);
  }
  for (const uses of byEdge.values())
    if (uses.length === 2 && uses[0].sense !== uses[1].sense) {
      uses[0].twin = uses[1].id;
      uses[1].twin = uses[0].id;
    }
  for (const c of mutable)
    coedges.push(c);
  return {
    format: "barocss-brep",
    version: 0,
    lengthUnit: "mm",
    source: input.source,
    bodies,
    shells,
    faces,
    loops,
    coedges,
    edges: input.edges.map((e) => ({ id: e.id, curve: e.curve, vertices: [e.vertices[0], e.vertices[1]], tolerance: Math.max(tol, e.tolerance ?? 0), ...e.name === void 0 ? {} : { name: e.name } })),
    vertices: input.vertices.map((v) => ({ id: v.id, point: [v.point[0], v.point[1], v.point[2]], tolerance: Math.max(tol, v.tolerance ?? 0) }))
  };
}
var lineCurve = (id2, a, b) => ({ kind: "curve", id: id2, degree: 1, knots: [0, 0, 1, 1], controlPoints: [[...a], [...b]], weights: [1, 1] });

// packages/barocss-cad/dist/mesh/facet-brep.js
function weldVertices(positions, n, weld) {
  let cap = 16;
  while (cap < 2 * n)
    cap *= 2;
  const table = new Int32Array(cap).fill(-1), cells = new Float64Array(3 * n), out = new Float64Array(3 * n), remap = new Uint32Array(n);
  let m = 0;
  for (let v = 0; v < n; v++) {
    const x = positions[3 * v], y = positions[3 * v + 1], z = positions[3 * v + 2];
    const fx = x / weld, fy = y / weld, fz = z / weld, cx = Math.round(fx), cy = Math.round(fy), cz = Math.round(fz);
    let k = cellHolder(table, cells, cap, cx, cy, cz);
    if (k < 0) {
      const sx = fx < cx ? -1 : 1, sy = fy < cy ? -1 : 1, sz = fz < cz ? -1 : 1;
      for (let c = 1; c < 8 && k < 0; c++) {
        const h = cellHolder(table, cells, cap, cx + (c & 1 ? sx : 0), cy + (c & 2 ? sy : 0), cz + (c & 4 ? sz : 0));
        if (h >= 0 && Math.hypot(out[3 * h] - x, out[3 * h + 1] - y, out[3 * h + 2] - z) <= weld)
          k = h;
      }
      if (k < 0) {
        let h = cellHash(cx, cy, cz, cap);
        while (table[h] >= 0)
          h = h + 1 & cap - 1;
        table[h] = m;
        cells[3 * m] = cx;
        cells[3 * m + 1] = cy;
        cells[3 * m + 2] = cz;
        out[3 * m] = x;
        out[3 * m + 1] = y;
        out[3 * m + 2] = z;
        k = m++;
      }
    }
    remap[v] = k;
  }
  return { P: out.slice(0, 3 * m), remap };
}
var cellHash = (cx, cy, cz, cap) => (Math.imul(cx | 0, 73856093) ^ Math.imul(cy | 0, 19349663) ^ Math.imul(cz | 0, 83492791) ^ Math.imul(cx / 4294967296 | 0, 2654435761)) & cap - 1;
function cellHolder(table, cells, cap, cx, cy, cz) {
  for (let h = cellHash(cx, cy, cz, cap); ; h = h + 1 & cap - 1) {
    const k = table[h];
    if (k < 0)
      return -1;
    if (cells[3 * k] === cx && cells[3 * k + 1] === cy && cells[3 * k + 2] === cz)
      return k;
  }
}

// packages/barocss-cad/dist/mesh/triangle-bvh.js
var stack = new Int32Array(256);

// packages/barocss-cad/dist/mesh/facet-bvh.js
var DIRECTIONS = [[0.5773, 0.6007, 0.5531], [-0.4352, 0.7934, 0.4256], [0.6913, -0.3418, 0.6366], [-0.2672, -0.5389, 0.7988], [0.8123, 0.4977, -0.3042], [-0.7311, 0.1873, -0.656], [0.1391, -0.9134, -0.3826], [0.3529, 0.2214, -0.9091]].map((d) => {
  const l = Math.hypot(d[0], d[1], d[2]);
  return [d[0] / l, d[1] / l, d[2] / l];
});
var stack2 = new Int32Array(256);

// packages/barocss-cad/dist/mesh/mesh-decimate.js
var n1 = new Float64Array(3);
var n2 = new Float64Array(3);
var pair = new Int32Array(4);
var place = new Float64Array(3);
var two = new Int32Array(3);

// packages/barocss-cad/dist/mesh/mesh-clearance.js
var TA = new Float64Array(9);
var TB = new Float64Array(9);
var CP = new Float64Array(6);
var BEST = new Float64Array(6);
var stack3 = new Int32Array(512);
var Q = new Float64Array(3);
var S = new Float64Array(6);

// packages/barocss-cad/dist/mesh/voxel-field.js
var IDS = new Int32Array(4);
var PIN = new Int32Array(4);
var POUT = new Int32Array(4);

// packages/barocss-cad/dist/features/subd-sd2.js
var GP = new Float64Array(3);
var GU = new Float64Array(3);
var GV = new Float64Array(3);
var BU = new Float64Array(4);
var BV = new Float64Array(4);
var DU = new Float64Array(4);
var DV = new Float64Array(4);

// packages/barocss-cad/dist/nurbs/surfaces/surface-revolution.js
var TAU2 = 2 * Math.PI;

// packages/barocss-cad/dist/core/extent.js
function minAt(ps, k) {
  let r = Infinity;
  for (let i = 0; i < ps.length; i++) {
    const x = ps[i][k];
    if (x !== x)
      return NaN;
    if (x < r || x === 0 && r === 0 && Object.is(x, -0))
      r = x;
  }
  return r;
}
function maxAt(ps, k) {
  let r = -Infinity;
  for (let i = 0; i < ps.length; i++) {
    const x = ps[i][k];
    if (x !== x)
      return NaN;
    if (x > r || x === 0 && r === 0 && Object.is(r, -0))
      r = x;
  }
  return r;
}

// packages/barocss-cad/dist/brep/curved-arrangement.js
var curvedArrangementError = (detail) => kernelRefusal("curved-arrangement", "CURVED_ARRANGEMENT", "Curved arrangement: " + detail);
var TWO_PI = 2 * Math.PI;
var curveT = (s, u) => s.t0 + (s.t1 - s.t0) * u;
var segStart = (s) => s.kind === "line" ? s.a : s.kind === "curve" ? s.f(s.t0) : [s.c[0] + s.r * Math.cos(s.t0), s.c[1] + s.r * Math.sin(s.t0)];
var segEnd = (s) => s.kind === "line" ? s.b : s.kind === "curve" ? s.f(s.t1) : [s.c[0] + s.r * Math.cos(s.t0 + s.sweep), s.c[1] + s.r * Math.sin(s.t0 + s.sweep)];
var segAt = (s, u) => s.kind === "line" ? [s.a[0] + (s.b[0] - s.a[0]) * u, s.a[1] + (s.b[1] - s.a[1]) * u] : s.kind === "curve" ? s.f(curveT(s, u)) : [s.c[0] + s.r * Math.cos(s.t0 + s.sweep * u), s.c[1] + s.r * Math.sin(s.t0 + s.sweep * u)];
var segReverse = (s) => s.kind === "line" ? { ...s, a: s.b, b: s.a } : s.kind === "curve" ? { ...s, t0: s.t1, t1: s.t0 } : { ...s, t0: s.t0 + s.sweep, sweep: -s.sweep };
function segPart(s, u0, u1, a, b) {
  return s.kind === "line" ? { ...s, a, b } : s.kind === "curve" ? { ...s, t0: curveT(s, u0), t1: curveT(s, u1) } : { ...s, t0: s.t0 + s.sweep * u0, sweep: s.sweep * (u1 - u0) };
}
var GL8 = (() => {
  const x = [0.1834346424956498, 0.525532409916329, 0.7966664774136267, 0.9602898564975363], w = [0.362683783378362, 0.3137066458778873, 0.2223810344533745, 0.1012285362903763];
  return [...x.map((v, i) => [(1 - v) / 2, w[i] / 2]), ...x.map((v, i) => [(1 + v) / 2, w[i] / 2])];
})();
function integrate(s, g) {
  let acc = 0;
  const pieces = 16, h = 1e-6;
  for (let k = 0; k < pieces; k++)
    for (const [x, w] of GL8) {
      const u = (k + x) / pieces, p = segAt(s, u), a = segAt(s, Math.max(0, u - h)), b = segAt(s, Math.min(1, u + h)), du = Math.min(1, u + h) - Math.max(0, u - h);
      acc += g(p, [(b[0] - a[0]) / du, (b[1] - a[1]) / du]) * w / pieces;
    }
  return acc;
}
var areas = /* @__PURE__ */ new WeakMap();
var polyline = (s, n) => s.kind === "curve" && n === CURVE_SAMPLES ? samplesOf(s) : Array.from({ length: n + 1 }, (_, k) => segAt(s, k / n));
var sampled = /* @__PURE__ */ new WeakMap();
function samples(s) {
  let r = sampled.get(s);
  if (!r) {
    const ps = Array.from({ length: CURVE_SAMPLES + 1 }, (_, k) => segAt(s, k / CURVE_SAMPLES)), lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];
    let pad = 0;
    for (let k = 0; k <= CURVE_SAMPLES; k++) {
      for (const a of [0, 1]) {
        lo[a] = Math.min(lo[a], ps[k][a]);
        hi[a] = Math.max(hi[a], ps[k][a]);
      }
      if (k)
        pad = Math.max(pad, Math.hypot(ps[k][0] - ps[k - 1][0], ps[k][1] - ps[k - 1][1]));
    }
    r = { ps, lo: [lo[0] - pad, lo[1] - pad], hi: [hi[0] + pad, hi[1] + pad] };
    sampled.set(s, r);
  }
  return r;
}
var samplesOf = (s) => samples(s).ps;
var denseSampled = /* @__PURE__ */ new WeakMap();
function denseSamples(s) {
  let r = denseSampled.get(s);
  if (!r) {
    r = Array.from({ length: CURVE_SAMPLES * 2 + 1 }, (_, k) => segAt(s, k / (CURVE_SAMPLES * 2)));
    denseSampled.set(s, r);
  }
  return r;
}
var surelyOff = (s, p, eps) => {
  if (s.kind !== "curve")
    return false;
  const { lo, hi } = samples(s);
  return p[0] < lo[0] - eps || p[1] < lo[1] - eps || p[0] > hi[0] + eps || p[1] > hi[1] + eps;
};
var CURVE_SAMPLES = 64;
var LIES_ALONG_FIRST = [0.5, 0, 1];
var LINE_US = [0, 1];
var DENSE_US = Array.from({ length: CURVE_SAMPLES * 2 + 1 }, (_, k) => k / (CURVE_SAMPLES * 2));
function segArea(s) {
  if (s.kind === "line")
    return (s.a[0] * s.b[1] - s.b[0] * s.a[1]) / 2;
  if (s.kind === "curve") {
    let a = areas.get(s);
    if (a === void 0) {
      a = integrate(s, (p, d) => (p[0] * d[1] - p[1] * d[0]) / 2);
      areas.set(s, a);
    }
    return a;
  }
  const t1 = s.t0 + s.sweep;
  return (s.r * s.r * s.sweep + s.c[0] * s.r * (Math.sin(t1) - Math.sin(s.t0)) - s.c[1] * s.r * (Math.cos(t1) - Math.cos(s.t0))) / 2;
}
var ringArea = (ring) => ring.reduce((a, s) => a + segArea(s), 0);
var regionArea = (r) => ringArea(r.outer) + r.holes.reduce((a, h) => a + ringArea(h), 0);
function sampleRing(ring, step = Math.PI / 36) {
  return ring.flatMap((s) => {
    const n = s.kind === "line" ? 1 : s.kind === "curve" ? CURVE_SAMPLES : Math.max(2, Math.ceil(Math.abs(s.sweep) / step));
    return Array.from({ length: n }, (_, k) => segAt(s, k / n));
  });
}
var pointInPolygon = (p, poly) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0])
      c = !c;
  }
  return c;
};
function liesAlong(a, b, eps) {
  for (const u of LIES_ALONG_FIRST) {
    const p = segAt(a, u);
    if (surelyOff(b, p, eps) || segDistance(b, p) > eps)
      return false;
  }
  const ps = a.kind === "curve" ? samplesOf(a) : polyline(a, CURVE_SAMPLES);
  for (const p of ps)
    if (surelyOff(b, p, eps) || segDistance(b, p) > eps)
      return false;
  return true;
}
function segD2(s, p, u) {
  const q2 = segAt(s, u);
  return (q2[0] - p[0]) ** 2 + (q2[1] - p[1]) ** 2;
}
function goldenNearest(s, p, lo, hi) {
  for (let i = 0; i < 60; i++) {
    const m1 = hi - (hi - lo) * 0.6180339887, m2 = lo + (hi - lo) * 0.6180339887;
    if (segD2(s, p, m1) < segD2(s, p, m2))
      hi = m2;
    else
      lo = m1;
  }
  return (lo + hi) / 2;
}
function paramOf(s, p) {
  if (s.kind === "curve") {
    const ps = samplesOf(s);
    let best = 0, bd = Infinity;
    for (let k = 0; k <= CURVE_SAMPLES; k++) {
      const q2 = ps[k], v = (q2[0] - p[0]) ** 2 + (q2[1] - p[1]) ** 2;
      if (v < bd) {
        bd = v;
        best = k;
      }
    }
    const lo = Math.max(0, (best - 1) / CURVE_SAMPLES), hi = Math.min(1, (best + 1) / CURVE_SAMPLES);
    const u0 = goldenNearest(s, p, lo, hi), d0 = segD2(s, p, u0), on = 1e-6 * (1 + Math.abs(p[0]) + Math.abs(p[1])), N = CURVE_SAMPLES;
    const closed = Math.hypot(ps[0][0] - ps[N][0], ps[0][1] - ps[N][1]) <= on;
    if (d0 > on * on)
      for (const k of nearerChords(ps, p, d0)) {
        if (closed && (best === N && k === 0 || best === 0 && k === N - 1))
          continue;
        const u = goldenNearest(s, p, Math.max(0, (k - 0.5) / CURVE_SAMPLES), Math.min(1, (k + 1.5) / CURVE_SAMPLES));
        if (segD2(s, p, u) <= on * on)
          return u;
      }
    return u0;
  }
  if (s.kind === "line") {
    const d = [s.b[0] - s.a[0], s.b[1] - s.a[1]], l2 = d[0] * d[0] + d[1] * d[1];
    return ((p[0] - s.a[0]) * d[0] + (p[1] - s.a[1]) * d[1]) / l2;
  }
  const dir = Math.sign(s.sweep), w = Math.abs(s.sweep);
  let dt = (Math.atan2(p[1] - s.c[1], p[0] - s.c[0]) - s.t0) * dir;
  dt = (dt % TWO_PI + TWO_PI) % TWO_PI;
  if (dt > w && TWO_PI - dt < dt - w)
    dt -= TWO_PI;
  return dt / w;
}
function nearerChords(ps, p, d2) {
  const out = [];
  for (let k = 0; k + 1 < ps.length; k++) {
    const a = ps[k], b = ps[k + 1], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    const t = l2 > 0 ? Math.min(1, Math.max(0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0, ex = a[0] + t * dx - p[0], ey = a[1] + t * dy - p[1], d = ex * ex + ey * ey;
    if (d < d2)
      out.push({ k, d });
  }
  return out.sort((x, y) => x.d - y.d).map((x) => x.k);
}
function segDistance(s, p) {
  const q2 = segAt(s, Math.min(1, Math.max(0, paramOf(s, p))));
  return Math.hypot(q2[0] - p[0], q2[1] - p[1]);
}
function touchOfEnd(s, t, u, m, eps) {
  if ([segStart(s), segEnd(s), segStart(t), segEnd(t)].some((q2) => Math.hypot(q2[0] - m[0], q2[1] - m[1]) <= eps))
    return false;
  for (const [e, ue] of [[segStart(s), 0], [segEnd(s), 1]]) {
    if (Math.abs(u - ue) > 0.25 || segDistance(t, e) > eps)
      continue;
    let hug = true;
    for (let k = 1; k < 8 && hug; k++)
      hug = segDistance(t, segAt(s, ue + (u - ue) * k / 8)) <= eps;
    if (hug && leavesAwayFromEnds(s, t, e, ue, Math.abs(u - ue), eps))
      return true;
  }
  return false;
}
function leavesAwayFromEnds(s, t, e, ue, from, eps) {
  const dir = ue === 0 ? 1 : -1;
  let prev = segAt(s, ue + dir * from);
  for (let k = 1; k <= 64; k++) {
    const x = from + (1 - from) * k / 64, q2 = segAt(s, ue + dir * x);
    if (segDistance(t, q2) > eps) {
      const step = Math.hypot(q2[0] - prev[0], q2[1] - prev[1]) + eps;
      const last = prev;
      return ![segStart(t), segEnd(t)].some((w) => Math.hypot(w[0] - e[0], w[1] - e[1]) > eps && Math.hypot(w[0] - last[0], w[1] - last[1]) <= step);
    }
    prev = q2;
  }
  return false;
}
function overlapEnds(s, t, points, eps) {
  if (points.length < 3)
    return points;
  const at2 = points.map((p) => ({ p, u: paramOf(s, p) })).sort((a, b) => a.u - b.u);
  const along = at2.slice(0, -1).map((a, i) => {
    const q2 = segAt(s, (a.u + at2[i + 1].u) / 2);
    return segDistance(t, q2) <= eps;
  });
  return at2.filter((_, i) => !(i > 0 && i < at2.length - 1 && along[i - 1] && along[i])).map((a) => a.p);
}
function grazePolyline(seg, P, n, line) {
  const dx = line.b[0] - line.a[0], dy = line.b[1] - line.a[1], l = Math.hypot(dx, dy), points = [P[0]], us = [0];
  for (let i = 0; i < n; i++) {
    const a = P[i], b = P[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l > 0 && L > 0) {
      const sa = (dx * (a[1] - line.a[1]) - dy * (a[0] - line.a[0])) / l, sb = (dx * (b[1] - line.a[1]) - dy * (b[0] - line.a[0])) / l;
      const f = ((a[0] + b[0]) / 2 - line.a[0]) * dx / (l * l) + ((a[1] + b[1]) / 2 - line.a[1]) * dy / (l * l);
      if (Math.min(Math.abs(sa), Math.abs(sb)) <= L && f >= 0 && f <= 1)
        for (let k = 1; k < 8; k++) {
          const u = (i + k / 8) / n;
          points.push(segAt(seg, u));
          us.push(u);
        }
    }
    points.push(b);
    us.push((i + 1) / n);
  }
  return { points, us };
}
function grazeCrossings(curve, line, R, eps) {
  const dx = line.b[0] - line.a[0], dy = line.b[1] - line.a[1], l = Math.hypot(dx, dy), out = [];
  if (!(l > 0))
    return out;
  let lastU = R.us[0], lastD = (dx * (R.points[0][1] - line.a[1]) - dy * (R.points[0][0] - line.a[0])) / l;
  for (let i = 1; i < R.points.length; i++) {
    const p = R.points[i], d = (dx * (p[1] - line.a[1]) - dy * (p[0] - line.a[0])) / l, u = R.us[i];
    if (Math.abs(d) <= eps && Math.abs(lastD) <= eps) {
      lastU = u;
      lastD = d;
      continue;
    }
    if (d === 0)
      out.push(p);
    else if (lastD !== 0 && d > 0 !== lastD > 0) {
      let lo = lastU, hi = u, dl = lastD;
      for (let it = 0; it < 60; it++) {
        const m = (lo + hi) / 2, q2 = segAt(curve, m), dm = (dx * (q2[1] - line.a[1]) - dy * (q2[0] - line.a[0])) / l;
        if (dm === 0) {
          lo = hi = m;
          break;
        }
        if (dm > 0 === dl > 0) {
          lo = m;
          dl = dm;
        } else
          hi = m;
      }
      out.push(segAt(curve, (lo + hi) / 2));
    }
    lastU = u;
    lastD = d;
  }
  return out;
}
function crossesAt(s, t, u, v, eps) {
  const Q2 = segAt(t, v), Q1 = segAt(t, Math.min(1, v + 1e-6)), Q0 = segAt(t, Math.max(0, v - 1e-6)), tx = Q1[0] - Q0[0], ty = Q1[1] - Q0[1], l = Math.hypot(tx, ty);
  if (!(l > 0))
    return false;
  const a = segAt(s, Math.max(0, u - 1e-3)), b = segAt(s, Math.min(1, u + 1e-3));
  const da = (tx * (a[1] - Q2[1]) - ty * (a[0] - Q2[0])) / l, db = (tx * (b[1] - Q2[1]) - ty * (b[0] - Q2[0])) / l;
  return Math.abs(da) > eps && Math.abs(db) > eps && da > 0 !== db > 0;
}
function intersectSegments(s, t, eps, graze = false) {
  const out = [], on = (x, p) => !surelyOff(x, p, eps) && segDistance(x, p) <= eps;
  const push = (p) => {
    if (on(s, p) && on(t, p))
      out.push(p);
  };
  const ends = () => {
    for (const p of [segStart(s), segEnd(s)])
      if (on(t, p) && on(s, p))
        out.push(p);
    for (const p of [segStart(t), segEnd(t)])
      push(p);
  };
  if (s.kind === "curve" || t.kind === "curve") {
    if (liesAlong(s, t, eps) || liesAlong(t, s, eps)) {
      ends();
      return overlapEnds(s, t, out, eps);
    }
    const n = (x) => x.kind === "line" ? 1 : x.kind === "curve" ? CURVE_SAMPLES : Math.max(4, Math.ceil(Math.abs(x.sweep) / (Math.PI / 32)));
    const ns = n(s), nt = n(t), A0 = polyline(s, ns), B0 = polyline(t, nt);
    if (graze && s.kind === "line" !== (t.kind === "line")) {
      const curve = s.kind === "line" ? t : s, line2 = s.kind === "line" ? s : t;
      const R = grazePolyline(curve, curve === s ? A0 : B0, curve === s ? ns : nt, line2);
      for (const p of grazeCrossings(curve, line2, R, eps))
        push(p);
      ends();
      return overlapEnds(s, t, out, eps);
    }
    const A = A0, B = B0;
    for (let i = 0; i < ns; i++)
      for (let j = 0; j < nt; j++) {
        const p = A[i], q2 = A[i + 1], r = B[j], w = B[j + 1], d1 = [q2[0] - p[0], q2[1] - p[1]], d2 = [w[0] - r[0], w[1] - r[1]], den = d1[0] * d2[1] - d1[1] * d2[0];
        if (Math.abs(den) < 1e-300)
          continue;
        const e = [r[0] - p[0], r[1] - p[1]], a = (e[0] * d2[1] - e[1] * d2[0]) / den, b = (e[0] * d1[1] - e[1] * d1[0]) / den;
        if (a < -0.25 || a > 1.25 || b < -0.25 || b > 1.25)
          continue;
        let u = (i + Math.min(1, Math.max(0, a))) / ns, v = (j + Math.min(1, Math.max(0, b))) / nt;
        const fromEnd = u === 1 || v === 1;
        for (let it = 0; it < 30; it++) {
          const P2 = segAt(s, u), Q3 = segAt(t, v), F = [P2[0] - Q3[0], P2[1] - Q3[1]], h = 1e-7;
          if (it === 0 && (u === 1 || v === 1) && Math.hypot(F[0], F[1]) <= eps)
            break;
          const hu = Math.min(1, u + h) - u || -h, hv = Math.min(1, v + h) - v || -h, Pu = segAt(s, u + hu), Qv = segAt(t, v + hv);
          const J = [(Pu[0] - P2[0]) / hu, -(Qv[0] - Q3[0]) / hv, (Pu[1] - P2[1]) / hu, -(Qv[1] - Q3[1]) / hv], det = J[0] * J[3] - J[1] * J[2];
          if (Math.abs(det) < 1e-300)
            break;
          const du = (F[0] * J[3] - F[1] * J[1]) / det, dv = (J[0] * F[1] - J[2] * F[0]) / det;
          const nu = Math.min(1, Math.max(0, u - du)), nv = Math.min(1, Math.max(0, v - dv)), held = nu === u && nv === v;
          u = nu;
          v = nv;
          if (held || Math.abs(du) < 1e-15 && Math.abs(dv) < 1e-15)
            break;
        }
        const P = segAt(s, u), Q2 = segAt(t, v);
        if (fromEnd && u !== 1 && v !== 1 && !crossesAt(s, t, u, v, eps))
          continue;
        if (Math.hypot(P[0] - Q2[0], P[1] - Q2[1]) <= eps) {
          const m = [(P[0] + Q2[0]) / 2, (P[1] + Q2[1]) / 2];
          if (!out.some((o) => Math.hypot(o[0] - m[0], o[1] - m[1]) <= eps) && !touchOfEnd(s, t, u, m, eps) && !touchOfEnd(t, s, v, m, eps))
            push(m);
        }
      }
    ends();
    return overlapEnds(s, t, out, eps);
  }
  if (s.kind === "line" && t.kind === "line") {
    const d1 = [s.b[0] - s.a[0], s.b[1] - s.a[1]], d2 = [t.b[0] - t.a[0], t.b[1] - t.a[1]], den = d1[0] * d2[1] - d1[1] * d2[0];
    const len2 = Math.hypot(...d1) * Math.hypot(...d2);
    if (Math.abs(den) <= 1e-12 * len2) {
      ends();
      return out;
    }
    const w = [t.a[0] - s.a[0], t.a[1] - s.a[1]], u = (w[0] * d2[1] - w[1] * d2[0]) / den;
    push([s.a[0] + d1[0] * u, s.a[1] + d1[1] * u]);
    ends();
    return out;
  }
  if (s.kind === "arc" && t.kind === "arc") {
    const dx = t.c[0] - s.c[0], dy = t.c[1] - s.c[1], d2 = Math.hypot(dx, dy);
    if (d2 <= eps) {
      ends();
      return out;
    }
    const a = (s.r * s.r - t.r * t.r + d2 * d2) / (2 * d2), h22 = s.r * s.r - a * a, band2 = 2 * eps * Math.min(s.r, t.r);
    if (h22 < -band2) {
      ends();
      return out;
    }
    const h = h22 > band2 ? Math.sqrt(h22) : 0, mx = s.c[0] + a * dx / d2, my = s.c[1] + a * dy / d2;
    push([mx + h * dy / d2, my - h * dx / d2]);
    if (h > 0)
      push([mx - h * dy / d2, my + h * dx / d2]);
    ends();
    return out;
  }
  const line = s.kind === "line" ? s : t, arc = s.kind === "arc" ? s : t;
  const d = [line.b[0] - line.a[0], line.b[1] - line.a[1]], l = Math.hypot(...d), ux = d[0] / l, uy = d[1] / l;
  const f = [line.a[0] - arc.c[0], line.a[1] - arc.c[1]], proj = f[0] * ux + f[1] * uy, dist2 = f[0] * f[0] + f[1] * f[1] - proj * proj, h2 = arc.r * arc.r - dist2;
  const band = 2 * eps * arc.r;
  if (h2 >= -band) {
    const h = h2 > band ? Math.sqrt(h2) : 0;
    for (const sgn of h > 0 ? [-1, 1] : [0]) {
      const k = -proj + sgn * h;
      push([line.a[0] + ux * k, line.a[1] + uy * k]);
    }
  }
  ends();
  return out;
}
var boxS = new Float64Array(4);
var boxT = new Float64Array(4);
var halves = (s) => {
  if (s.kind === "arc" && Math.abs(s.sweep) > Math.PI + 1e-12)
    return [{ ...s, sweep: s.sweep / 2 }, { ...s, t0: s.t0 + s.sweep / 2, sweep: s.sweep / 2 }];
  if (s.kind === "curve") {
    const a = segStart(s), b = segEnd(s);
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) <= 1e-9 * (1 + Math.abs(a[0]) + Math.abs(a[1]))) {
      const m = (s.t0 + s.t1) / 2;
      return [{ ...s, t1: m }, { ...s, t0: m }];
    }
  }
  return [s];
};
function curveTolerance(rings) {
  let scale3 = 0;
  for (const ring of rings)
    for (const s of ring)
      for (const q2 of s.kind === "line" ? [s.a, s.b] : s.kind === "curve" ? polyline(s, 8) : [[Math.abs(s.c[0]) + s.r, Math.abs(s.c[1]) + s.r]])
        scale3 = Math.max(scale3, Math.abs(q2[0]), Math.abs(q2[1]));
  return linearToleranceMM(scale3);
}
var traced = (x) => x.kind === "curve" && !x.exact;
function joinLooseEnds(points, edges, eps) {
  const degree = new Int32Array(points.length);
  for (const e of edges) {
    degree[e.u]++;
    degree[e.v]++;
  }
  for (let v = 0; v < points.length; v++) {
    if (degree[v] !== 1)
      continue;
    let e = 0;
    while (edges[e].u !== v && edges[e].v !== v)
      e++;
    const other = edges[e].u === v ? edges[e].v : edges[e].u;
    if (Math.hypot(points[other][0] - points[v][0], points[other][1] - points[v][1]) <= 10 * eps)
      continue;
    let best = -1, bd = 10 * eps;
    for (let w = 0; w < points.length; w++) {
      if (w === v || w === other || degree[w] === 0)
        continue;
      const d = Math.hypot(points[w][0] - points[v][0], points[w][1] - points[v][1]);
      if (d <= bd) {
        bd = d;
        best = w;
      }
    }
    if (best < 0)
      for (let w = 0, d0 = 100 * eps; w < points.length; w++) {
        if (w === v || w === other || degree[w] !== 1)
          continue;
        const d = Math.hypot(points[w][0] - points[v][0], points[w][1] - points[v][1]);
        if (d <= d0) {
          d0 = d;
          best = w;
        }
      }
    if (best >= 0) {
      if (edges[e].u === v)
        edges[e].u = best;
      else
        edges[e].v = best;
      degree[v] = 0;
      degree[best]++;
      continue;
    }
    const p = points[v];
    const short = Math.hypot(points[other][0] - p[0], points[other][1] - p[1]) <= 100 * eps;
    const tracedEnd = traced(edges[e].seg);
    let split = -1, at2 = 0, sd = 10 * eps;
    for (let f = 0; f < edges.length; f++) {
      const g2 = edges[f], tracedSeg = traced(g2.seg), reach = (tracedEnd ? tracedSeg ? 10 : 20 : tracedSeg ? 100 : 10) * eps;
      if (f === e || g2.u === v || g2.v === v || short && (g2.u === other || g2.v === other) || surelyOff(g2.seg, p, Math.max(sd, reach)))
        continue;
      const d = segDistance(g2.seg, p);
      if (d > reach || split >= 0 && d > sd)
        continue;
      const u = paramOf(g2.seg, p);
      if (u > 0 && u < 1) {
        sd = d;
        split = f;
        at2 = u;
      }
    }
    if (split < 0)
      continue;
    const g = edges[split];
    edges.push({ u: v, v: g.v, seg: segPart(g.seg, at2, 1, p, points[g.v]), count: new Map(g.count) });
    g.seg = segPart(g.seg, 0, at2, points[g.u], p);
    g.v = v;
    degree[v] += 2;
  }
}
function arrange(rings, tolerance, joinEnds = false) {
  const pieces = [];
  for (const { polygon, ring } of rings)
    for (const seg of ring)
      for (const h of halves(seg))
        pieces.push({ seg: h, polygon });
  const eps = tolerance ?? curveTolerance(rings.map((r) => r.ring));
  const points = [], grid = /* @__PURE__ */ new Map(), cell = eps * 64;
  const vid = (p) => {
    const gx = Math.floor(p[0] / cell), gy = Math.floor(p[1] / cell), r = 2 * eps;
    const x0 = p[0] - gx * cell <= r ? -1 : 0, x1 = (gx + 1) * cell - p[0] <= r ? 1 : 0, y0 = p[1] - gy * cell <= r ? -1 : 0, y1 = (gy + 1) * cell - p[1] <= r ? 1 : 0;
    for (let i = x0; i <= x1; i++)
      for (let j = y0; j <= y1; j++) {
        const g2 = grid.get(gx + i + "," + (gy + j));
        if (g2) {
          for (const v2 of g2)
            if (Math.hypot(points[v2][0] - p[0], points[v2][1] - p[1]) <= eps)
              return v2;
        }
      }
    const v = points.length;
    points.push(p);
    const k = gx + "," + gy, g = grid.get(k);
    if (g)
      g.push(v);
    else
      grid.set(k, [v]);
    return v;
  };
  const cuts = pieces.map((p) => [segStart(p.seg), segEnd(p.seg)]);
  const box = (s) => {
    if (s.kind === "curve") {
      const { lo, hi } = samples(s);
      return [lo[0] - eps, lo[1] - eps, hi[0] + eps, hi[1] + eps];
    }
    const pts = s.kind === "line" ? [s.a, s.b] : [segStart(s), segEnd(s), [s.c[0] - s.r, s.c[1] - s.r], [s.c[0] + s.r, s.c[1] + s.r]];
    return [minAt(pts, 0) - eps, minAt(pts, 1) - eps, maxAt(pts, 0) + eps, maxAt(pts, 1) + eps];
  };
  const boxes = pieces.map((p) => box(p.seg));
  for (let i = 0; i < pieces.length; i++)
    for (let j = i + 1; j < pieces.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1])
        continue;
      for (const p of intersectSegments(pieces[i].seg, pieces[j].seg, eps)) {
        cuts[i].push(p);
        cuts[j].push(p);
      }
    }
  const edges = [], edgesBetween = /* @__PURE__ */ new Map();
  pieces.forEach((pc, i) => {
    const params = cuts[i].map((p) => ({ u: Math.min(1, Math.max(0, paramOf(pc.seg, p))), v: vid(p) })).sort((x, y) => x.u - y.u);
    const stops = [];
    for (const st of params)
      if (!stops.length || stops[stops.length - 1].v !== st.v)
        stops.push(st);
    for (let k = 0; k + 1 < stops.length; k++) {
      const s0 = stops[k], s1 = stops[k + 1];
      if (s1.u - s0.u <= 0)
        continue;
      const seg = segPart(pc.seg, s0.u, s1.u, points[s0.v], points[s1.v]), mid = segAt(seg, 0.5);
      const forward = s0.v < s1.v, lo = forward ? s0.v : s1.v, hi = forward ? s1.v : s0.v;
      const key = lo + ":" + hi, list = edgesBetween.get(key) ?? [];
      let e = list.find((k2) => segDistance(edges[k2].seg, mid) <= 4 * eps);
      if (e === void 0) {
        e = edges.length;
        edges.push({ u: lo, v: hi, seg: forward ? seg : segReverse(seg), count: /* @__PURE__ */ new Map() });
        list.push(e);
        edgesBetween.set(key, list);
      }
      if (pc.polygon >= 0) {
        const c = edges[e].count;
        c.set(pc.polygon, (c.get(pc.polygon) ?? 0) + (forward ? 1 : -1));
      }
    }
  });
  if (joinEnds)
    joinLooseEnds(points, edges, eps);
  const half = [];
  edges.forEach((_, i) => {
    half.push({ from: edges[i].u, to: edges[i].v, edge: i, twin: 2 * i + 1, next: -1, face: -1 }, { from: edges[i].v, to: edges[i].u, edge: i, twin: 2 * i, next: -1, face: -1 });
  });
  const leaving = (h) => {
    const s = h.from === edges[h.edge].u ? edges[h.edge].seg : segReverse(edges[h.edge].seg);
    const norm = (a) => a <= -Math.PI + 1e-12 ? a + TWO_PI : a;
    if (s.kind === "line")
      return { angle: norm(Math.atan2(s.b[1] - s.a[1], s.b[0] - s.a[0])), curvature: 0 };
    if (s.kind === "curve") {
      const d = 1e-4, p0 = segAt(s, 0), p1 = segAt(s, d), p2 = segAt(s, 2 * d), v = [(p1[0] - p0[0]) / d, (p1[1] - p0[1]) / d], a = [(p2[0] - 2 * p1[0] + p0[0]) / (d * d), (p2[1] - 2 * p1[1] + p0[1]) / (d * d)];
      return { angle: norm(Math.atan2(v[1], v[0])), curvature: (v[0] * a[1] - v[1] * a[0]) / Math.hypot(v[0], v[1]) ** 3 };
    }
    const t = s.t0, dir = Math.sign(s.sweep);
    return { angle: norm(Math.atan2(Math.cos(t) * dir, -Math.sin(t) * dir)), curvature: dir / s.r };
  };
  const outgoing = points.map(() => []);
  half.forEach((h, i) => outgoing[h.from].push(i));
  const keyed = half.map(leaving);
  const delta = 1e3 * eps, rel = new Float64Array(half.length), segLeaving = (h) => half[h].from === edges[half[h].edge].u ? edges[half[h].edge].seg : segReverse(edges[half[h].edge].seg);
  for (const list of outgoing) {
    const a = list.map((h) => keyed[h].angle).sort((x, y) => x - y);
    let from = -Math.PI, gap = -1;
    for (let i = 0; i < a.length; i++) {
      const g = (i + 1 < a.length ? a[i + 1] : a[0] + TWO_PI) - a[i];
      if (g > gap) {
        gap = g;
        from = a[i] + g / 2;
      }
    }
    for (const h of list)
      rel[h] = ((keyed[h].angle - from) % TWO_PI + TWO_PI) % TWO_PI;
    list.sort((x, y) => {
      const d = rel[x] - rel[y];
      return Math.abs(d) > 1e-4 ? d : tangentOrder(segLeaving(x), segLeaving(y), rel[x], rel[y], from, d, keyed[x].curvature, keyed[y].curvature, delta);
    });
  }
  const pos = /* @__PURE__ */ new Map();
  outgoing.forEach((list) => list.forEach((h, k) => pos.set(h, k)));
  for (const h of half) {
    const list = outgoing[h.to], k = pos.get(h.twin);
    h.next = list[(k - 1 + list.length) % list.length];
  }
  const cycles = [];
  half.forEach((h, i) => {
    if (h.face >= 0)
      return;
    const c = [];
    let g = i;
    do {
      half[g].face = cycles.length;
      c.push(g);
      g = half[g].next;
    } while (g !== i && c.length <= half.length);
    cycles.push(c);
  });
  const segOfHalf = (h) => half[h].from === edges[half[h].edge].u ? edges[half[h].edge].seg : segReverse(edges[half[h].edge].seg);
  return { points, edges, half, cycles, segOfHalf, eps };
}
function tangentOrder(a, b, relA, relB, from, d, ka, kb, delta) {
  const L = 0.25 * Math.min(segLength(a), segLength(b)), p0 = segAt(a, 0), pa = pointAlong(a, L), pb = pointAlong(b, L);
  const ang = (q2) => ((Math.atan2(q2[1] - p0[1], q2[0] - p0[0]) - from) % TWO_PI + TWO_PI) % TWO_PI;
  const fix = (x, ref) => x - ref > Math.PI ? x - TWO_PI : ref - x > Math.PI ? x + TWO_PI : x;
  const c = fix(ang(pa), relA) - fix(ang(pb), relB);
  if (Math.abs(c) > 1e-12)
    return c;
  const k = d + (ka - kb) * delta / 2;
  return Math.abs(k) > 1e-15 ? k : ka - kb;
}
function segLength(g) {
  let l = 0, p = segAt(g, 0);
  for (let i = 1; i <= 64; i++) {
    const q2 = segAt(g, i / 64);
    l += Math.hypot(q2[0] - p[0], q2[1] - p[1]);
    p = q2;
  }
  return l;
}
function pointAlong(g, L) {
  let acc = 0, p = segAt(g, 0);
  for (let i = 1; i <= 64; i++) {
    const q2 = segAt(g, i / 64), d = Math.hypot(q2[0] - p[0], q2[1] - p[1]);
    if (acc + d >= L && d > 0) {
      const t = (L - acc) / d;
      return [p[0] + (q2[0] - p[0]) * t, p[1] + (q2[1] - p[1]) * t];
    }
    acc += d;
    p = q2;
  }
  return p;
}
function curveArrangementVertices(rings, tolerance) {
  return rings.length ? arrange(rings.map((ring) => ({ polygon: 0, ring })), tolerance).points : [];
}
function regions(arr, polygonCount) {
  const { points, edges, half, cycles, segOfHalf } = arr;
  const areaOf = (c) => c.reduce((a, h) => a + segArea(segOfHalf(h)), 0);
  const areas2 = cycles.map(areaOf), root = points.map((_, i) => i), find = (v) => {
    while (root[v] !== v)
      v = root[v] = root[root[v]];
    return v;
  };
  for (const e of edges)
    root[find(e.u)] = find(e.v);
  const comp = (c) => find(half[c[0]].from), sampled2 = cycles.map((c) => sampleRing(c.map(segOfHalf)));
  const faceOfCycle = cycles.map((c, i) => {
    if (areas2[i] > 0)
      return i;
    const p = points[half[c[0]].from], mine = comp(c);
    let best = -1, bestArea = Infinity;
    cycles.forEach((o, k) => {
      if (areas2[k] > 0 && comp(o) !== mine && areas2[k] < bestArea && pointInPolygon(p, sampled2[k])) {
        bestArea = areas2[k];
        best = k;
      }
    });
    return best;
  });
  const faceOfHalf = half.map((h) => faceOfCycle[h.face]), winding = /* @__PURE__ */ new Map([[-1, Array(polygonCount).fill(0)]]), queue = [-1];
  const halvesOf = /* @__PURE__ */ new Map();
  faceOfHalf.forEach((f, h) => halvesOf.set(f, [...halvesOf.get(f) ?? [], h]));
  while (queue.length) {
    const f = queue.shift(), w = winding.get(f);
    for (const h of halvesOf.get(f) ?? []) {
      const other = faceOfHalf[half[h].twin];
      if (winding.has(other))
        continue;
      const e = edges[half[h].edge], fwd = half[h].from === e.u;
      winding.set(other, w.map((x, p) => x - (e.count.get(p) ?? 0) * (fwd ? 1 : -1)));
      queue.push(other);
    }
  }
  return { faceOfHalf, winding, faceOfCycle, areas: areas2 };
}
function simplify(ring, eps) {
  const sameCarrier = (s, t) => {
    if (s.tag !== t.tag)
      return false;
    if (s.kind === "line" && t.kind === "line") {
      const d1 = [s.b[0] - s.a[0], s.b[1] - s.a[1]], d2 = [t.b[0] - t.a[0], t.b[1] - t.a[1]];
      return Math.abs(d1[0] * d2[1] - d1[1] * d2[0]) <= 1e-12 * Math.hypot(...d1) * Math.hypot(...d2) && d1[0] * d2[0] + d1[1] * d2[1] > 0;
    }
    if (s.kind === "arc" && t.kind === "arc")
      return Math.hypot(s.c[0] - t.c[0], s.c[1] - t.c[1]) <= eps && Math.abs(s.r - t.r) <= eps && Math.sign(s.sweep) === Math.sign(t.sweep);
    if (s.kind === "curve" && t.kind === "curve")
      return s.f === t.f && s.t1 === t.t0 && Math.sign(s.t1 - s.t0) === Math.sign(t.t1 - t.t0);
    return false;
  };
  const out = [...ring];
  for (let changed = true; changed && out.length > 1; ) {
    changed = false;
    for (let i = 0; i < out.length && out.length > 1; i++) {
      const s = out[i], t = out[(i + 1) % out.length];
      if (!sameCarrier(s, t))
        continue;
      const merged = s.kind === "line" ? { ...s, b: t.b } : s.kind === "curve" ? { ...s, t1: t.t1 } : { ...s, sweep: s.sweep + t.sweep };
      if (merged.kind === "arc" && Math.abs(merged.sweep) > Math.PI + 1e-12)
        continue;
      if (merged.kind === "curve" && halves(merged).length > 1)
        continue;
      out.splice(i, 1, merged);
      out.splice((i + 1) % out.length, 1);
      changed = true;
      break;
    }
  }
  return out;
}
function booleanCurveRegions(a, b, operation, tolerance, joinEnds = false) {
  const rings = [...a.map((ring) => ({ polygon: 0, ring })), ...b.map((ring) => ({ polygon: 1, ring }))];
  if (!rings.length)
    return [];
  const arr = arrange(rings, tolerance, joinEnds), { faceOfHalf, winding } = regions(arr, 2), { half, segOfHalf, eps } = arr;
  const pick = (w) => {
    const x = w[0] !== 0, y = w[1] !== 0;
    return operation === "union" ? x || y : operation === "intersection" ? x && y : operation === "difference" ? x && !y : x !== y;
  };
  const selected = /* @__PURE__ */ new Map();
  for (const [f, w] of winding)
    selected.set(f, f !== -1 && pick(w));
  const boundary = (h) => !!selected.get(faceOfHalf[h]) && !selected.get(faceOfHalf[half[h].twin]);
  const used = /* @__PURE__ */ new Set(), traced2 = [];
  half.forEach((_, h) => {
    if (!boundary(h) || used.has(h))
      return;
    const ring = [];
    let g = h;
    do {
      used.add(g);
      ring.push(segOfHalf(g));
      let n = half[g].next;
      while (!boundary(n))
        n = half[half[n].twin].next;
      g = n;
    } while (g !== h && ring.length <= half.length);
    traced2.push(simplify(ring, eps));
  });
  const outers = traced2.filter((r) => ringArea(r) > 0).map((outer) => ({ outer, holes: [], sample: sampleRing(outer) }));
  for (const hole of traced2.filter((r) => ringArea(r) <= 0)) {
    const probe = sampleRing(hole);
    let best = -1, bestArea = Infinity;
    outers.forEach((o, k) => {
      const ar = ringArea(o.outer);
      if (ar < bestArea && probe.some((p) => pointInPolygon(p, o.sample)) && pointInPolygon(segAt(hole[0], 0.5), o.sample)) {
        bestArea = ar;
        best = k;
      }
    });
    if (best < 0)
      throw curvedArrangementError("a result hole has no enclosing ring");
    outers[best].holes.push(hole);
  }
  return outers.map((o) => ({ outer: o.outer, holes: o.holes }));
}
function regionMoments(region) {
  const m = [0, 0, 0, 0, 0, 0];
  const add3 = (x, y, dx, dy, w) => {
    m[0] += w * (x * dy - y * dx) / 2;
    m[1] += w * x * x * dy / 2;
    m[2] -= w * y * y * dx / 2;
    m[3] += w * x * x * x * dy / 3;
    m[4] -= w * y * y * y * dx / 3;
    m[5] += w * x * x * y * dy / 2;
  };
  for (const ring of [region.outer, ...region.holes])
    for (const s of ring) {
      if (s.kind === "line") {
        const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1];
        for (const [u, w] of GL8)
          add3(s.a[0] + dx * u, s.a[1] + dy * u, dx, dy, w);
        continue;
      }
      if (s.kind === "curve") {
        for (let k = 0; k < 16; k++)
          for (const [u, w] of GL8) {
            const x = (k + u) / 16, p = segAt(s, x), a = segAt(s, Math.max(0, x - 1e-6)), b = segAt(s, Math.min(1, x + 1e-6)), du = Math.min(1, x + 1e-6) - Math.max(0, x - 1e-6);
            add3(p[0], p[1], (b[0] - a[0]) / du / 16, (b[1] - a[1]) / du / 16, w);
          }
        continue;
      }
      const pieces = Math.max(1, Math.ceil(Math.abs(s.sweep) / (Math.PI / 8)));
      for (let k = 0; k < pieces; k++)
        for (const [u, w] of GL8) {
          const t = s.t0 + s.sweep * (k + u) / pieces, dt = s.sweep / pieces;
          add3(s.c[0] + s.r * Math.cos(t), s.c[1] + s.r * Math.sin(t), -s.r * Math.sin(t) * dt, s.r * Math.cos(t) * dt, w);
        }
    }
  return m;
}
function crossingsAt(rings, y) {
  const xs = [];
  const yAbove = y + 1e-12 * (1 + Math.abs(y));
  for (const ring of rings)
    for (let si = 0; si < ring.length; si++) {
      const g = ring[si], start = segEnd(ring[(si - 1 + ring.length) % ring.length]);
      const us = g.kind === "line" ? LINE_US : g.kind === "curve" ? DENSE_US : arcCuts(g);
      const dense = g.kind === "curve" ? denseSamples(g) : null;
      for (let k = 0; k + 1 < us.length; k++) {
        let lo = us[k], hi = us[k + 1];
        const a = lo === 0 ? start : dense ? dense[k] : segAt(g, lo), b = hi === 0 ? start : dense ? dense[k + 1] : segAt(g, hi);
        const aAbove = a[1] > yAbove;
        if (aAbove === b[1] > yAbove)
          continue;
        if (g.kind === "line") {
          xs.push(a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]));
          continue;
        }
        for (let i = 0; i < 60; i++) {
          const m = (lo + hi) / 2;
          if (segAt(g, m)[1] > yAbove === aAbove)
            lo = m;
          else
            hi = m;
        }
        xs.push(segAt(g, (lo + hi) / 2)[0]);
      }
    }
  return xs;
}
function arcCuts(g) {
  const cuts = [0, 1];
  for (const t of [Math.PI / 2, -Math.PI / 2]) {
    const u = paramOf(g, [g.c[0] + g.r * Math.cos(t), g.c[1] + g.r * Math.sin(t)]);
    if (u > 0 && u < 1)
      cuts.push(u);
  }
  return cuts.sort((a, b) => a - b);
}
function regionInteriorPoint(region) {
  const rings = [region.outer, ...region.holes];
  let y0 = Infinity, y1 = -Infinity;
  const extent = (g) => g.kind === "line" ? [g.a, g.b] : g.kind === "curve" ? polyline(g, CURVE_SAMPLES) : [segStart(g), segEnd(g), ...[[g.c[0], g.c[1] - g.r], [g.c[0], g.c[1] + g.r]].filter((p) => {
    const u = paramOf(g, p);
    return u >= 0 && u <= 1;
  })];
  for (const ring of rings)
    for (const g of ring)
      for (const p of extent(g)) {
        y0 = Math.min(y0, p[1]);
        y1 = Math.max(y1, p[1]);
      }
  let best = null, clearance = -1;
  for (const f of [0.5, 0.3819660112501051, 0.6180339887498949, 0.2360679774997897, 0.7639320225002103, 0.1458980337503155, 0.8541019662496845, 0.0901699437494742, 0.9098300562505258]) {
    const y = y0 + (y1 - y0) * f, xs = crossingsAt(rings, y).sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const p = [(xs[k] + xs[k + 1]) / 2, y];
      let d = Infinity;
      scan: for (const ring of rings)
        for (const g of ring) {
          if (g.kind === "curve") {
            const { lo, hi } = samples(g);
            if (Math.hypot(Math.max(lo[0] - p[0], 0, p[0] - hi[0]), Math.max(lo[1] - p[1], 0, p[1] - hi[1])) >= d)
              continue;
          }
          d = Math.min(d, segDistance(g, p));
          if (d <= clearance)
            break scan;
        }
      if (d > clearance) {
        clearance = d;
        best = p;
      }
    }
  }
  return best;
}

// packages/barocss-cad/dist/features/prismatic-solid.js
var prismaticSolidError = (detail) => kernelRefusal("prismatic-solid", "PRISMATIC_SOLID", "Prismatic solid: " + detail);
var ringsOf = (regions2) => regions2.flatMap((r) => [r.outer, ...r.holes]);
var allRings = (slabs) => slabs.flatMap((s) => ringsOf(s.regions));
function normalize(slabs, tolerance, caps = [], merged = false) {
  const sorted = slabs.filter((s) => s.regions.length).sort((a, b) => a.z0 - b.z0), out = [];
  for (const s of sorted) {
    if (!(Number.isFinite(s.z0) && Number.isFinite(s.z1) && s.z1 > s.z0))
      throw prismaticSolidError("every slab needs finite z0 < z1");
    const prev = out[out.length - 1];
    if (prev && s.z0 < prev.z1)
      throw prismaticSolidError("slabs overlap in Z");
    if (!merged && prev && prev.z1 === s.z0 && !booleanCurveRegions(ringsOf(prev.regions), ringsOf(s.regions), "xor", tolerance).length) {
      out[out.length - 1] = { ...prev, z1: s.z1 };
      continue;
    }
    out.push(s);
  }
  const levels = new Set(out.flatMap((x) => [x.z0, x.z1])), kept = caps.filter((c) => levels.has(c.z));
  return { kind: "prismatic-solid", slabs: out, ...kept.length ? { caps: kept } : {} };
}
var reverseRing = (ring) => [...ring].reverse().map(segReverse);
function transformPrismatic(solid, transform) {
  const [a, b, c, d] = transform.matrix, [tx, ty] = transform.offset ?? [0, 0], zs = transform.zScale ?? 1, zo = transform.zOffset ?? 0, det = a * d - b * c;
  const scale3 = Math.sqrt(Math.abs(det));
  if (!(scale3 > 0) || Math.abs(a * a + c * c - scale3 * scale3) > 1e-12 * scale3 * scale3 || Math.abs(b * b + d * d - scale3 * scale3) > 1e-12 * scale3 * scale3 || Math.abs(a * b + c * d) > 1e-12 * scale3 * scale3 || !(zs !== 0 && Number.isFinite(zs)))
    throw prismaticSolidError("the transform must be a similarity in XY with a nonzero Z scale");
  const map = (p) => [a * p[0] + b * p[1] + tx, c * p[0] + d * p[1] + ty];
  const retag = (x) => transform.retag && x.tag !== void 0 ? { ...x, tag: typeof transform.retag === "string" ? x.tag + transform.retag : transform.retag(x.tag) } : x;
  const seg = (s) => s.kind === "curve" ? noCurves() : retag(s.kind === "line" ? { ...s, a: map(s.a), b: map(s.b) } : { ...s, c: map(s.c), r: s.r * scale3, t0: Math.atan2(c * Math.cos(s.t0) + d * Math.sin(s.t0), a * Math.cos(s.t0) + b * Math.sin(s.t0)), sweep: s.sweep * Math.sign(det) });
  const ring = (r) => det > 0 ? r.map(seg) : reverseRing(r.map(seg));
  const region = (r) => ({ outer: ring(r.outer), holes: r.holes.map(ring) });
  const z = (v) => zs * v + zo;
  const slabs = solid.slabs.map((s) => ({ z0: Math.min(z(s.z0), z(s.z1)), z1: Math.max(z(s.z0), z(s.z1)), regions: s.regions.map(region) }));
  const caps = (solid.caps ?? []).map((cp) => ({ z: z(cp.z), regions: cp.regions.map(region), tag: typeof transform.retag === "string" ? cp.tag + transform.retag : transform.retag ? transform.retag(cp.tag) : cp.tag }));
  return normalize(slabs, 0, caps, true);
}
var inRegion = (p, r) => pointInPolygon(p, sampleRing(r.outer, Math.PI / 720)) && !r.holes.some((h) => pointInPolygon(p, sampleRing(h, Math.PI / 720)));
var PointSet = class {
  eps;
  points = [];
  grid = /* @__PURE__ */ new Map();
  cell;
  constructor(eps) {
    this.eps = eps;
    this.cell = eps * 64;
  }
  find(p) {
    const gx = Math.floor(p[0] / this.cell), gy = Math.floor(p[1] / this.cell);
    for (let i = -1; i <= 1; i++)
      for (let j = -1; j <= 1; j++)
        for (const v of this.grid.get(gx + i + "," + (gy + j)) ?? [])
          if (Math.hypot(this.points[v][0] - p[0], this.points[v][1] - p[1]) <= this.eps)
            return v;
    return -1;
  }
  add(p) {
    const f = this.find(p);
    if (f >= 0)
      return f;
    const v = this.points.length, k = Math.floor(p[0] / this.cell) + "," + Math.floor(p[1] / this.cell);
    this.points.push([p[0], p[1]]);
    this.grid.set(k, [...this.grid.get(k) ?? [], v]);
    return v;
  }
};
var noCurves = () => {
  throw prismaticSolidError("prismatic sections are made of lines and arcs");
};
var profileSegment = (s, start, end) => s.kind === "curve" ? noCurves() : s.kind === "line" ? { kind: "line", start, end, length: Math.hypot(end[0] - start[0], end[1] - start[1]) } : { kind: "arc", start, end, center: s.c, radius: s.r, startAngle: s.t0, sweep: s.sweep, length: Math.abs(s.sweep) * s.r };
function brepFromPrismatic(solid, options = {}) {
  const id2 = options.id ?? "prismatic", slabs = solid.slabs;
  if (!slabs.length)
    throw new BrepError("INPUT", "a prismatic solid without slabs has no B-rep");
  const tol = curveTolerance(allRings(slabs));
  const levels = [...new Set(slabs.flatMap((s) => [s.z0, s.z1]))].sort((x, y) => x - y);
  const ringsAt = (z, side) => ringsOf(slabs.find((s) => (side === "below" ? s.z1 : s.z0) === z)?.regions ?? []);
  const set = new PointSet(tol);
  const caps = levels.map((z) => {
    const below = ringsAt(z, "below"), above = ringsAt(z, "above");
    for (const p of curveArrangementVertices([...below, ...above], tol))
      set.add(p);
    return { up: below.length ? booleanCurveRegions(below, above, "difference", tol) : [], down: above.length ? booleanCurveRegions(above, below, "difference", tol) : [] };
  });
  for (const c of caps)
    for (const ring of ringsOf([...c.up, ...c.down]))
      for (const s of ring) {
        set.add(segStart(s));
        set.add(segEnd(s));
      }
  const P = set.points;
  const pieces = [], between = /* @__PURE__ */ new Map();
  const piece = (seg, a, b) => {
    const lo = Math.min(a, b), hi = Math.max(a, b), key = lo + ":" + hi, list = between.get(key) ?? [], mid = segAt(seg, 0.5);
    let k = list.find((i) => segDistance(pieces[i].seg, mid) <= 4 * tol);
    if (k === void 0) {
      k = pieces.length;
      pieces.push({ seg: a === lo ? seg : segReverse(seg), lo, hi });
      list.push(k);
      between.set(key, list);
    }
    return { piece: k, forward: a === lo };
  };
  const split = (ring) => ring.flatMap((s) => {
    const a = set.find(segStart(s)), b = set.find(segEnd(s));
    if (a < 0 || b < 0)
      throw new BrepError("GEOMETRY", "a ring vertex is missing from the arrangement");
    const stops = [{ u: 0, v: a }];
    P.forEach((p, v) => {
      if (v === a || v === b || segDistance(s, p) > tol)
        return;
      const u = paramOf(s, p);
      if (u > 0 && u < 1)
        stops.push({ u, v });
    });
    stops.sort((x, y) => x.u - y.u);
    stops.push({ u: 1, v: b });
    const out = [];
    for (let k = 0; k + 1 < stops.length; k++) {
      const s0 = stops[k], s1 = stops[k + 1];
      if (s0.v === s1.v)
        continue;
      const sub3 = s.kind === "line" ? { ...s, a: P[s0.v], b: P[s1.v] } : s.kind === "arc" ? { ...s, t0: s.t0 + s.sweep * s0.u, sweep: s.sweep * (s1.u - s0.u) } : noCurves();
      out.push({ ...piece(sub3, s0.v, s1.v), tag: s.tag });
    }
    return out;
  });
  const curveOf = (k, z, cid) => {
    const pc2 = pieces[k];
    return segmentCurve(profileSegment(pc2.seg, P[pc2.lo], P[pc2.hi]), z, cid);
  };
  const faces = [], pc = (a, b) => lineCurve("pcurve", a, b);
  const hKey = (k, level) => `h${k}_${level}`, vtx = (p, level) => `${p}_${level}`;
  const hUse = (k, forward, level, face, tag, pcurve) => {
    const s = vtx(pieces[k].lo, level), e = vtx(pieces[k].hi, level);
    return { key: hKey(k, level), sense: forward ? "forward" : "reversed", pcurve, face, tag, start: forward ? s : e, end: forward ? e : s };
  };
  const struts = /* @__PURE__ */ new Map();
  const cells = /* @__PURE__ */ new Map();
  slabs.forEach((slab, si) => {
    const iLo = levels.indexOf(slab.z0), iHi = levels.indexOf(slab.z1);
    slab.regions.forEach((region, ri) => [region.outer, ...region.holes].forEach((ring, gi) => {
      const parts = split(ring), n = parts.length;
      const startOf = (j) => parts[j % n].forward ? pieces[parts[j % n].piece].lo : pieces[parts[j % n].piece].hi;
      const strut = (j) => {
        const key = `s${si}_${ri}_${gi}_${j % n}`;
        struts.set(key, { p: startOf(j), lo: iLo, hi: iHi });
        return key;
      };
      parts.forEach(({ piece: k, forward, tag }, j) => {
        const list = cells.get(k + ":" + forward) ?? [];
        list.push({ si, k, forward, sStart: strut(j), sEnd: strut(j + 1), pStart: startOf(j), pEnd: startOf(j + 1), cell: `${si}_${ri}_${gi}_${j}`, tag });
        cells.set(k + ":" + forward, list);
      });
    }));
  });
  for (const list of cells.values()) {
    list.sort((a, b) => a.si - b.si);
    const runs = [];
    for (const c of list) {
      const last = runs[runs.length - 1];
      if (last && last[last.length - 1].si === c.si - 1 && slabs[c.si - 1].z1 === slabs[c.si].z0)
        last.push(c);
      else
        runs.push([c]);
    }
    for (const run of runs) {
      const { k, forward } = run[0], za = slabs[run[0].si].z0, zb = slabs[run[run.length - 1].si].z1, iLo = levels.indexOf(za), iHi = levels.indexOf(zb);
      const f = faces.length, uEnd = forward ? 1 : 0, uStart = 1 - uEnd, fid = `${id2}_w${run[0].cell}`, mid = segAt(pieces[k].seg, 0.5);
      const strutUse = (key, up, u) => {
        const st = struts.get(key), lo = vtx(st.p, st.lo), hi = vtx(st.p, st.hi);
        return { key, sense: up ? "forward" : "reversed", pcurve: null, u, face: f, tag: "strut", start: up ? lo : hi, end: up ? hi : lo };
      };
      const loop = [
        hUse(k, forward, iLo, f, "upperWall", pc([0, 0, 0], [1, 0, 0])),
        ...run.map((c) => strutUse(c.sEnd, true, uEnd)),
        hUse(k, !forward, iHi, f, "lowerWall", pc([0, 1, 0], [1, 1, 0])),
        ...[...run].reverse().map((c) => strutUse(c.sStart, false, uStart))
      ];
      faces.push({
        id: fid,
        surface: extrudedSurface(curveOf(k, za, fid), za, zb, fid),
        sense: forward ? "forward" : "reversed",
        loops: [{ kind: "outer", uses: loop }],
        volume: 0,
        wall: { za, zb },
        base: run[0].tag ?? `${id2}.wall`,
        key: [mid[0], mid[1], (za + zb) / 2]
      });
    }
  }
  caps.forEach((c, level) => {
    const z = levels[level];
    for (const [up, regions2] of [[true, c.up], [false, c.down]])
      regions2.forEach((region, n) => {
        const f = faces.length, fid = `${id2}_${up ? "u" : "d"}${level}_${n}`;
        const rings = [region.outer, ...region.holes].map((r) => {
          const parts = split(r);
          return up ? parts : [...parts].reverse().map((x) => ({ piece: x.piece, forward: !x.forward }));
        });
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const ring of rings)
          for (const { piece: k } of ring)
            for (const q3 of curveOf(k, z, "b").controlPoints) {
              x0 = Math.min(x0, q3[0]);
              y0 = Math.min(y0, q3[1]);
              x1 = Math.max(x1, q3[0]);
              y1 = Math.max(y1, q3[1]);
            }
        const uv = (q3) => up ? [(q3[0] - x0) / (x1 - x0), (q3[1] - y0) / (y1 - y0), 0] : [(q3[1] - y0) / (y1 - y0), (q3[0] - x0) / (x1 - x0), 0];
        const loops = rings.map((ring, g) => ({ kind: g === 0 ? "outer" : "inner", uses: ring.map(({ piece: k, forward }) => {
          const e = curveOf(k, z, "p");
          return hUse(k, forward, level, f, up ? "upFace" : "downFace", { ...e, id: "pcurve", controlPoints: e.controlPoints.map(uv) });
        }) }));
        const q2 = interiorPoint(region), source2 = (solid.caps ?? []).find((cp) => cp.z === z && cp.regions.some((r) => inRegion(q2, r)));
        faces.push({
          id: fid,
          surface: capSurface({ min: [x0, y0], max: [x1, y1] }, z, fid, up),
          sense: "forward",
          loops,
          volume: (up ? 1 : -1) * regionArea(region) * z,
          cap: { region, z },
          base: source2?.tag ?? `${id2}.${up ? "top" : "bottom"}`,
          key: [q2[0], q2[1], z]
        });
      });
  });
  const uses = faces.flatMap((f) => f.loops.flatMap((l) => l.uses)), byKey = /* @__PURE__ */ new Map();
  for (const u of uses)
    byKey.set(u.key, [...byKey.get(u.key) ?? [], u]);
  for (const [key, list] of byKey) {
    if (list.length === 4) {
      const tags = new Set(list.map((u) => u.tag));
      if (tags.size !== 4)
        throw new BrepError("TOPOLOGY", `edge ${key} has four uses that are not two wedges`);
      for (const u of list)
        u.key = key + (u.tag === "lowerWall" || u.tag === "upFace" ? "a" : "b");
    } else if (list.length !== 2)
      throw new BrepError("TOPOLOGY", `edge ${key} has ${list.length} uses`);
  }
  const edgeUses = /* @__PURE__ */ new Map();
  for (const u of uses)
    edgeUses.set(u.key, [...edgeUses.get(u.key) ?? [], u]);
  for (const [key, list] of edgeUses)
    if (list.length !== 2 || list[0].sense === list[1].sense)
      throw new BrepError("TOPOLOGY", `edge ${key} is not used once in each direction`);
  const parent = /* @__PURE__ */ new Map(), find = (x) => {
    let r = x;
    while (parent.has(r) && parent.get(r) !== r)
      r = parent.get(r);
    parent.set(x, r);
    return r;
  };
  const at2 = (v, e) => v + "|" + e, unite = (a, b) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb)
      parent.set(ra, rb);
  };
  for (const f of faces)
    for (const l of f.loops)
      l.uses.forEach((u, k) => {
        const n = l.uses[(k + 1) % l.uses.length];
        unite(at2(u.end, u.key), at2(n.start, n.key));
      });
  const discEdges = /* @__PURE__ */ new Map();
  for (const u of uses) {
    u.startRoot = find(at2(u.start, u.key));
    u.endRoot = find(at2(u.end, u.key));
    for (const r of [u.startRoot, u.endRoot])
      discEdges.set(r, (discEdges.get(r) ?? /* @__PURE__ */ new Set()).add(u.key));
  }
  const sroot = /* @__PURE__ */ new Map(), sfind = (x) => {
    let r = x;
    while (sroot.has(r) && sroot.get(r) !== r)
      r = sroot.get(r);
    return r;
  };
  for (const keys of discEdges.values()) {
    const [a, b] = [...keys];
    if (keys.size !== 2 || !a.startsWith("s") || !b.startsWith("s"))
      continue;
    const ra = sfind(a), rb = sfind(b);
    if (ra === rb)
      continue;
    sroot.set(ra, rb);
    const A = struts.get(ra), B = struts.get(rb);
    struts.set(rb, { p: B.p, lo: Math.min(A.lo, B.lo), hi: Math.max(A.hi, B.hi) });
  }
  for (const f of faces)
    for (const l of f.loops) {
      const out = [];
      for (const u of l.uses) {
        const key = u.key.startsWith("s") ? sfind(u.key) : u.key, prev = out[out.length - 1];
        if (prev && prev.key === key && key.startsWith("s")) {
          prev.end = u.end;
          prev.endRoot = u.endRoot;
          continue;
        }
        out.push({ ...u, key });
      }
      l.uses = out;
    }
  for (const f of faces)
    for (const l of f.loops)
      for (const u of l.uses)
        if (u.tag === "strut") {
          const st = struts.get(u.key), w = f.wall, v = (level) => (levels[level] - w.za) / (w.zb - w.za);
          u.pcurve = pc([u.u, v(st.lo), 0], [u.u, v(st.hi), 0]);
        }
  const finalUses = /* @__PURE__ */ new Map();
  for (const f of faces)
    for (const l of f.loops)
      for (const u of l.uses)
        finalUses.set(u.key, [...finalUses.get(u.key) ?? [], u]);
  const vertexIds = /* @__PURE__ */ new Map(), vertices = [];
  const vertexOf = (v, root) => {
    let vid = vertexIds.get(root);
    if (!vid) {
      vid = `${id2}_v${vertices.length}`;
      vertexIds.set(root, vid);
      const [p, level] = v.split("_").map(Number);
      vertices.push({ id: vid, point: [P[p][0], P[p][1], levels[level]] });
    }
    return vid;
  };
  nameFaces(faces);
  const edgeIds = /* @__PURE__ */ new Map(), edges = [];
  const edgeBase = (list) => [...new Set(list.map((u) => faces[u.face].name))].sort().join("|");
  for (const [key, list] of finalUses) {
    const fwd = list.find((u) => u.sense === "forward"), eid = `${id2}_e${edges.length}`;
    edgeIds.set(key, eid);
    let curve;
    if (key.startsWith("s")) {
      const s = struts.get(key);
      curve = lineCurve(eid, [P[s.p][0], P[s.p][1], levels[s.lo]], [P[s.p][0], P[s.p][1], levels[s.hi]]);
    } else {
      const [k, level] = key.slice(1).replace(/[ab]$/, "").split("_").map(Number);
      curve = curveOf(k, levels[level], eid);
    }
    edges.push({ id: eid, curve, vertices: [vertexOf(fwd.start, fwd.startRoot), vertexOf(fwd.end, fwd.endRoot)], name: edgeBase(list) });
  }
  nameEdges(edges);
  const extent = P.reduce((m, q2) => Math.max(m, Math.abs(q2[0]), Math.abs(q2[1])), 1), rho = Math.max(1e-4 * extent, 1e3 * tol);
  for (const f of faces) {
    if (!f.cap)
      continue;
    const at3 = /* @__PURE__ */ new Map();
    for (const l of f.loops)
      for (const u of l.uses) {
        const p = Number(u.start.split("_")[0]), ids = at3.get(p) ?? /* @__PURE__ */ new Set();
        ids.add(vertexOf(u.start, u.startRoot));
        at3.set(p, ids);
      }
    for (const [p, ids] of at3)
      if (ids.size > 1 && materialAround(f.cap.region, P[p], rho) > 0.5)
        throw new BrepError("GEOMETRY", `the solid touches itself along the vertical line at (${P[p].map((x) => +x.toFixed(4))}): two of its walls meet there from outside each other`);
  }
  const froot = faces.map((_, i) => i), ff = (i) => {
    while (froot[i] !== i)
      i = froot[i] = froot[froot[i]];
    return i;
  };
  for (const list of finalUses.values())
    froot[ff(list[0].face)] = ff(list[1].face);
  const shells = /* @__PURE__ */ new Map();
  faces.forEach((_, i) => shells.set(ff(i), [...shells.get(ff(i)) ?? [], i]));
  const groups = [...shells.values()].map((fs) => ({ faces: fs, volume: fs.reduce((v, i) => v + faces[i].volume, 0) }));
  const outers = groups.filter((g) => g.volume > 0), bodies = outers.map((g) => ({ outer: g, cavities: [] }));
  for (const cavity of groups.filter((g) => g.volume <= 0)) {
    const cap = faces[cavity.faces.find((i) => faces[i].cap)].cap, q2 = interiorPoint(cap.region);
    let best = -1;
    bodies.forEach((b, k) => {
      const crossings = b.outer.faces.filter((i) => {
        const c = faces[i].cap;
        return c && c.z > cap.z && inRegion(q2, c.region);
      }).length;
      if (crossings % 2 === 1 && (best < 0 || b.outer.volume < bodies[best].outer.volume))
        best = k;
    });
    if (best < 0)
      throw new BrepError("TOPOLOGY", "a cavity shell lies in no body");
    bodies[best].cavities.push(cavity);
  }
  const faceInput = (i) => ({
    id: faces[i].id,
    name: faces[i].name,
    surface: faces[i].surface,
    sense: faces[i].sense,
    loops: faces[i].loops.map((l) => ({ kind: l.kind, uses: l.uses.map((u) => ({ edge: edgeIds.get(u.key), sense: u.sense, pcurve: u.pcurve })) }))
  });
  return buildBrep({
    source: { family: "prismatic-solid", id: id2 },
    vertices,
    edges,
    bodies: bodies.map((b, k) => ({ id: `${id2}_b${k}`, kind: "solid", shells: [b.outer, ...b.cavities].map((g, s) => ({ id: `${id2}_b${k}_s${s}`, faces: g.faces.map(faceInput), closed: true })) })),
    tolerance: Math.max(tol, 1e-9)
  });
}
var byPosition = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
function nameFaces(faces) {
  const groups = /* @__PURE__ */ new Map();
  for (const f of faces)
    groups.set(f.base, [...groups.get(f.base) ?? [], f]);
  for (const [base, list] of groups) {
    if (list.length === 1) {
      list[0].name = base;
      continue;
    }
    [...list].sort((a, b) => byPosition(a.key, b.key)).forEach((f, k) => {
      f.name = `${base}#${k + 1}`;
    });
  }
}
function nameEdges(edges) {
  const groups = /* @__PURE__ */ new Map();
  for (const e of edges)
    groups.set(e.name, [...groups.get(e.name) ?? [], e]);
  const mid = (c) => {
    const p = c.controlPoints, a = p[0], b = p[p.length - 1], m = p[Math.floor(p.length / 2)];
    return [(a[0] + b[0] + m[0]) / 3, (a[1] + b[1] + m[1]) / 3, (a[2] + b[2] + m[2]) / 3];
  };
  for (const [base, list] of groups)
    if (list.length > 1)
      [...list].sort((a, b) => byPosition(mid(a.curve), mid(b.curve))).forEach((e, k) => {
        e.name = `${base}#${k + 1}`;
      });
}
function materialAround(region, p, rho) {
  let n = 0;
  for (let k = 0; k < 16; k++) {
    const a = (k + 0.5) * Math.PI / 8;
    if (inRegion([p[0] + rho * Math.cos(a), p[1] + rho * Math.sin(a)], region))
      n++;
  }
  return n / 16;
}
function interiorPoint(region) {
  const p = regionInteriorPoint(region);
  if (!p)
    throw new BrepError("GEOMETRY", "a region has no interior");
  return p;
}

// packages/barocss-cad/dist/brep/polyhedral-boolean.js
var babs = (a) => a < 0n ? -a : a;
var bgcd = (a, b) => {
  a = babs(a);
  b = babs(b);
  while (b) {
    const r = a % b;
    a = b;
    b = r;
  }
  return a;
};
var q = (n, d = 1n) => {
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const g = bgcd(n, d) || 1n;
  return { n: n / g, d: d / g };
};
function qf(v) {
  if (!Number.isFinite(v))
    throw new BrepError("INPUT", "finite coordinates required");
  const { m, k } = binary64Dyadic(v);
  return q(m, 1n << BigInt(k));
}
var num = (a) => Number(a.n) / Number(a.d);
var vnum = (a) => [num(a[0]), num(a[1]), num(a[2])];
var RAYS = [[0.5773, 0.3419, 0.7413], [-0.2183, 0.8817, 0.4127], [0.6631, -0.5279, 0.3011], [-0.4421, -0.3137, 0.8401], [0.1931, 0.7349, -0.6503]].map((r) => r.map(qf));
var RAYS_F = RAYS.map(vnum);

// packages/barocss-cad/dist/brep/analytic-boolean.js
var TWO_PI2 = 2 * Math.PI;
var CACHE_BITS = 16;
var cacheX = new Float64Array(1 << CACHE_BITS);
var cacheId = new Int32Array(1 << CACHE_BITS);
var cacheP = new Array(1 << CACHE_BITS);
var bitsF = new Float64Array(1);
var bitsU = new Uint32Array(bitsF.buffer);
var RAYS2 = [[0.5377, 0.3138, 0.7832], [-0.2961, 0.8573, 0.4213], [0.6993, -0.5126, 0.4982], [-0.4436, -0.3714, 0.8155], [0.1172, 0.9563, -0.2677], [0.8811, 0.2219, -0.4175]].map((v) => unit(v));

// packages/barocss-cad/dist/machine/gear-bevel.js
var ALPHA = 20 * Math.PI / 180;
var PRODUCT = [];
for (let k = 0; k <= 4; k++) {
  const row = [];
  for (let i = 0; i <= 2; i++) {
    const j = k - i;
    row.push(j < 0 || j > 2 ? 0 : [1, 2, 1][i] * [1, 2, 1][j] / [1, 4, 6, 4, 1][k]);
  }
  PRODUCT.push(row);
}

// packages/barocss-cad/dist/machine/gear-worm.js
var ALPHA_N = 20 * Math.PI / 180;

// packages/barocss-cad/dist/internal/native-si-mass-state.js
var bases = /* @__PURE__ */ new WeakMap();
var results = /* @__PURE__ */ new WeakMap();
function recordIntegralMass(props, density, central) {
  bases.set(props, { kind: "integrals", density, central: Object.freeze([...central]) });
}
function transferNativeMassBasis(from, to) {
  const basis2 = bases.get(from);
  if (basis2)
    bases.set(to, basis2);
}
function unsupportedNativeMass(props, reason) {
  bases.set(props, { kind: "unsupported", reason });
  return props;
}
function readNativeSIInertia(props) {
  const cached = results.get(props);
  if (cached)
    return cached;
  const basis2 = bases.get(props);
  if (!basis2 || basis2.kind === "unsupported")
    return { ok: false, code: "NATIVE_SI_PROVENANCE_UNAVAILABLE", reason: basis2?.reason ?? "untracked" };
  const [xx, yy, zz, xy, xz, yz] = basis2.central;
  const k = basis2.density * 1e3 * 1e-15;
  const inertia = Object.freeze([
    Object.freeze([k * (yy + zz), -k * xy, -k * xz]),
    Object.freeze([-k * xy, k * (xx + zz), -k * yz]),
    Object.freeze([-k * xz, -k * yz, k * (xx + yy)])
  ]);
  const result = Object.freeze({ ok: true, inertia, density: basis2.density });
  results.set(props, result);
  return result;
}

// packages/barocss-cad/dist/core/quadrature.js
function gauss(n) {
  const x = [], w = [];
  for (let i = 1; i <= n; i++) {
    let t = Math.cos(Math.PI * (i - 0.25) / (n + 0.5)), d = 0;
    for (let it = 0; it < 100; it++) {
      let p0 = 1, p1 = t;
      for (let k = 2; k <= n; k++) {
        const p2 = ((2 * k - 1) * t * p1 - (k - 1) * p0) / k;
        p0 = p1;
        p1 = p2;
      }
      d = n * (t * p1 - p0) / (t * t - 1);
      const dx = p1 / d;
      t -= dx;
      if (Math.abs(dx) < 1e-16)
        break;
    }
    x.push((1 - t) / 2);
    w.push(1 / ((1 - t * t) * d * d));
  }
  return { x, w };
}

// packages/barocss-cad/dist/brep/brep-mass-quadrature.js
var RULE = (() => {
  const out = [[1 / 3, 1 / 3, 1 / 3, 0.144315607677787]];
  const orbit = (a, w) => {
    const b = (1 - a) / 2;
    out.push([a, b, b, w], [b, a, b, w], [b, b, a, w]);
  };
  orbit(0.081414823414554, 0.095091634267285);
  orbit(0.65886138449648, 0.103217370534718);
  orbit(0.898905543365938, 0.032458497623198);
  const six = (a, b, w) => {
    const c = 1 - a - b;
    out.push([a, b, c, w], [a, c, b, w], [b, a, c, w], [b, c, a, w], [c, a, b, w], [c, b, a, w]);
  };
  six(0.008394777409958, 0.263112829634638, 0.027230314174435);
  return out;
})();
var G4 = gauss(4);
var G12 = gauss(12);
var ST = gauss(8);
var SS = gauss(4);
var stripC = new Float64Array(16);
var stripD = new Float64Array(16);
var stripI = Array(10).fill(0);
var stripE = new Float64Array(24);
var stripT = new Float64Array(24);

// packages/barocss-cad/dist/brep/solid-mass.js
var solidMassError = (detail) => kernelRefusal("solid-mass", "SOLID_MASS", "Mass properties: " + detail);
function solidMassFromIntegrals(I, density, method) {
  if (!(typeof density === "number" && Number.isFinite(density) && density > 0))
    throw solidMassError("a positive finite density is required");
  const [V, X, Y, Z, XX, YY, ZZ, XY, XZ, YZ] = I;
  if (!(V > 0))
    throw solidMassError("the solid has no positive volume");
  const c = [X / V, Y / V, Z / V], k = density * 1e-3;
  const xx = XX - V * c[0] * c[0], yy = YY - V * c[1] * c[1], zz = ZZ - V * c[2] * c[2];
  const xy = XY - V * c[0] * c[1], xz = XZ - V * c[0] * c[2], yz = YZ - V * c[1] * c[2];
  const props = {
    volume: V,
    mass: density * V * 1e-3,
    centroid: c,
    method,
    inertia: [[k * (yy + zz), -k * xy, -k * xz], [-k * xy, k * (xx + zz), -k * yz], [-k * xz, -k * yz, k * (xx + yy)]]
  };
  recordIntegralMass(props, density, [xx, yy, zz, xy, xz, yz]);
  return props;
}
function prismaticMassProperties(solid, density) {
  const I = Array(10).fill(0);
  for (const s of solid.slabs) {
    const h = s.z1 - s.z0;
    const h2 = h * (s.z0 / 2 + s.z1 / 2), h3 = h * (s.z0 * s.z0 + s.z0 * s.z1 + s.z1 * s.z1) / 3;
    for (const r of s.regions) {
      const [A, Sx, Sy, Sxx, Syy, Sxy] = regionMoments(r);
      I[0] += A * h;
      I[1] += Sx * h;
      I[2] += Sy * h;
      I[3] += A * h2;
      I[4] += Sxx * h;
      I[5] += Syy * h;
      I[6] += A * h3;
      I[7] += Sxy * h;
      I[8] += Sx * h2;
      I[9] += Sy * h2;
    }
  }
  return solidMassFromIntegrals(I, density, "closed-form");
}
var faceScratch = new Float64Array(10);

// packages/barocss-cad/dist/brep/brep-transform.js
function transformBrep(brep, map, rename) {
  const m = map.matrix, t = map.offset ?? [0, 0, 0];
  const det = m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
  if (!(Number.isFinite(det) && det !== 0))
    throw new BrepError("INPUT", "an invertible finite affine map is required");
  const at2 = (p) => [m[0] * p[0] + m[1] * p[1] + m[2] * p[2] + t[0], m[3] * p[0] + m[4] * p[1] + m[5] * p[2] + t[1], m[6] * p[0] + m[7] * p[1] + m[8] * p[2] + t[2]];
  const curve = (c) => ({ ...c, controlPoints: c.controlPoints.map(at2) });
  const identity2 = m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 0 && m[4] === 1 && m[5] === 0 && m[6] === 0 && m[7] === 0 && m[8] === 1 && t[0] === 0 && t[1] === 0 && t[2] === 0;
  const surface = (s) => s.kind === "facets" ? identity2 ? s : transformFacetPatch(s, m, t) : { ...s, controlPoints: s.controlPoints.map((row) => row.map(at2)) };
  const flip = det < 0, nameOf = (x) => rename && x.name !== void 0 ? { name: typeof rename === "string" ? x.name + rename : rename(x.name) } : {};
  const loops = brep.loops.map((l) => flip ? { ...l, coedges: [...l.coedges].reverse() } : l);
  const coedges = brep.coedges.map((c) => flip ? { ...c, sense: c.sense === "forward" ? "reversed" : "forward", next: c.prev, prev: c.next } : c);
  const faces = brep.faces.map((f) => ({ ...f, surface: surface(f.surface), ...flip ? { sense: f.sense === "forward" ? "reversed" : "forward" } : {}, ...nameOf(f) }));
  return {
    ...brep,
    faces,
    loops,
    coedges,
    edges: brep.edges.map((e) => ({ ...e, curve: curve(e.curve), ...nameOf(e) })),
    vertices: brep.vertices.map((v) => ({ ...v, point: at2(v.point) }))
  };
}

// packages/barocss-cad/dist/features/profile-relief.js
var ROUND = 64 * Number.EPSILON;

// packages/barocss-cad/dist/features/cylindrical-wrap-map.js
var SCALE = 1n << 128n;
var LIMITS = Object.freeze({ intervals: 256, depth: 8, taylorTerms: 24, intervalBits: 128, work: 1048576, rationalOperations: 2e5, rationalGcdSteps: 2e5, rationalIntegerBits: 8192, fractionCharacters: 5e3, floatSearchStepsPerConversion: 64 });
var CARRIER_LIMITS = Object.freeze({ work: LIMITS.work, rationalOperations: LIMITS.rationalOperations, rationalGcdSteps: LIMITS.rationalGcdSteps, rationalIntegerBits: LIMITS.rationalIntegerBits, fractionCharacters: LIMITS.fractionCharacters, floatSearchStepsPerConversion: LIMITS.floatSearchStepsPerConversion });

// packages/barocss-cad/dist/core/native-d0-bound.js
var SCALE2 = 1n << 128n;
var FAMILY_FLOAT = new DataView(new ArrayBuffer(8));
var FAMILY_MINIMUM = 2 ** -128;

// packages/barocss-cad/dist/features/cylindrical-wrap-chart.js
var CHART_LIMITS = Object.freeze({ operations: 2e5, integerBits: 8192, work: 1048576, curves: 2, nodes: 256, depth: 8 });
var LOOP_CHART_LIMITS = Object.freeze({ ...CHART_LIMITS, curves: 32 });

// packages/barocss-cad/dist/features/cylindrical-wrap-chart-component.js
var MEANING = Object.freeze({
  projection: "Y-over-X-and-world-Z",
  guarantee: "exact-stored-projected-component-boundary",
  projectedLoopEmbeddingCertified: true,
  projectedComponentContainmentCertified: true,
  representativeRule: "one-owned-vertex-after-complete-boundary-separation",
  hintMeaning: "individual-ring-interior-and-orientation-only",
  sourceCarrierCertified: false,
  originalNativeUVBindingCertified: false,
  topologyCertified: false,
  solidQualified: false,
  representedVolumeCertified: false,
  globalNativeEvaluatorErrorCertified: false,
  generalTextSupported: false,
  combinedConstructionBudgetCertified: false
});

// packages/barocss-cad/dist/features/cylindrical-wrap-side-family.js
var MEANING2 = Object.freeze({
  guarantee: "exact-stored-factor2-radial-side-family-embedding",
  projection: "Y-over-X-and-world-Z",
  exactCoefficientBinding: true,
  sideFamilyEmbeddingCertified: true,
  regularSidesCertified: true,
  nonadjacentSidesDisjoint: true,
  adjacentSidesShareOnlyPrescribedRadialEdge: true,
  sourceCarrierCertified: false,
  originalNativeUVBindingCertified: false,
  retainedFaceClosureCertified: false,
  topologyCertified: false,
  physicalBrepCertified: false,
  solidQualified: false,
  representedVolumeCertified: false,
  globalNativeEvaluatorErrorCertified: false,
  generalTextSupported: false,
  combinedConstructionBudgetCertified: false
});

// packages/barocss-cad/dist/features/cylindrical-wrap-formal-mass.js
var SCALE3 = 1n << 128n;
var MIDPOINT_DENOMINATOR = Number(SCALE3 << 1n);
var MIDPOINT_MINIMUM = 1 / MIDPOINT_DENOMINATOR;
var MIDPOINT_MAXIMUM = Number(1n << 127n);
var ORDER = Object.freeze(["V", "X", "Y", "Z", "XX", "YY", "ZZ", "XY", "XZ", "YZ"]);
var LIMITS2 = Object.freeze({ operations: 2e5, integerBits: 8192, work: 1048576, fractionBits: 128, atanTerms: 24, ratioReductions: 3 });

// packages/barocss-cad/dist/features/cylindrical-wrap-bound-reference.js
var MEANING3 = Object.freeze({
  sourceIdentity: "same-owned-frozen-part-two-synchronous-fresh-checks",
  sourceChecks: 2,
  sourceCosts: "both-complete-child-costs-counted",
  nativePositionBindingCertified: true,
  formalReferenceMassOnly: true,
  closedReferenceCertified: false,
  physicalBrepCertified: false,
  retainedFaceClosureCertified: false,
  representedVolumeCertified: false,
  partMassProvider: false,
  productFeature: false
});
var SHARED_MEANING = Object.freeze({
  ...MEANING3,
  sourceIdentity: "one-owned-frozen-native-source-live-continuation",
  sourceChecks: 1,
  sourceCosts: "one-actual-execution-counted-in-native-parent"
});

// packages/barocss-cad/dist/features/cylindrical-wrap-source-walls.js
var MEANING4 = Object.freeze({
  source: "actual-fresh-formal-source-with-complete-reference-cost",
  originalWallCycleCertified: true,
  originalWallEmbeddingCertified: true,
  originalWallOutwardOrientationCertified: true,
  originalHorizontalBoundaryOwnershipCertified: true,
  coefficientRadialBoundCoversAllSourceWalls: true,
  capTrimEmbeddingCertified: false,
  sourceShellCertified: false,
  closedReferenceCertified: false,
  retainedFaceClosureCertified: false,
  physicalBrepCertified: false,
  representedVolumeCertified: false,
  radialErrorIncludedInMass: false,
  partMassProvider: false,
  productFeature: false
});

// packages/barocss-cad/dist/features/cylindrical-wrap-reference-mass.js
var SCALE4 = 1n << 128n;
var NEGATIVE_SCALE = -SCALE4;

// packages/barocss-cad/dist/features/cylindrical-wrap-feature.js
var BUDGETS = Object.freeze({
  volume: 1e-8,
  mass: 1e-10,
  centroid: Object.freeze([1e-10, 1e-10, 1e-10]),
  inertia: Object.freeze([1e-7, 1e-7, 1e-7, 1e-7, 1e-7, 1e-7])
});

// packages/barocss-cad/dist/exact-proof/exact-binary64-orientation-v1.js
var view2 = new DataView(new ArrayBuffer(8));

// packages/barocss-cad/dist/exact-proof/native-planar-loop-qualification-v1.js
var view3 = new DataView(new ArrayBuffer(8));

// packages/barocss-cad/dist/features/quadratic-cut-arithmetic.js
var FRACTION = (1n << 52n) - 1n;
var HIDDEN = 1n << 52n;

// packages/barocss-cad/dist/io/step-import.js
var TAU3 = 2 * Math.PI;
var TESSELLATED_RECORDS = ["COORDINATES_LIST(", "TRIANGULATED_FACE("];
function stepTessellatedChars(source2) {
  let total = 0;
  for (const word of TESSELLATED_RECORDS) {
    for (let at2 = source2.indexOf(word); at2 >= 0; at2 = source2.indexOf(word, at2)) {
      const end = source2.indexOf(";", at2);
      if (end < 0) {
        total += source2.length - at2;
        break;
      }
      total += end - at2;
      at2 = end;
    }
  }
  return total;
}

// packages/barocss-cad/dist/features/loft.js
var G3 = gauss(3);
var G42 = gauss(4);
var G6 = gauss(6);
var G24 = gauss(24);

// packages/barocss-cad/dist/machine/cam.js
var MT_A = 8 * Math.PI / (Math.PI + 2);
var W4 = 4 * Math.PI;

// packages/barocss-cad/dist/machine/drive.js
var TAU4 = 2 * Math.PI;

// packages/barocss-cad/dist/machine/spring.js
var GL = (() => {
  const n = 24, x = [], w = [];
  for (let i = 0; i < n; i++) {
    let t = Math.cos(Math.PI * (i + 0.75) / (n + 0.5)), dp = 0;
    for (let it = 0; it < 100; it++) {
      let p0 = 1, p1 = t;
      for (let k = 2; k <= n; k++) {
        const p2 = ((2 * k - 1) * t * p1 - (k - 1) * p0) / k;
        p0 = p1;
        p1 = p2;
      }
      dp = n * (t * p1 - p0) / (t * t - 1);
      const step = p1 / dp;
      t -= step;
      if (Math.abs(step) < 1e-16)
        break;
    }
    x.push(t);
    w.push(2 / ((1 - t * t) * dp * dp));
  }
  return { x, w };
})();

// packages/barocss-cad/dist/machine/thread-helical.js
var HANDLE = 4 / 3 * Math.tan(Math.PI / 8);

// packages/barocss-cad/dist/blend/edge-finish.js
var TAU5 = 2 * Math.PI;

// packages/barocss-cad/dist/features/section-offset.js
var TAU6 = 2 * Math.PI;

// packages/barocss-cad/dist/blend/general-shell.js
var TAU7 = 2 * Math.PI;

// packages/barocss-cad/dist/part/part-shell.js
function brepBodies(b) {
  return b.bodies.map((body) => {
    const shells = new Set(body.shells), faces = b.faces.filter((x) => shells.has(x.shell)), faceIds = new Set(faces.map((x) => x.id));
    const loops = b.loops.filter((l) => faceIds.has(l.face)), loopIds = new Set(loops.map((l) => l.id));
    const coedges = b.coedges.filter((c) => loopIds.has(c.loop)), edgeIds = new Set(coedges.map((c) => c.edge));
    const edges = b.edges.filter((e) => edgeIds.has(e.id)), vertexIds = new Set(edges.flatMap((e) => e.vertices));
    return { ...b, bodies: [body], shells: b.shells.filter((x) => shells.has(x.id)), faces, loops, coedges, edges, vertices: b.vertices.filter((v) => vertexIds.has(v.id)) };
  });
}

// packages/barocss-cad/dist/part/part-expect.js
var SAME_DIRECTION = Math.cos(Math.PI / 180);

// packages/barocss-cad/dist/frame-sheet/frame-section.js
var SPANDREL = 1 - Math.PI / 4;

// packages/barocss-cad/dist/core/error-codes.js
var CAD_REFUSAL_CODES = [
  "APPROX_TOLERANCE_NOT_MET",
  "ARC_MEMBER",
  "BAND_CHAIN",
  "BAND_DEGENERATE",
  "BAND_EDGE_LOST",
  "BAND_OBLIQUE",
  "BAND_PROFILE",
  "BAND_TOUCH",
  "BEAD_ANGLE",
  "BEAD_KIND",
  "BEAD_SEAM_NOT_PLANAR",
  "BEAD_SHARED_UNSUPPORTED",
  "BEAD_SIZE",
  "BEND_ANGLE",
  "BEND_DOES_NOT_FIT",
  "BEND_RADIUS",
  "BEND_TABLE",
  "BEND_TABLE_MISS",
  "BUTT_NOT_ON_A_FACE",
  "BUTT_ON_CURVED_MEMBER",
  "BUTT_ON_OPEN_SIDE",
  "CAP_END",
  "CONE_TOP_CHAMFER_SCOPE",
  "CONE_TOP_CHAMFER_SIZE",
  "CONTACT_LEAVES_FACE",
  "CORNER_ANGLE",
  "CORNER_NOT_A_JOINT",
  "CORNER_NOT_CLEAR",
  "CORNER_NOT_SQUARE",
  "DENSITY",
  "EDGE_NOT_SHEET",
  "FACE_FILLET_FACE",
  "FACE_FILLET_FACES",
  "FACE_FILLET_NOT_CLEAR",
  "FACE_FILLET_PARALLEL",
  "FACE_FILLET_RADIUS",
  "FACE_THREAD_FACE",
  "FACE_THREAD_NOT_CLEAR",
  "FACE_THREAD_RELIEF",
  "FACE_THREAD_SIZE",
  "FINISH_EDGES_LIMIT",
  "FLANGES_COLLIDE",
  "FULL_ROUND_FACE",
  "FULL_ROUND_NOT_CLEAR",
  "GAP_SIZE",
  "GUSSET_FIT",
  "INVALID_INPUT",
  "MATE_INCOMPATIBLE",
  "MEMBERS_CLASH",
  "MEMBER_DUPLICATE",
  "MESH_WALL_THIN",
  "MITRE_SECTIONS_DIFFER",
  "NOTCH_CUTTER",
  "NOT_ANALYTIC_PAIR",
  "NOT_A_MEMBER",
  "NOT_A_SHEET",
  "OBSTRUCTED_ABOVE",
  "OFFSET_FOLDS",
  "OPENING_AT_A_VERTEX",
  "RADIUS_EXCEEDS_CURVATURE",
  "RADIUS_EXCEEDS_FACE",
  "REFERENCE_MOVED",
  "RELIEF_REQUIRED",
  "SECTION_DIMENSIONS",
  "SECTION_TABLE",
  "SECTION_TABLE_MISS",
  "SEGMENT_ZERO_LENGTH",
  "SHEET_CROSSES_ITSELF",
  "SHEET_IN_PIECES",
  "SHELL_FACE_KIND",
  "SHELL_MESH_NOT_CLOSED",
  "SHELL_NOT_CLOSED",
  "SHELL_OPENING_NOT_PLANAR",
  "SHELL_PLANE_NOT_BOUNDING",
  "SHELL_REGIONS_SHARP",
  "SHELL_VARIABLE_RADIUS",
  "SHELL_WALL_UNION",
  "SKELETON_OVERLAP",
  "TANGENT_FACES",
  "TRIM_EMPTY",
  "TRIM_LEAVES_PIECES",
  "TRIM_MISSES",
  "TRIM_PARALLEL",
  "VERTEX_BLEND_UNSUPPORTED",
  "WALL_NEAR_RADIUS",
  "WALL_TOO_THIN"
];
var REFUSALS = new Set(CAD_REFUSAL_CODES);

// packages/barocss-cad/dist/part/part-model.js
var CadPartLimits = Object.freeze({ features: 512, parameters: 256, points: 1024, edges: 64, copies: 64, fileBytes: 4 << 20, stepBytes: 32 << 20, stepTessellatedBytes: 128 << 20, length: 1e4, meshTriangles: 2e6, planarMeshTriangles: 1e5, subdVertices: 1e5 });
function stepSizeProblem(text) {
  const MiB = (n) => `${n / 2 ** 20} MiB`;
  if (text.length > CadPartLimits.stepTessellatedBytes)
    return `the STEP file is larger than ${MiB(CadPartLimits.stepTessellatedBytes)}; a mesh that large opens from a .bcad file (its arrays kept as binary)`;
  if (text.length <= CadPartLimits.stepBytes)
    return null;
  const other = text.length - stepTessellatedChars(text);
  return other > CadPartLimits.stepBytes ? `the STEP file is larger than ${MiB(CadPartLimits.stepBytes)} outside its meshes (${(other / 2 ** 20).toFixed(1)} MiB); only tessellated meshes may take it up to ${MiB(CadPartLimits.stepTessellatedBytes)}` : null;
}
function splitBodies(b) {
  if (b.bodies.length <= 1)
    return [b];
  return b.bodies.map((body) => {
    const shells = b.shells.filter((x) => x.body === body.id), faceIds = new Set(shells.flatMap((x) => x.faces)), faces = b.faces.filter((f) => faceIds.has(f.id));
    const loopIds = new Set(faces.flatMap((f) => f.loops)), loops = b.loops.filter((l) => loopIds.has(l.id)), coIds = new Set(loops.flatMap((l) => l.coedges));
    const coedges = b.coedges.filter((c) => coIds.has(c.id)), edgeIds = new Set(coedges.map((c) => c.edge)), edges = b.edges.filter((e) => edgeIds.has(e.id)), vIds = new Set(edges.flatMap((e) => e.vertices));
    return { ...b, bodies: [body], shells, faces, loops, coedges, edges, vertices: b.vertices.filter((v) => vIds.has(v.id)) };
  });
}
var brepOf = (part, id2) => part.brep ??= part.solid.kind === "upright" ? brepFromPrismatic(part.solid.solid, { id: id2 }) : part.solid.brep;
var isRecord = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var isMeshArray = (v) => v instanceof Float64Array || v instanceof Float32Array || v instanceof Uint32Array || v instanceof Int32Array;
var checkedArrays = /* @__PURE__ */ new WeakMap();
function meshArrayOk(v, what, nv = 0) {
  if (!Array.isArray(v) && !isMeshArray(v))
    return false;
  const a = v, key = `${what}:${nv}`;
  if (checkedArrays.get(a) === key)
    return true;
  if (a.length % 3)
    return false;
  if (what === "positions") {
    for (let i = 0; i < a.length; i++) {
      const x = a[i];
      if (typeof x !== "number" || !Number.isFinite(x) || Math.abs(x) > CadPartLimits.length)
        return false;
    }
  } else {
    if (a.length / 3 > CadPartLimits.meshTriangles)
      return false;
    for (let i = 0; i < a.length; i++) {
      const x = a[i];
      if (!Number.isInteger(x) || x < 0 || x >= nv)
        return false;
    }
  }
  checkedArrays.set(a, key);
  return true;
}
var LONG_TEXT = 1 << 16;
function frameOf(plane, xyz, fail2) {
  if (!isRecord(plane))
    fail2("INPUT", "plane must be { origin, normal, xAxis }");
  const direction = (v, what) => {
    if (!Array.isArray(v) || v.length !== 3 || !v.every((c) => typeof c === "number" && Number.isFinite(c)))
      fail2("INPUT", `plane ${what} must be [x, y, z]`);
    const l = Math.hypot(...v);
    if (!(l > 1e-12))
      fail2("INPUT", `plane ${what} must not be zero`);
    return v.map((c) => c / l);
  };
  const snap = (v) => v.map((c) => Math.abs(c) < 1e-12 ? 0 : Math.abs(Math.abs(c) - 1) < 1e-12 ? Math.sign(c) : c);
  const n = snap(direction(plane.normal, "normal")), x0 = direction(plane.xAxis, "xAxis");
  if (Math.abs(dot(x0, n)) > 1e-9)
    fail2("INPUT", "plane xAxis must be perpendicular to its normal");
  const x = snap(unit(sub(x0, scale(n, dot(x0, n))))), y = snap(cross(n, x));
  return { m: [x[0], y[0], n[0], x[1], y[1], n[1], x[2], y[2], n[2]], o: xyz(plane.origin, "plane origin") };
}
var framed = (frame, p) => !frame ? p : [frame.m[0] * p[0] + frame.m[1] * p[1] + frame.m[2] * p[2] + frame.o[0], frame.m[3] * p[0] + frame.m[4] * p[1] + frame.m[5] * p[2] + frame.o[1], frame.m[6] * p[0] + frame.m[7] * p[1] + frame.m[8] * p[2] + frame.o[2]];
var placed = (frame, compute) => !frame ? compute : () => {
  const r = compute();
  return r.kind === "solid" ? moveAll(r.parts, frame.m, frame.o) : r;
};
var facetBody = (s) => s.kind === "brep" && s.brep.faces.length > 0 && s.brep.faces.some(isFacetFace);
function facetTriangles(brep) {
  let nv = 0, nt = 0;
  for (const f of brep.faces) {
    const p = f.surface;
    nv += p.positions.length / 3;
    nt += p.indices.length / 3;
  }
  const P = new Float64Array(3 * nv), I = new Uint32Array(3 * nt), G = new Int32Array(nt), names = [];
  let ov = 0, ot = 0;
  brep.faces.forEach((f, g) => {
    const p = f.surface, fw = f.sense === "forward", X = p.indices;
    P.set(p.positions, 3 * ov);
    for (let k = 0; k < X.length; k += 3) {
      I[3 * ot + k] = X[k] + ov;
      I[3 * ot + k + 1] = (fw ? X[k + 1] : X[k + 2]) + ov;
      I[3 * ot + k + 2] = (fw ? X[k + 2] : X[k + 1]) + ov;
    }
    G.fill(g, ot, ot + p.indices.length / 3);
    names.push((f.name ?? f.id).replace(/#\d+$/, ""));
    ov += p.positions.length / 3;
    ot += p.indices.length / 3;
  });
  let size = 1;
  for (let k = 0; k < P.length; k++)
    size = Math.max(size, Math.abs(P[k]));
  const { P: welded, remap } = weldVertices(P, nv, 1e-9 * size);
  for (let k = 0; k < I.length; k++)
    I[k] = remap[I[k]];
  return { positions: welded, indices: I, groups: G, names };
}
function affine(s, m, o, rename) {
  if (s.kind === "upright" && m[2] === 0 && m[5] === 0 && m[6] === 0 && m[7] === 0)
    return { kind: "upright", solid: transformPrismatic(s.solid, { matrix: [m[0], m[1], m[3], m[4]], offset: [o[0], o[1]], zScale: m[8], zOffset: o[2], ...rename ? { retag: rename } : {} }) };
  const brep = s.kind === "upright" ? brepFromPrismatic(s.solid) : s.brep;
  return { kind: "brep", brep: transformBrep(brep, { matrix: m, offset: [o[0], o[1], o[2]] }, rename) };
}
function moveAll(parts, m, o, preserveNativeSI = false) {
  return { kind: "solid", parts: parts.map((p) => {
    const exact3 = p.mass ?? (p.solid.kind === "upright" ? /* @__PURE__ */ ((s) => (d) => prismaticMassProperties(s, d))(p.solid.solid) : void 0);
    return { solid: affine(p.solid, m, o), moved: { from: p, m, o }, ...exact3 ? { mass: (d) => movedMass(exact3(d), m, o, preserveNativeSI) } : {} };
  }) };
}
function movedMass(p, m, o, preserveNativeSI = false) {
  const k = Math.cbrt(Math.abs(m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]))), R = m.map((x) => x / k);
  const c = p.centroid, I = p.inertia, k5 = k ** 5;
  const RIRt = [0, 1, 2].map((i) => [0, 1, 2].map((j) => {
    let sum = 0;
    for (let a = 0; a < 3; a++)
      for (let b = 0; b < 3; b++)
        sum += R[3 * i + a] * I[a][b] * R[3 * j + b];
    return sum * k5;
  }));
  const moved = unsupportedNativeMass({
    volume: p.volume * k ** 3,
    mass: p.mass * k ** 3,
    method: p.method,
    inertia: RIRt,
    centroid: [0, 1, 2].map((i) => m[3 * i] * c[0] + m[3 * i + 1] * c[1] + m[3 * i + 2] * c[2] + o[i])
  }, "transformed");
  if (preserveNativeSI && m.every((x, i) => x === (i === 0 || i === 4 || i === 8 ? 1 : 0)) && readNativeSIInertia(p).ok)
    transferNativeMassBasis(p, moved);
  return moved;
}
var HELPERS = Object.freeze({ isRecord, brepOf, CadPartLimits, stepSizeProblem, splitBodies, meshArrayOk, facetBody, facetTriangles, brepBodies, frameOf, framed, placed });

// packages/barocss-cad/dist/features/library.js
var DEG = Math.PI / 180;

// packages/barocss-physics/dist/identity.js
function copyData(input) {
  let count = 0;
  function copy(value, depth) {
    if (++count > 1e6 || depth > 32)
      throw new PhysicsError("INVALID_CONFIG", "data exceeds bounded depth or size");
    if (value === null || typeof value === "boolean")
      return value;
    if (typeof value === "string") {
      for (const character of value) {
        const point = character.codePointAt(0);
        if (point >= 55296 && point <= 57343)
          throw new PhysicsError("INVALID_CONFIG", "strings must be well-formed Unicode");
      }
      return value;
    }
    if (typeof value === "number" && Number.isFinite(value))
      return value;
    if (typeof value !== "object" || value === null)
      throw new PhysicsError("INVALID_CONFIG", "only finite plain data is supported");
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(value);
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype || keys.length !== value.length + 1 || !Array.from({ length: value.length }, (_, i) => descriptors[i]?.enumerable && "value" in descriptors[i]).every(Boolean)) {
        throw new PhysicsError("INVALID_CONFIG", "arrays must be dense ordinary data arrays");
      }
      return Array.from({ length: value.length }, (_, i) => copy(descriptors[i].value, depth + 1));
    }
    if (Object.getPrototypeOf(value) !== Object.prototype || keys.some((key) => typeof key !== "string" || !/^[\x20-\x7e]+$/.test(key) || !descriptors[key]?.enumerable || !("value" in descriptors[key]))) {
      throw new PhysicsError("INVALID_CONFIG", "records must have plain ASCII data fields");
    }
    return Object.fromEntries(keys.map((key) => [key, copy(descriptors[key].value, depth + 1)]));
  }
  return copy(input, 0);
}
function canonicalEncode(input) {
  const value = copyData(input);
  const bytes = [];
  const encodeUtf8 = (text) => {
    const result = [];
    for (const character of text) {
      let point = character.codePointAt(0);
      if (point >= 55296 && point <= 57343)
        point = 65533;
      if (point < 128)
        result.push(point);
      else if (point < 2048)
        result.push(192 | point >> 6, 128 | point & 63);
      else if (point < 65536)
        result.push(224 | point >> 12, 128 | point >> 6 & 63, 128 | point & 63);
      else
        result.push(240 | point >> 18, 128 | point >> 12 & 63, 128 | point >> 6 & 63, 128 | point & 63);
    }
    return result;
  };
  const uint32 = (number) => {
    for (let i = 0; i < 4; i++)
      bytes.push(number >>> i * 8 & 255);
  };
  function write(item) {
    if (item === null) {
      bytes.push(0);
      return;
    }
    if (typeof item === "boolean") {
      bytes.push(item ? 2 : 1);
      return;
    }
    if (typeof item === "string") {
      const encoded = encodeUtf8(item);
      bytes.push(3);
      uint32(encoded.length);
      for (const byte of encoded)
        bytes.push(byte);
      return;
    }
    if (typeof item === "number") {
      bytes.push(4);
      const data = new DataView(new ArrayBuffer(8));
      data.setFloat64(0, item, true);
      for (let i = 0; i < 8; i++)
        bytes.push(data.getUint8(i));
      return;
    }
    if (Array.isArray(item)) {
      bytes.push(5);
      uint32(item.length);
      for (const entry of item)
        write(entry);
      return;
    }
    const record3 = item;
    const keys = Object.keys(record3).sort();
    bytes.push(6);
    uint32(keys.length);
    for (const key of keys) {
      write(key);
      write(record3[key]);
    }
  }
  write(value);
  return Uint8Array.from(bytes);
}
var K = [1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993, 2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987, 1925078388, 2162078206, 2614888103, 3248222580, 3835390401, 4022224774, 264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986, 2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711, 113926993, 338241895, 666307205, 773529912, 1294757372, 1396182291, 1695183700, 1986661051, 2177026350, 2456956037, 2730485921, 2820302411, 3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344, 430227734, 506948616, 659060556, 883997877, 958139571, 1322822218, 1537002063, 1747873779, 1955562222, 2024104815, 2227730452, 2361852424, 2428436474, 2756734187, 3204031479, 3329325298];
var rotate = (x, n) => x >>> n | x << 32 - n;
function sha256(bytes) {
  const padded = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64);
  padded.set(bytes);
  padded[bytes.length] = 128;
  const view4 = new DataView(padded.buffer);
  const bits = bytes.length * 8;
  view4.setUint32(padded.length - 8, Math.floor(bits / 4294967296));
  view4.setUint32(padded.length - 4, bits >>> 0);
  const h = [1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225];
  const w = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++)
      w[i] = view4.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
      const a2 = w[i - 15], b2 = w[i - 2];
      w[i] = w[i - 16] + (rotate(a2, 7) ^ rotate(a2, 18) ^ a2 >>> 3) + w[i - 7] + (rotate(b2, 17) ^ rotate(b2, 19) ^ b2 >>> 10) >>> 0;
    }
    let [a, b, c, d, e, f, g, j] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = j + (rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25)) + (e & f ^ ~e & g) + K[i] + w[i] >>> 0;
      const t2 = (rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)) + (a & b ^ a & c ^ b & c) >>> 0;
      j = g;
      g = f;
      f = e;
      e = d + t1 >>> 0;
      d = c;
      c = b;
      b = a;
      a = t1 + t2 >>> 0;
    }
    for (const [i, v] of [a, b, c, d, e, f, g, j].entries())
      h[i] = h[i] + v >>> 0;
  }
  return `sha256:${h.map((word) => word.toString(16).padStart(8, "0")).join("")}`;
}
function digest(value) {
  return sha256(canonicalEncode(value));
}

// packages/barocss-physics/dist/limits.js
var ID = /^[A-Za-z][A-Za-z0-9._:-]{0,63}$/;

// packages/barocss-physics/dist/math.js
var add2 = (a, b) => a.map((value, index) => value + b[index]);
var sub2 = (a, b) => a.map((value, index) => value - b[index]);
var scale2 = (a, value) => a.map((component) => component * value);
var cross2 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function rotate2(q2, v) {
  const axis = [q2[0], q2[1], q2[2]];
  const t = scale2(cross2(axis, v), 2);
  return add2(v, add2(scale2(t, q2[3]), cross2(axis, t)));
}

// packages/barocss-physics/dist/cad-proxy-validation.js
function proxyError(code, message) {
  throw new PhysicsError(code, message);
}
function proxyRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    proxyError("INVALID_CONFIG", "CAD proxy request must be a plain object");
  }
  return value;
}
function proxyFields(value, allowed) {
  if (Reflect.ownKeys(value).some((key) => typeof key !== "string" || !allowed.includes(key))) {
    proxyError("INVALID_CONFIG", "CAD proxy request has an unsupported field");
  }
}
function proxyFinite(value, min, max, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    proxyError("INVALID_CONFIG", `${label} must be finite and in [${min}, ${max}]`);
  }
  return value;
}
function proxyVector(value, min, max, label) {
  if (!Array.isArray(value) || value.length !== 3 || Reflect.ownKeys(value).length !== 4 || ![0, 1, 2].every((index) => Object.hasOwn(value, index))) {
    proxyError("INVALID_CONFIG", `${label} must be a dense 3-vector`);
  }
  return [0, 1, 2].map((index) => proxyFinite(value[index], min, max, `${label}[${index}]`));
}

// packages/barocss-physics/dist/cad-proxy-admission.js
var CAD_ID = /^[A-Za-z_][A-Za-z0-9_-]*$/;
function requestValues(value) {
  const input = proxyRecord(value);
  proxyFields(input, [
    "sourceVersion",
    "sourceRevision",
    "modelId",
    "surfaceId",
    "kind",
    "proxy",
    "massKg",
    "initialOffsetM",
    "minimumHalfExtentM"
  ]);
  if (input.sourceVersion !== 0)
    proxyError("INVALID_CONFIG", "CAD proxy requires sourceVersion 0");
  if (typeof input.sourceRevision !== "string" || !ID.test(input.sourceRevision)) {
    proxyError("INVALID_CONFIG", "invalid source revision");
  }
  if (typeof input.modelId !== "string" || !CAD_ID.test(input.modelId) || typeof input.surfaceId !== "string" || !CAD_ID.test(input.surfaceId)) {
    proxyError("INVALID_CONFIG", "invalid native model or Surface ID");
  }
  if (input.kind !== "dynamic" && input.kind !== "static")
    proxyError("INVALID_CONFIG", "invalid proxy body kind");
  if (input.proxy !== "sphere" && input.proxy !== "box")
    proxyError("INVALID_CONFIG", "invalid proxy shape");
  if (input.kind === "static" && (Object.hasOwn(input, "massKg") || Object.hasOwn(input, "initialOffsetM"))) {
    proxyError("INVALID_CONFIG", "static proxy cannot declare mass or offset");
  }
  if (input.kind === "dynamic")
    proxyFinite(input.massKg, 1e-6, 1e6, "massKg");
  if (input.proxy === "sphere" && Object.hasOwn(input, "minimumHalfExtentM")) {
    proxyError("INVALID_CONFIG", "sphere proxy cannot declare minimumHalfExtentM");
  }
  if (Object.hasOwn(input, "minimumHalfExtentM")) {
    proxyFinite(input.minimumHalfExtentM, 1e-4, 1e3, "minimumHalfExtentM");
  }
  if (Object.hasOwn(input, "initialOffsetM"))
    proxyVector(input.initialOffsetM, -1e3, 1e3, "initialOffsetM");
  return input;
}
function controlBounds(points) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const row of points)
    for (const point of row)
      for (let axis = 0; axis < 3; axis++) {
        min[axis] = Math.min(min[axis], point[axis]);
        max[axis] = Math.max(max[axis], point[axis]);
      }
  if ([...min, ...max].some((value) => !Number.isFinite(value))) {
    proxyError("INVALID_CONFIG", "native Surface has invalid control bounds");
  }
  return { min, max };
}
function admitCadSurfaceProxy(source2, request2) {
  if (typeof source2 !== "string" || source2.length < 1 || source2.length > 65536) {
    proxyError("INVALID_CONFIG", "CAD source length must be 1..65536 characters");
  }
  const input = requestValues(request2);
  const bodyId = `${input.kind === "dynamic" ? "part" : "fixture"}:${input.modelId}.${input.surfaceId}`;
  if (!ID.test(bodyId))
    proxyError("INVALID_CONFIG", "qualified Physics body ID exceeds bounds");
  const compiled = compileCadModel(source2, { sourceVersion: 0 });
  if (!compiled.ok)
    proxyError("INVALID_CONFIG", `CAD source refused: ${compiled.diagnostics[0]?.code ?? "unknown"}`);
  if (compiled.model.name !== input.modelId)
    proxyError("INVALID_CONFIG", "native model ID differs from selection");
  const native2 = compiled.model.objects.find((object) => object.id === input.surfaceId);
  if (!native2 || native2.kind !== "surface")
    proxyError("INVALID_CONFIG", "selected native object is not a Surface");
  const sourceBoundsMM = controlBounds(native2.controlPoints);
  const sourceCenterMM = sourceBoundsMM.min.map((low, axis) => (low + sourceBoundsMM.max[axis]) / 2);
  const halfSpanM = sourceBoundsMM.min.map((low, axis) => (sourceBoundsMM.max[axis] - low) / 2e3);
  const centerM = sourceCenterMM.map((value) => value / 1e3);
  const positionM = add2(centerM, input.initialOffsetM ?? [0, 0, 0]);
  proxyVector(positionM, -1e4, 1e4, "proxy positionM");
  const shape = input.proxy === "sphere" ? { kind: "sphere", radiusM: Math.max(1e-4, Math.hypot(...halfSpanM)) } : { kind: "box", halfExtentsM: halfSpanM.map((value) => Math.max(value, input.minimumHalfExtentM ?? 1e-4)) };
  if (shape.kind === "sphere")
    proxyFinite(shape.radiusM, 1e-4, 1e3, "proxy radiusM");
  else
    shape.halfExtentsM.forEach((value, axis) => proxyFinite(value, 1e-4, 1e3, `proxy halfExtentsM[${axis}]`));
  const initial = { positionM, orientationXYZW: [0, 0, 0, 1] };
  const body = input.kind === "dynamic" ? {
    id: bodyId,
    kind: "dynamic",
    initial: {
      ...initial,
      velocityMps: [0, 0, 0],
      angularVelocityRadps: [0, 0, 0]
    },
    massKg: input.massKg,
    inertia: { kind: "primitive-com", about: "com", frame: "body-local" }
  } : { id: bodyId, kind: "static", initial };
  const collider = {
    id: `collider:${digest(bodyId).slice(7, 55)}`,
    bodyId,
    geometry: shape,
    local: { positionM: [0, 0, 0], orientationXYZW: [0, 0, 0, 1] },
    material: { restitution: 0, friction: { static: 0, dynamic: 0 } },
    sensor: false,
    ccd: false,
    filter: { categoryBits: 1, maskBits: 65535 }
  };
  const lossLabel = input.proxy === "sphere" ? "Control-net enclosing sphere; native Surface geometry is not the collision shape." : "Control-net axis-aligned box with minimum thickness; native Surface geometry is not the collision shape.";
  const binding = {
    id: `source:${digest(bodyId).slice(7, 55)}`,
    sourceRevision: input.sourceRevision,
    sourceDigest: digest(source2),
    modelId: input.modelId,
    occurrenceId: input.surfaceId,
    entityIds: [bodyId, collider.id],
    approximation: { kind: input.proxy === "sphere" ? "control-net-sphere" : "control-net-box", lossLabel }
  };
  const admitted = {
    sourceSnapshot: source2,
    sourceRevision: input.sourceRevision,
    modelId: input.modelId,
    surfaceId: input.surfaceId,
    bodyId,
    sourceCenterMM: [...sourceCenterMM],
    sourceBoundsMM: { min: [...sourceBoundsMM.min], max: [...sourceBoundsMM.max] },
    lossLabel,
    body,
    collider,
    binding
  };
  Object.freeze(admitted.sourceCenterMM);
  Object.freeze(admitted.sourceBoundsMM.min);
  Object.freeze(admitted.sourceBoundsMM.max);
  Object.freeze(admitted.sourceBoundsMM);
  Object.freeze(body.initial.positionM);
  Object.freeze(body.initial.orientationXYZW);
  if (body.kind === "dynamic") {
    Object.freeze(body.initial.velocityMps);
    Object.freeze(body.initial.angularVelocityRadps);
    Object.freeze(body.inertia);
  }
  Object.freeze(body.initial);
  if (collider.geometry.kind === "box")
    Object.freeze(collider.geometry.halfExtentsM);
  Object.freeze(collider.geometry);
  Object.freeze(collider.local.positionM);
  Object.freeze(collider.local.orientationXYZW);
  Object.freeze(collider.local);
  Object.freeze(collider.material.friction);
  Object.freeze(collider.material);
  Object.freeze(collider.filter);
  Object.freeze(collider);
  Object.freeze(binding.entityIds);
  Object.freeze(binding.approximation);
  Object.freeze(binding);
  Object.freeze(body);
  return Object.freeze(admitted);
}
function assertCadProxyCurrent(proxy, currentSource, currentRevision) {
  if (currentSource !== proxy.sourceSnapshot || currentRevision !== proxy.sourceRevision) {
    proxyError("STALE_SOURCE", "CAD proxy source changed; explicit re-admission is required");
  }
}

// packages/barocss-physics/dist/cad-proxy-pose.js
function cadProxyPose(proxy, body, currentSource, currentRevision) {
  assertCadProxyCurrent(proxy, currentSource, currentRevision);
  if (!body || body.id !== proxy.bodyId || !Array.isArray(body.positionM) || body.positionM.length !== 3 || body.positionM.some((value) => !Number.isFinite(value) || Math.abs(value) > 1e4) || !Array.isArray(body.orientationXYZW) || body.orientationXYZW.length !== 4 || body.orientationXYZW.some((value) => !Number.isFinite(value)) || Math.abs(Math.hypot(...body.orientationXYZW) - 1) > 1e-9) {
    proxyError("INVALID_CONFIG", "Physics body pose differs from CAD proxy binding");
  }
  const positionMM = body.positionM.map((value) => value * 1e3);
  const translation = sub2(positionMM, rotate2([body.orientationXYZW[0], body.orientationXYZW[1], body.orientationXYZW[2], body.orientationXYZW[3]], proxy.sourceCenterMM));
  if (translation.some((value) => !Number.isFinite(value)))
    proxyError("NUMERIC_LIMIT", "unsafe CAD proxy pose");
  return { targetId: proxy.bodyId, translation, rotation: [...body.orientationXYZW] };
}

// examples/physics-motion-foundations-2276/units.test.ts
var M_TOL = 1e-9;
var MM_TOL = 1e-6;
var source = `@model units_fixture {
  version: 0;
  length-unit: mm;
  @surface #asymmetric_panel {
    type: nurbs;
    degree-u: 1;
    degree-v: 1;
    knots-u: [0,0,1,1];
    knots-v: [0,0,1,1];
    control-points: [[[20,-30,40],[20,-30,100]],[[120,10,40],[120,10,100]]];
    weights: [[1,1],[1,1]];
  }
}`;
var request = () => ({
  sourceVersion: 0,
  sourceRevision: "unitsRev1",
  modelId: "units_fixture",
  surfaceId: "asymmetric_panel",
  kind: "dynamic",
  proxy: "box",
  massKg: 1,
  initialOffsetM: [0.1, 0, 0]
});
var near = (got, want, tol) => assert.ok(Number.isFinite(got) && Math.abs(got - want) <= tol, `${got} vs ${want}; tolerance ${tol}`);
function vectorError(got, want, tol) {
  assert.equal(got.length, want.length);
  let max = 0;
  for (let i = 0; i < got.length; i++) {
    near(got[i], want[i], tol);
    max = Math.max(max, Math.abs(got[i] - want[i]));
  }
  return max;
}
test("public CAD proxy: off-origin 100 mm span becomes 0.1 m with explicit approximation labels", (t) => {
  const input = request(), before = structuredClone(input), proxy = admitCadSurfaceProxy(source, input);
  vectorError(proxy.sourceBoundsMM.min, [20, -30, 40], MM_TOL);
  vectorError(proxy.sourceBoundsMM.max, [120, 10, 100], MM_TOL);
  vectorError(proxy.sourceCenterMM, [70, -10, 70], MM_TOL);
  assert.equal(proxy.collider.geometry.kind, "box");
  if (proxy.collider.geometry.kind !== "box") throw new Error("expected admitted box");
  let maxAdmissionErrorM = vectorError(proxy.collider.geometry.halfExtentsM, [0.05, 0.02, 0.03], M_TOL);
  maxAdmissionErrorM = Math.max(maxAdmissionErrorM, vectorError(proxy.body.initial.positionM, [0.17, -0.01, 0.07], M_TOL));
  const spanM = proxy.collider.geometry.halfExtentsM[0] * 2;
  near(spanM, 0.1, M_TOL);
  near((proxy.sourceBoundsMM.max[0] - proxy.sourceBoundsMM.min[0]) / 1e3, spanM, M_TOL);
  const pose = cadProxyPose(proxy, { id: proxy.bodyId, positionM: [...proxy.body.initial.positionM], orientationXYZW: [0, 0, 0, 1] }, source, input.sourceRevision);
  const maxIdentityDisplayErrorMm = vectorError(pose.translation, [100, 0, 0], MM_TOL);
  assert.match(proxy.lossLabel, /Control-net axis-aligned box/);
  assert.match(proxy.lossLabel, /native Surface geometry is not the collision shape/);
  const sphere = admitCadSurfaceProxy(source, { ...input, proxy: "sphere" });
  assert.equal(sphere.collider.geometry.kind, "sphere");
  if (sphere.collider.geometry.kind !== "sphere") throw new Error("expected admitted sphere");
  const expectedRadiusM = Math.sqrt(0.05 ** 2 + 0.02 ** 2 + 0.03 ** 2);
  const sphereRadiusErrorM = Math.abs(sphere.collider.geometry.radiusM - expectedRadiusM);
  near(sphere.collider.geometry.radiusM, expectedRadiusM, M_TOL);
  assert.match(sphere.lossLabel, /Control-net enclosing sphere/);
  assert.match(sphere.lossLabel, /native Surface geometry is not the collision shape/);
  assert.deepEqual(input, before);
  t.diagnostic(JSON.stringify({
    metric: "cad-proxy-unit-admission",
    sourceSpanMm: 100,
    admittedSpanM: spanM,
    maxAdmissionErrorM,
    maxIdentityDisplayErrorMm,
    sphereRadiusErrorM,
    approximateControlBounds: true
  }));
});
test("public CAD proxy: +pi/2 rad Z pose returns the literal center-pivot display transform", (t) => {
  const input = request(), proxy = admitCadSurfaceProxy(source, input);
  const angleRad = Math.PI / 2;
  const body = {
    id: proxy.bodyId,
    positionM: [...proxy.body.initial.positionM],
    orientationXYZW: [0, 0, Math.sin(angleRad / 2), Math.cos(angleRad / 2)]
  };
  const before = structuredClone(body), pose = cadProxyPose(proxy, body, source, input.sourceRevision);
  assert.equal(pose.targetId, proxy.bodyId);
  vectorError(pose.rotation, [0, 0, Math.SQRT1_2, Math.SQRT1_2], 1e-12);
  const translationErrorMm = vectorError(pose.translation, [160, -80, 0], MM_TOL);
  const points = [[20, -30, 40], [20, -30, 100], [120, 10, 40], [120, 10, 100]];
  const expected = [[190, -60, 40], [190, -60, 100], [150, 40, 40], [150, 40, 100]];
  let maxDisplayErrorMm = 0, maxInverseErrorMm = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const displayed = [-p[1] + pose.translation[0], p[0] + pose.translation[1], p[2] + pose.translation[2]];
    maxDisplayErrorMm = Math.max(maxDisplayErrorMm, vectorError(displayed, expected[i], MM_TOL));
    const recovered = [displayed[1] + 80, 160 - displayed[0], displayed[2]];
    maxInverseErrorMm = Math.max(maxInverseErrorMm, vectorError(recovered, p, MM_TOL));
  }
  const c = proxy.sourceCenterMM;
  vectorError([-c[1] + pose.translation[0], c[0] + pose.translation[1], c[2] + pose.translation[2]], [170, -10, 70], MM_TOL);
  assert.deepEqual(body, before);
  t.diagnostic(JSON.stringify({
    metric: "cad-proxy-pose-round-trip",
    angleRad,
    translationErrorMm,
    maxDisplayErrorMm,
    maxInverseErrorMm,
    sourceCenterMm: proxy.sourceCenterMM,
    displayTranslationMm: pose.translation
  }));
});
test("public CAD proxy: exact source/revision mismatch refuses without changing retained input", (t) => {
  const input = request(), proxy = admitCadSurfaceProxy(source, input);
  const body = { id: proxy.bodyId, positionM: [...proxy.body.initial.positionM], orientationXYZW: [0, 0, 0, 1] };
  const proxyBefore = structuredClone(proxy), inputBefore = structuredClone(input), bodyBefore = structuredClone(body);
  const good = cadProxyPose(proxy, body, source, input.sourceRevision);
  for (const [currentSource, revision] of [[`${source}
`, input.sourceRevision], [source, "unitsRev2"]]) {
    assert.throws(
      () => cadProxyPose(proxy, body, currentSource, revision),
      (error) => error instanceof PhysicsError && error.code === "STALE_SOURCE"
    );
    assert.deepEqual(proxy, proxyBefore);
    assert.deepEqual(input, inputBefore);
    assert.deepEqual(body, bodyBefore);
    assert.equal(proxy.sourceSnapshot, source);
    assert.deepEqual(cadProxyPose(proxy, body, source, input.sourceRevision), good);
  }
  t.diagnostic(JSON.stringify({
    metric: "cad-proxy-stale-retention",
    sourceOnlyRefused: true,
    revisionOnlyRefused: true,
    inputsRetained: true,
    originalBindingReusable: true
  }));
});

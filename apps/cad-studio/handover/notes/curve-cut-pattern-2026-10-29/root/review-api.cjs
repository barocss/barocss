const fs = require('node:fs');
const ts = require(process.cwd() + '/node_modules/typescript');
const old = JSON.parse(fs.readFileSync('apps/library-docs/scripts/api-inventory.expected.json'));
const next = JSON.parse(fs.readFileSync('/tmp/d334-root/api-candidate.json'));
const printer = ts.createPrinter({removeComments:true});
const cache = new Map();
function canonicalString(raw) {
  const value = raw.replace(/(__@[A-Za-z]+)@\d+/g, '$1@COMPILER_ID');
  if (!value.includes('|')) return value;
  if (cache.has(value)) return cache.get(value);
  let source;
  for (const text of [`type __D = ${value};`, `interface __D { __method${value}; }`]) {
    const candidate = ts.createSourceFile('review.ts', text, ts.ScriptTarget.Latest, true);
    if (!candidate.parseDiagnostics.length) { source = candidate; break; }
  }
  if (!source) return value;
  const transformed = ts.transform(source, [context => {
    const visit = node => {
      node = ts.visitEachChild(node, visit, context);
      if (ts.isUnionTypeNode(node)) {
        const types = [...node.types].sort((a,b) => printer.printNode(ts.EmitHint.Unspecified,a,source).localeCompare(printer.printNode(ts.EmitHint.Unspecified,b,source)));
        return ts.factory.updateUnionTypeNode(node, types);
      }
      return node;
    };
    return node => ts.visitNode(node, visit);
  }]);
  try { const result=printer.printFile(transformed.transformed[0]);cache.set(value,result);return result; }
  finally { transformed.dispose(); }
}
function canonical(value) {
  if(typeof value==='string') return canonicalString(value);
  if(Array.isArray(value)) return value.map(canonical);
  if(value && typeof value==='object') return Object.fromEntries(Object.entries(value).map(([key,value])=>[key,canonical(value)]));
  return value;
}
const key = row => JSON.stringify(['package','subpath','exportName','space'].map(k=>row[k]));
const a = new Map(old.exposures.map(row=>[key(row),row]));
const b = new Map(next.exposures.map(row=>[key(row),row]));
const changed=[...a.keys()].filter(k=>b.has(k)&&JSON.stringify(canonical(a.get(k)))!==JSON.stringify(canonical(b.get(k))));
const result={purpose:'Review only, no inventory or expected source mutation',normalization:'TypeScript internal well-known-symbol allocation IDs and AST union order only. No intersection/overload/member/array order normalization.',added:[...b.keys()].filter(k=>!a.has(k)),removed:[...a.keys()].filter(k=>!b.has(k)),semanticChanged:changed};
fs.writeFileSync('/tmp/d334-root/api-reviewed-delta.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));

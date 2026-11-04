import assert from 'node:assert/strict';
import {readFileSync,realpathSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {builtinModules} from 'node:module';

/** Build-tool AST inspection only. This function never imports emitted code. */
export function auditEntryGraph(out,entry,emittedFiles,ts){
 const emitted=resolve(out,'emitted'),builtins=new Set(builtinModules.map(n=>n.replace(/^node:/,'')));
 const report={status:'NOT_COMPLETED',entry,allEmittedFiles:emittedFiles,modules:{},reachable:[],unreachable:[],unreachableExternalDependencies:[],firstFailure:null,emittedModulesExecuted:0};
 try{
  for(const file of Object.keys(emittedFiles).filter(n=>n.endsWith('.js')).sort()){
   const absolute=resolve(out,file),source=ts.createSourceFile(absolute,readFileSync(absolute,'utf8'),ts.ScriptTarget.ES2022,true,ts.ScriptKind.JS);
   assert.equal(source.parseDiagnostics.length,0,'Emitted JS parser diagnostics: '+file);
   const edges=[],unsupported=[];
   function edge(node,kind,specifier){
    if(!specifier||!(ts.isStringLiteral(specifier)||ts.isNoSubstitutionTemplateLiteral(specifier))){unsupported.push({kind,line:source.getLineAndCharacterOfPosition(node.pos).line+1,reason:'NONLITERAL_MODULE_SPECIFIER'});return;}
    edges.push({kind,specifier:specifier.text,line:source.getLineAndCharacterOfPosition(node.pos).line+1});
   }
   function visit(node){
    if(ts.isImportDeclaration(node)){if(node.attributes||node.assertClause)unsupported.push({kind:'import-attributes',reason:'UNREVIEWED_IMPORT_ATTRIBUTES'});edge(node,'static-import',node.moduleSpecifier);}
    if(ts.isExportDeclaration(node)&&node.moduleSpecifier){if(node.attributes||node.assertClause)unsupported.push({kind:'export-attributes',reason:'UNREVIEWED_EXPORT_ATTRIBUTES'});edge(node,'export-from',node.moduleSpecifier);}
    if(ts.isCallExpression(node)){
     if(node.expression.kind===ts.SyntaxKind.ImportKeyword){if(node.arguments.length!==1)unsupported.push({kind:'dynamic-import',reason:'UNREVIEWED_IMPORT_ARGUMENTS'});edge(node,'dynamic-import',node.arguments[0]);}
     else if(ts.isIdentifier(node.expression)&&['require','eval','Function','createRequire'].includes(node.expression.text))unsupported.push({kind:'indirect-loader',reason:node.expression.text});
     else if(ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==='require')unsupported.push({kind:'indirect-loader',reason:'property.require'});
    }
    if(ts.isNewExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='Function')unsupported.push({kind:'indirect-loader',reason:'new Function'});
    ts.forEachChild(node,visit);
   }
   visit(source);report.modules[file]={pin:emittedFiles[file],edges,unsupported};
  }
  const seen=new Set(),queue=[entry],base=realpathSync(emitted);
  while(queue.length){
   const file=queue.shift();if(seen.has(file))continue;const module=report.modules[file];assert(module,'Entry dependency is not emitted JS: '+file);seen.add(file);report.reachable.push(file);
   assert.equal(module.unsupported.length,0,'Unsupported reachable module loading: '+file);
   for(const dependency of module.edges){
    const spec=dependency.specifier;
    if(spec.startsWith('node:')){assert(builtins.has(spec.slice(5)),'Unknown Node builtin: '+spec);assert.notEqual(spec,'node:module','Reachable module-loader capability requires a separate contract');continue;}
    assert((spec.startsWith('./')||spec.startsWith('../'))&&spec.endsWith('.js')&&!/[?#\\]/.test(spec),'Non-relative reachable JS dependency: '+file+' -> '+spec);
    const target=resolve(dirname(resolve(out,file)),spec),actual=realpathSync(target);assert(actual.startsWith(base+'/'),'Reachable dependency escapes emitted directory');const key=relative(out,target);assert(emittedFiles[key]&&report.modules[key],'Missing emitted JS dependency: '+key);queue.push(key);
   }
  }
  report.reachable.sort();report.unreachable=Object.keys(report.modules).filter(n=>!seen.has(n)).sort();
  for(const file of report.unreachable)for(const edge of report.modules[file].edges)if(!edge.specifier.startsWith('.')&&!edge.specifier.startsWith('node:'))report.unreachableExternalDependencies.push({file,...edge,execution:'NOT_EXECUTED_NOT_ENTRY_REACHABLE'});
  report.status='PASS_ACTUAL_ENTRY_REACHABLE_CLOSED_JS_GRAPH';report.reachableModules=report.reachable.length;report.unreachableModules=report.unreachable.length;report.allEmittedFileCount=Object.keys(emittedFiles).length;report.allJsModuleCount=Object.keys(report.modules).length;
 }catch(error){report.status='FAIL_ACTUAL_ENTRY_REACHABLE_GRAPH';report.firstFailure={name:error.name,message:error.message,stack:error.stack};}
 return report;
}

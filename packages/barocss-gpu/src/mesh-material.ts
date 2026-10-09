/** Bounded CPU material compiler. No DOM, WebGL, eval or caller GLSL. */
export type MeshMaterialCode='SYNTAX'|'TYPE'|'RANGE'|'BUDGET'|'INPUT'|'IR'|'UNIFORM';
export interface MeshMaterialDiagnostic {code:MeshMaterialCode;message:string;start:number;end:number}
export class MeshMaterialError extends Error {
 constructor(readonly code:MeshMaterialCode,message:string,readonly start=0,readonly end=0){super(message);this.name='MeshMaterialError';}
}
export interface MeshMaterialUniform {name:string;type:'float';min:number;max:number;default:number}
export type MeshMaterialExpression=
 |{kind:'float';type:'float';value:number}
 |{kind:'color';type:'color';hex:string;linear:[number,number,number]}
 |{kind:'uniform';type:'float';name:string}
 |{kind:'unary';type:'float';operator:'+'|'-';value:MeshMaterialExpression}
 |{kind:'binary';type:'float';operator:'+'|'-'|'*';left:MeshMaterialExpression;right:MeshMaterialExpression}
 |{kind:'call';type:'float'|'color';name:'sin'|'cos'|'mix'|'clamp';args:MeshMaterialExpression[]};
export interface MeshMaterialIR {format:'barocss-gpu-mesh-material';version:0;profile:'mesh-opaque-fragment-v0';source:string;shaderId:string;uniforms:MeshMaterialUniform[];expression:MeshMaterialExpression}
export interface MeshMaterialBinding {material:MeshMaterialIR;uniforms:Record<string,number>}
export interface LoweredMeshMaterial {expression:string;uniformDeclarations:string;uniformLayout:(MeshMaterialUniform&{glslName:string})[]}
type Token={text:string;start:number;end:number};
type Term={expression:MeshMaterialExpression;type:'float'|'color';range:[number,number];depth:number;size:number};
function fail(code:MeshMaterialCode,message:string,token?:Token):never{throw new MeshMaterialError(code,message,token?.start??0,token?.end??0);}
const zero=(n:number)=>n===0?0:n;
function freeze<T>(value:T):T{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
function tokens(source:string):Token[]{
 const result:Token[]=[];let i=0;
 while(i<source.length){const start=i,c=source[i];if(/\s/.test(c)){i++;continue;}if(source.startsWith('/*',i)){const end=source.indexOf('*/',i+2);if(end<0)fail('SYNTAX','Unclosed comment',{text:c,start,end:i+2});i=end+2;continue;}
 let text:string;
 if(c==='#'){i++;while(i<source.length&&/[A-Za-z0-9_-]/.test(source[i]))i++;text=source.slice(start,i);}
 else if(/[A-Za-z_]/.test(c)){i++;while(i<source.length&&/[A-Za-z0-9_]/.test(source[i]))i++;text=source.slice(start,i);}
 else if(/\d/.test(c)||(c==='.'&&/\d/.test(source[i+1]??''))){const match=/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?/.exec(source.slice(i));text=match![0];i+=text.length;}
 else if('@{}():;,+-*'.includes(c)){text=c;i++;}
 else fail('SYNTAX','Unsupported material token '+c,{text:c,start,end:i+1});
 result.push({text,start,end:i});if(result.length>4096)fail('BUDGET','Material exceeds4096 tokens',result.at(-1));
 }
 result.push({text:'<eof>',start:i,end:i});return result;
}
class Parser {
 private i=0;private nodes=0;private uniforms:MeshMaterialUniform[]=[];
 private locals=new Map<string,Term>();
 constructor(private readonly source:string,private readonly list:Token[]){}
 private current(){return this.list[this.i];}
 private take(text:string){const t=this.current();if(t.text!==text)fail('SYNTAX','Expected '+text,t);this.i++;return t;}
 private signedNumber(){let sign=1;if(this.current().text==='-'||this.current().text==='+'){sign=this.current().text==='-'?-1:1;this.i++;}const token=this.current();if(!/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$/.test(token.text))fail('SYNTAX','Numeric literal required',token);this.i++;const n=zero(sign*Number(token.text));if(!Number.isFinite(n)||Math.abs(n)>1000)fail('RANGE','Literal must be finite within±1000',token);return n;}
 private term(expression:MeshMaterialExpression,type:'float'|'color',range:[number,number],children:Term[],token:Token):Term{if(++this.nodes>256)fail('BUDGET','Material exceeds256 expression nodes',token);const depth=1+Math.max(0,...children.map(c=>c.depth));if(depth>16)fail('BUDGET','Material expression exceeds depth16',token);if(!range.every(n=>Number.isFinite(n)&&Math.abs(n)<=1e6))fail('RANGE','Intermediate bound exceeds±1e6',token);return{expression,type,range,depth,size:1+children.reduce((sum,child)=>sum+child.size,0)};}
 private float(term:Term,token:Token){if(term.type!=='float')fail('TYPE','Float expression required',token);}
 private primary(nesting:number):Term{
 if(nesting>16)fail('BUDGET','Material parse nesting exceeds16',this.current());const token=this.current();
 if(token.text==='('){this.i++;const value=this.expression(0,nesting+1);this.take(')');return value;}
 if(token.text==='+'||token.text==='-'){this.i++;const value=this.primary(nesting+1);this.float(value,token);const range: [number,number]=token.text==='-'?[-value.range[1],-value.range[0]]:value.range;return this.term({kind:'unary',type:'float',operator:token.text,value:value.expression},'float',range,[value],token);}
 if(/^\d|^\.\d/.test(token.text)){const value=this.signedNumber();return this.term({kind:'float',type:'float',value},'float',[value,value],[],token);}
 if(token.text.startsWith('#')){this.i++;if(!/^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(token.text))fail('SYNTAX','Color requires #RGB or #RRGGBB',token);const hex=(token.text.length===4?'#'+[...token.text.slice(1)].map(digit=>digit+digit).join(''):token.text).toUpperCase(),linear=[1,3,5].map(i=>Math.pow(parseInt(hex.slice(i,i+2),16)/255,2.2)) as [number,number,number];return this.term({kind:'color',type:'color',hex,linear},'color',[0,1],[],token);}
 if(/^[A-Za-z_][A-Za-z0-9_]*$/.test(token.text)){
 this.i++;if(this.current().text==='('){const name=token.text;if(!['sin','cos','mix','clamp'].includes(name))fail('SYNTAX','Unsupported material function',token);this.take('(');const args:Term[]=[];if(this.current().text!==')'){for(;;){args.push(this.expression(0,nesting+1));if(this.current().text!==',')break;this.take(',');}}this.take(')');let type:'float'|'color'='float',range:[number,number];
 if(name==='sin'||name==='cos'){if(args.length!==1)fail('TYPE','sin/cos requires one float',token);this.float(args[0],token);if(args[0].range.some(n=>Math.abs(n)>1000))fail('RANGE','sin/cos argument exceeds±1000',token);range=[-1,1];}
 else if(name==='mix'){if(args.length!==3||args[0].type!=='color'||args[1].type!=='color'||args[2].type!=='float')fail('TYPE','mix requires color,color,float',token);if(args[2].range[0]<0||args[2].range[1]>1)fail('RANGE','mix ratio must be bounded within0..1',token);type='color';range=[0,1];}
 else{if(args.length!==3)fail('TYPE','clamp requires three floats',token);args.forEach(arg=>this.float(arg,token));if(args[1].range[1]>args[2].range[0])fail('RANGE','clamp bounds are not ordered',token);range=[args[1].range[0],args[2].range[1]];}
 return this.term({kind:'call',type,name:name as 'sin'|'cos'|'mix'|'clamp',args:args.map(a=>a.expression)},type,range,args,token);
 }
 const local=this.locals.get(token.text);if(local){if(this.nodes+local.size>256)fail('BUDGET','Material exceeds256 definition and expanded expression nodes',token);this.nodes+=local.size;return local;}
 const uniform=this.uniforms.find(u=>u.name===token.text);if(!uniform)fail('TYPE','Undeclared material uniform '+token.text,token);return this.term({kind:'uniform',type:'float',name:token.text},'float',[uniform.min,uniform.max],[],token);
 }
 fail('SYNTAX','Material expression required',token);
 }
 private expression(min=0,nesting=0):Term{let left=this.primary(nesting);for(;;){const token=this.current(),precedence=token.text==='*'?2:token.text==='+'||token.text==='-'?1:0;if(precedence===0||precedence<min)break;this.i++;const right=this.expression(precedence+1,nesting+1);this.float(left,token);this.float(right,token);const[a,b]=left.range,[c,d]=right.range;const range: [number,number]=token.text==='+'?[a+c,b+d]:token.text==='-'?[a-d,b-c]:[Math.min(a*c,a*d,b*c,b*d),Math.max(a*c,a*d,b*c,b*d)];left=this.term({kind:'binary',type:'float',operator:token.text as '+'|'-'|'*',left:left.expression,right:right.expression},'float',range,[left,right],token);}return left;}
 parse():MeshMaterialIR{
 this.take('@');this.take('shader');const id=this.current();if(!/^#[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(id.text))fail('SYNTAX','Shader ID requires ASCII1..64',id);this.i++;this.take('{');
 while(this.current().text==='@'&&this.list[this.i+1]?.text==='uniform'){
 this.take('@');this.take('uniform');const name=this.current();if(!/^[A-Za-z_][A-Za-z0-9_]{0,31}$/.test(name.text))fail('SYNTAX','Uniform name requires ASCII1..32',name);if(this.uniforms.some(u=>u.name===name.text))fail('TYPE','Duplicate uniform name',name);this.i++;this.take(':');this.take('float');this.take('(');const min=this.signedNumber();this.take(',');const max=this.signedNumber();this.take(',');const value=this.signedNumber();this.take(')');this.take(';');if(min>max||value<min||value>max)fail('RANGE','Uniform min/default/max are not ordered',name);this.uniforms.push({name:name.text,type:'float',min,max,default:value});if(this.uniforms.length>16)fail('BUDGET','Material exceeds16 uniforms',name);
 }
 while(this.current().text==='@'&&this.list[this.i+1]?.text==='let'){
 this.take('@');this.take('let');const name=this.current();if(!/^[A-Za-z_][A-Za-z0-9_]{0,31}$/.test(name.text))fail('SYNTAX','Local name requires ASCII1..32',name);if(this.locals.has(name.text)||this.uniforms.some(u=>u.name===name.text)||['sin','cos','mix','clamp','float','color'].includes(name.text))fail('TYPE','Local name collides with an existing or reserved name',name);if(this.locals.size>=16)fail('BUDGET','Material exceeds16 local declarations',name);this.i++;this.take(':');const type=this.current();if(type.text!=='float'&&type.text!=='color')fail('SYNTAX','Local type requires float or color',type);this.i++;this.take('(');const value=this.expression();this.take(')');this.take(';');if(value.type!==type.text)fail('TYPE','Local expression does not match its declared type',type);this.locals.set(name.text,value);
 }
 this.take('@');this.take('fragment');this.take('{');this.take('color');this.take(':');const expression=this.expression();if(expression.type!=='color')fail('TYPE','Opaque material output requires color',this.current());this.take(';');this.take('}');this.take('}');this.take('<eof>');
 return freeze({format:'barocss-gpu-mesh-material',version:0,profile:'mesh-opaque-fragment-v0',source:this.source,shaderId:id.text.slice(1),uniforms:this.uniforms,expression:expression.expression});
 }
}
export function compileMeshMaterial(source:string):{ok:true;material:MeshMaterialIR}|{ok:false;diagnostics:MeshMaterialDiagnostic[]}{
 try{if(typeof source!=='string')fail('INPUT','Material source must be text');if(new TextEncoder().encode(source).length>65536)fail('BUDGET','Material source exceeds64KiB');return{ok:true,material:new Parser(source,tokens(source)).parse()};}
 catch(error){const e=error instanceof MeshMaterialError?error:new MeshMaterialError('SYNTAX',error instanceof Error?error.message:'Material compile failed');return{ok:false,diagnostics:[{code:e.code,message:e.message,start:e.start,end:e.end}]};}
}
function ownSnapshot(input:unknown):unknown{let budget=8192;const active=new WeakSet<object>();const copy=(v:unknown,depth:number):unknown=>{if(--budget<0||depth>24)fail('BUDGET','Material own-data value/depth limit');if(typeof v==='number'){if(!Number.isFinite(v))fail('INPUT','Material data must be finite');return zero(v);}if(typeof v==='string'){if(v.length>65536)fail('BUDGET','Material string limit');return v;}if(typeof v==='boolean'||v===null)return v;if(!v||typeof v!=='object'||active.has(v))fail('INPUT','Material requires acyclic plain data');const array=Array.isArray(v),proto=Object.getPrototypeOf(v),d=Object.getOwnPropertyDescriptors(v),keys=Reflect.ownKeys(v);if(array?proto!==Array.prototype:proto!==Object.prototype)fail('INPUT','Material foreign prototype');if(keys.length>(array?257:16)||keys.some(k=>typeof k!=='string'||!('value'in d[k])||(!array||k!=='length')&&!d[k].enumerable))fail('INPUT','Material getter/hidden/symbol/excess fields');active.add(v);let out:unknown;if(array){const n=d.length.value;if(!Number.isInteger(n)||n<0||n>256||keys.length!==n+1||Array.from({length:n},(_,i)=>!Object.hasOwn(d,String(i))).some(Boolean))fail('INPUT','Material requires dense bounded arrays');out=Array.from({length:n},(_,i)=>copy(d[String(i)].value,depth+1));}else out=Object.fromEntries((keys as string[]).map(k=>[k,copy(d[k].value,depth+1)]));active.delete(v);return out;};return copy(input,0);}
const canonical=(value:unknown):unknown=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)])):value;
export function validateMeshMaterialIR(input:unknown):MeshMaterialIR{const data=ownSnapshot(input) as Partial<MeshMaterialIR>;if(!data||typeof data!=='object'||typeof data.source!=='string')fail('IR','Material IR source required');const compiled=compileMeshMaterial(data.source);if(!compiled.ok)throw new MeshMaterialError('IR',compiled.diagnostics[0].message);if(JSON.stringify(canonical(data))!==JSON.stringify(canonical(compiled.material)))fail('IR','Material IR does not match its reconstructed source');return compiled.material;}
const glFloat=(n:number)=>n.toPrecision(17);
export function lowerMeshMaterial(input:unknown):LoweredMeshMaterial{const material=validateMeshMaterialIR(input),uniformLayout=material.uniforms.map((u,i)=>({...u,glslName:'mat_u_'+i}));const expression=(e:MeshMaterialExpression):string=>{switch(e.kind){case'float':return glFloat(e.value);case'color':return'vec3('+e.linear.map(glFloat).join(',')+')';case'uniform':return uniformLayout.find(u=>u.name===e.name)!.glslName;case'unary':return'('+e.operator+expression(e.value)+')';case'binary':return'('+expression(e.left)+e.operator+expression(e.right)+')';case'call':{const args=e.args.map(expression);if(e.name==='mix')args[2]='clamp('+args[2]+',0.0,1.0)';return e.name+'('+args.join(',')+')';}}};return{expression:'clamp('+expression(material.expression)+',vec3(0.0),vec3(1.0))',uniformDeclarations:uniformLayout.map(u=>'uniform float '+u.glslName+';').join('\n'),uniformLayout};}
export function validateMeshMaterialBinding(input:unknown):MeshMaterialBinding{
 const data=ownSnapshot(input) as Record<string,unknown>;if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).length!==2||!Object.hasOwn(data,'material')||!Object.hasOwn(data,'uniforms'))fail('INPUT','Material binding requires material/uniforms');const material=validateMeshMaterialIR(data.material),values=data.uniforms;if(!values||typeof values!=='object'||Array.isArray(values))fail('UNIFORM','Uniform values require own record');const entries=Object.entries(values);if(entries.length>16||entries.some(([name])=>!material.uniforms.some(u=>u.name===name)))fail('UNIFORM','Unknown/excess uniform value');const uniforms:Record<string,number>={};for(const u of material.uniforms){const n=Object.hasOwn(values,u.name)?(values as Record<string,unknown>)[u.name]:u.default;if(typeof n!=='number'||!Number.isFinite(n)||n<u.min||n>u.max)fail('UNIFORM','Uniform '+u.name+' outside its finite declared range');uniforms[u.name]=zero(n);}return freeze({material,uniforms});
}

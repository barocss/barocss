/** Bounded CPU material compiler. No DOM, WebGL, eval or caller GLSL. */
export type MeshMaterialCode='SYNTAX'|'TYPE'|'RANGE'|'BUDGET'|'INPUT'|'IR'|'UNIFORM';
export interface MeshMaterialDiagnostic {code:MeshMaterialCode;message:string;start:number;end:number}
export class MeshMaterialError extends Error {
 constructor(readonly code:MeshMaterialCode,message:string,readonly start=0,readonly end=0){super(message);this.name='MeshMaterialError';}
}
export interface MeshMaterialUniform {name:string;type:'float';min:number;max:number;default:number}
type MaterialExpression<Input>=
 |{kind:'float';type:'float';value:number}
 |{kind:'color';type:'color';hex:string;linear:[number,number,number]}
 |{kind:'uniform';type:'float';name:string}
 |{kind:'unary';type:'float';operator:'+'|'-';value:MaterialExpression<Input>}
 |{kind:'binary';type:'float';operator:'+'|'-'|'*';left:MaterialExpression<Input>;right:MaterialExpression<Input>}
 |{kind:'call';type:'float'|'color';name:'sin'|'cos'|'mix'|'clamp';args:MaterialExpression<Input>[]}
 |Input;
export type MeshMaterialExpression=MaterialExpression<never>;
type UVInput={kind:'input';type:'float';name:'uv_u'|'uv_v'};
export type EngineUVMaterialExpression=MaterialExpression<UVInput>;
export interface MeshMaterialIR {format:'barocss-gpu-mesh-material';version:0;profile:'mesh-opaque-fragment-v0';source:string;shaderId:string;uniforms:MeshMaterialUniform[];expression:MeshMaterialExpression}
export interface MeshMaterialBinding {material:MeshMaterialIR;uniforms:Record<string,number>}
export interface LoweredMeshMaterial {expression:string;uniformDeclarations:string;uniformLayout:(MeshMaterialUniform&{glslName:string})[]}
export interface EngineUVMaterialIR {format:'barocss-gpu-engine-uv-material';version:0;profile:'engine-opaque-uv-fragment-v0';source:string;shaderId:string;uniforms:MeshMaterialUniform[];expression:EngineUVMaterialExpression}
export interface EngineUVMaterialBinding {material:EngineUVMaterialIR;uniforms:Record<string,number>}
export interface LoweredEngineUVMaterial extends LoweredMeshMaterial {inputDeclarations:'in vec2 v_engine_uv;'}
type Token={text:string;start:number;end:number};
type ParsedMaterial={source:string;shaderId:string;uniforms:MeshMaterialUniform[];expression:EngineUVMaterialExpression};
type Term={expression:EngineUVMaterialExpression;type:'float'|'color';range:[number,number];depth:number;size:number};
function fail(code:MeshMaterialCode,message:string,token?:Token):never{throw new MeshMaterialError(code,message,token?.start??0,token?.end??0);}
const zero=(n:number)=>n===0?0:n;
function freeze<T>(value:T):T{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
function tokens(source:string):Token[]{
 const result:Token[]=[];let i=0;
 while(i<source.length){const start=i,c=source[i];if(/\s/.test(c)){i++;continue;}
 // Keep original source offsets; line terminators remain ordinary whitespace.
 if(source.startsWith('//',i)){i+=2;while(i<source.length&&!/[\r\n\u2028\u2029]/.test(source[i]))i++;continue;}
 if(source.startsWith('/*',i)){const end=source.indexOf('*/',i+2);if(end<0)fail('SYNTAX','Unclosed comment',{text:c,start,end:i+2});i=end+2;continue;}
 let text:string;
 if(c==='#'){i++;while(i<source.length&&/[A-Za-z0-9_-]/.test(source[i]))i++;text=source.slice(start,i);}
 else if(/[A-Za-z_]/.test(c)){i++;while(i<source.length&&/[A-Za-z0-9_]/.test(source[i]))i++;text=source.slice(start,i);}
 else if(/\d/.test(c)||(c==='.'&&/\d/.test(source[i+1]??''))){const match=/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?/.exec(source.slice(i));text=match![0];i+=text.length;}
 else if('@{}():;,+-*/'.includes(c)){text=c;i++;}
 else fail('SYNTAX','Unsupported material token '+c,{text:c,start,end:i+1});
 result.push({text,start,end:i});if(result.length>4096)fail('BUDGET','Material exceeds4096 tokens',result.at(-1));
 }
 result.push({text:'<eof>',start:i,end:i});return result;
}
class Parser {
 private i=0;private nodes=0;private uniforms:MeshMaterialUniform[]=[];
 private locals=new Map<string,Term>();
 constructor(private readonly source:string,private readonly list:Token[],private readonly uvInputs=false){}
 private inputName(name:string):name is UVInput['name']{return this.uvInputs&&(name==='uv_u'||name==='uv_v');}
 private current(){return this.list[this.i];}
 private take(text:string){const t=this.current();if(t.text!==text)fail('SYNTAX','Expected '+text,t);this.i++;return t;}
 private signedNumber(){let sign=1;if(this.current().text==='-'||this.current().text==='+'){sign=this.current().text==='-'?-1:1;this.i++;}const token=this.current();if(!/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$/.test(token.text))fail('SYNTAX','Numeric literal required',token);this.i++;const n=zero(sign*Number(token.text));if(!Number.isFinite(n)||Math.abs(n)>1000)fail('RANGE','Literal must be finite within±1000',token);return n;}
 private term(expression:EngineUVMaterialExpression,type:'float'|'color',range:[number,number],children:Term[],token:Token):Term{if(++this.nodes>256)fail('BUDGET','Material exceeds256 expression nodes',token);const depth=1+Math.max(0,...children.map(c=>c.depth));if(depth>16)fail('BUDGET','Material expression exceeds depth16',token);if(!range.every(n=>Number.isFinite(n)&&Math.abs(n)<=1e6))fail('RANGE','Intermediate bound exceeds±1e6',token);return{expression,type,range,depth,size:1+children.reduce((sum,child)=>sum+child.size,0)};}
 private float(term:Term,token:Token){if(term.type!=='float')fail('TYPE','Float expression required',token);}
 private color(hex:string,token:Token):Term{const linear=[1,3,5].map(i=>Math.pow(parseInt(hex.slice(i,i+2),16)/255,2.2)) as [number,number,number];return this.term({kind:'color',type:'color',hex,linear},'color',[0,1],[],token);}
 private primary(nesting:number):Term{
 if(nesting>16)fail('BUDGET','Material parse nesting exceeds16',this.current());const token=this.current();
 if(token.text==='('){this.i++;const value=this.expression(0,nesting+1);this.take(')');return value;}
 if(token.text==='+'||token.text==='-'){this.i++;const value=this.primary(nesting+1);this.float(value,token);const range: [number,number]=token.text==='-'?[-value.range[1],-value.range[0]]:value.range;return this.term({kind:'unary',type:'float',operator:token.text,value:value.expression},'float',range,[value],token);}
 if(/^\d|^\.\d/.test(token.text)){const value=this.signedNumber();return this.term({kind:'float',type:'float',value},'float',[value,value],[],token);}
 if(token.text.startsWith('#')){this.i++;if(!/^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(token.text))fail('SYNTAX','Color requires #RGB or #RRGGBB',token);const hex=(token.text.length===4?'#'+[...token.text.slice(1)].map(digit=>digit+digit).join(''):token.text).toUpperCase();return this.color(hex,token);}
 if(/^[A-Za-z_][A-Za-z0-9_]*$/.test(token.text)){
 this.i++;if(this.current().text==='('){const name=token.text;
 if(name==='rgb'){
  this.take('(');const channels:number[]=[];
  for(let channel=0;channel<3;channel++){
   if(channel>0)this.take(',');
   const start=this.current(),value=this.signedNumber(),literal={text:this.source.slice(start.start,this.list[this.i-1].end),start:start.start,end:this.list[this.i-1].end};
   if(!Number.isInteger(value)||value<0||value>255)fail('RANGE','RGB channel requires an integer byte within0..255',literal);
   channels.push(value);
  }
  this.take(')');return this.color('#'+channels.map(value=>value.toString(16).padStart(2,'0')).join('').toUpperCase(),token);
 }
 if(name==='pow'){
  this.take('(');if(this.current().text===')')fail('TYPE','pow requires a float and unsigned integer literal2..8',token);
  const base=this.expression(0,nesting+1);if(this.current().text!==',')fail('TYPE','pow requires two arguments',token);this.take(',');
  if(!/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$/.test(this.current().text))fail('TYPE','pow exponent requires an unsigned numeric literal',token);
  const exponent=this.primary(nesting+1);if(this.current().text!==')')fail('TYPE','pow exponent must be a single literal',token);this.take(')');this.float(base,token);
  const n=exponent.expression.kind==='float'?exponent.expression.value:NaN;
  if(!Number.isInteger(n)||n<2||n>8)fail('RANGE','pow exponent requires integer2..8',token);
  const copies=(n-1)*base.size;if(this.nodes+copies>256)fail('BUDGET','Material exceeds256 definition and expanded expression nodes',token);this.nodes+=copies;
  let product=base;for(let i=1;i<n;i++){
   const[a,b]=product.range,[c,d]=base.range,values=[a*c,a*d,b*c,b*d];
   product=this.term({kind:'binary',type:'float',operator:'*',left:product.expression,right:base.expression},'float',[Math.min(...values),Math.max(...values)],[product,base],token);
  }return product;
 }
 if(!['sin','cos','mix','clamp','abs','min','max','smoothstep','radians'].includes(name))fail('SYNTAX','Unsupported material function',token);this.take('(');const args:Term[]=[];if(this.current().text!==')'){for(;;){args.push(this.expression(0,nesting+1));if(this.current().text!==',')break;this.take(',');}}this.take(')');let type:'float'|'color'='float',range:[number,number];
 if(name==='radians'){
  if(args.length!==1)fail('TYPE','radians requires one float',token);this.float(args[0],token);
  const value=args[0];if(value.range.some(n=>Math.abs(n)>1000))fail('RANGE','radians argument exceeds±1000 degrees',token);
  const factor=Math.PI/180,constant=this.term({kind:'float',type:'float',value:factor},'float',[factor,factor],[],token);
  return this.term({kind:'binary',type:'float',operator:'*',left:value.expression,right:constant.expression},'float',[value.range[0]*factor,value.range[1]*factor],[value,constant],token);
 }
 if(name==='smoothstep'){
  if(args.length!==3)fail('TYPE','smoothstep requires three floats',token);args.forEach(a=>this.float(a,token));
  const literalValue=(term:Term):number=>{
   const e=term.expression;if(e.kind==='float')return e.value;
   if(e.kind==='unary'&&e.value.kind==='float')return zero((e.operator==='-'?-1:1)*e.value.value);
   return fail('TYPE','smoothstep edges require signed literal constants',token);
  };
  const[edge0,edge1,x]=args,low=literalValue(edge0),high=literalValue(edge1),reciprocal=1/(high-low);
  if(!(low<high)||!Number.isFinite(reciprocal)||reciprocal>1000)fail('RANGE','smoothstep edges require ordered bounds and reciprocal≤1000',token);
  if(x.range.some(n=>Math.abs(n)>1000))fail('RANGE','smoothstep input exceeds±1000',token);
  const literal=(n:number)=>this.term({kind:'float',type:'float',value:n},'float',[n,n],[],token);
  const binary=(operator:'-'|'*',a:Term,b:Term,r:[number,number])=>this.term({kind:'binary',type:'float',operator,left:a.expression,right:b.expression},'float',r,[a,b],token);
  const shifted=binary('-',x,edge0,[x.range[0]-low,x.range[1]-low]),inverse=literal(reciprocal);
  const normalized=binary('*',shifted,inverse,[shifted.range[0]*reciprocal,shifted.range[1]*reciprocal]);
  const clipped=(n:number)=>Math.max(0,Math.min(1,n)),tArgs=[normalized,literal(0),literal(1)];
  const t=this.term({kind:'call',type:'float',name:'clamp',args:tArgs.map(a=>a.expression)},'float',[clipped(normalized.range[0]),clipped(normalized.range[1])],tArgs,token);
  // The polynomial contains three complete t trees; charge the other two.
  if(this.nodes+2*t.size>256)fail('BUDGET','Material exceeds256 definition and expanded expression nodes',token);
  this.nodes+=2*t.size;
  const squared=binary('*',t,t,[t.range[0]*t.range[0],t.range[1]*t.range[1]]),two=literal(2);
  const twice=binary('*',two,t,[2*t.range[0],2*t.range[1]]),three=literal(3);
  const factor=binary('-',three,twice,[3-twice.range[1],3-twice.range[0]]);
  const polynomial=binary('*',squared,factor,[squared.range[0]*factor.range[0],squared.range[1]*factor.range[1]]),out=[polynomial,literal(0),literal(1)];
  return this.term({kind:'call',type:'float',name:'clamp',args:out.map(a=>a.expression)},'float',[0,1],out,token);
 }
 if(name==='min'||name==='max'){
  if(args.length!==2)fail('TYPE','min/max requires two floats',token);args.forEach(a=>this.float(a,token));
  if(args.some(a=>a.range.some(n=>Math.abs(n)>1000)))fail('RANGE','min/max argument exceeds±1000',token);
  const[a,b]=args,cap=this.term({kind:'float',type:'float',value:1000},'float',[1000,1000],[],token);
  const lower=name==='min'?this.term({kind:'unary',type:'float',operator:'-',value:cap.expression},'float',[-1000,-1000],[cap],token):b;
  const expanded=name==='min'?[a,lower,b]:[a,b,cap],extreme=name==='min'?Math.min:Math.max;
  return this.term({kind:'call',type:'float',name:'clamp',args:expanded.map(a=>a.expression)},'float',[extreme(a.range[0],b.range[0]),extreme(a.range[1],b.range[1])],expanded,token);
 }
 if(name==='abs'){
  if(args.length!==1)fail('TYPE','abs requires one float',token);this.float(args[0],token);
  const value=args[0],maximum=Math.max(...value.range.map(Math.abs));
  if(maximum>1000)fail('RANGE','abs argument exceeds±1000',token);
  // Reuse the existing clamp/unary/addition IR and charge the second value tree.
  if(this.nodes+value.size>256)fail('BUDGET','Material exceeds256 definition and expanded expression nodes',token);
  this.nodes+=value.size;
  const literal=(n:number)=>this.term({kind:'float',type:'float',value:n},'float',[n,n],[],token);
  const positiveArgs=[value,literal(0),literal(1000)];
  const positive=this.term({kind:'call',type:'float',name:'clamp',args:positiveArgs.map(a=>a.expression)},'float',[0,1000],positiveArgs,token);
  const negative=this.term({kind:'unary',type:'float',operator:'-',value:value.expression},'float',[-value.range[1],-value.range[0]],[value],token);
  const negativeArgs=[negative,literal(0),literal(1000)];
  const magnitude=this.term({kind:'call',type:'float',name:'clamp',args:negativeArgs.map(a=>a.expression)},'float',[0,1000],negativeArgs,token);
  return this.term({kind:'binary',type:'float',operator:'+',left:positive.expression,right:magnitude.expression},'float',[0,maximum],[positive,magnitude],token);
 }
 if(name==='sin'||name==='cos'){if(args.length!==1)fail('TYPE','sin/cos requires one float',token);this.float(args[0],token);if(args[0].range.some(n=>Math.abs(n)>1000))fail('RANGE','sin/cos argument exceeds±1000',token);range=[-1,1];}
 else if(name==='mix'){
 if(args.length!==3||args[0].type!==args[1].type||args[2].type!=='float')fail('TYPE','mix requires color,color,float or float,float,float',token);
 if(args[2].range[0]<0||args[2].range[1]>1)fail('RANGE','mix ratio must be bounded within0..1',token);
 if(args[0].type==='float'){
  const[a,b,t]=args;
  // a appears twice in the expanded arithmetic; charge its full subtree again.
  if(this.nodes+a.size>256)fail('BUDGET','Material exceeds256 definition and expanded expression nodes',token);
  this.nodes+=a.size;
  const difference=this.term({kind:'binary',type:'float',operator:'-',left:b.expression,right:a.expression},'float',[b.range[0]-a.range[1],b.range[1]-a.range[0]],[b,a],token);
  const[x,y]=difference.range,[u,v]=t.range;
  const product=this.term({kind:'binary',type:'float',operator:'*',left:difference.expression,right:t.expression},'float',[Math.min(x*u,x*v,y*u,y*v),Math.max(x*u,x*v,y*u,y*v)],[difference,t],token);
  return this.term({kind:'binary',type:'float',operator:'+',left:a.expression,right:product.expression},'float',[a.range[0]+product.range[0],a.range[1]+product.range[1]],[a,product],token);
 }
 type='color';range=[0,1];}
 else{if(args.length!==3)fail('TYPE','clamp requires three floats',token);args.forEach(arg=>this.float(arg,token));if(args[1].range[1]>args[2].range[0])fail('RANGE','clamp bounds are not ordered',token);range=[args[1].range[0],args[2].range[1]];}
 return this.term({kind:'call',type,name:name as 'sin'|'cos'|'mix'|'clamp',args:args.map(a=>a.expression)},type,range,args,token);
 }
 if(this.inputName(token.text))return this.term({kind:'input',type:'float',name:token.text},'float',[-1000,1000],[],token);
 const local=this.locals.get(token.text);if(local){if(this.nodes+local.size>256)fail('BUDGET','Material exceeds256 definition and expanded expression nodes',token);this.nodes+=local.size;return local;}
 const uniform=this.uniforms.find(u=>u.name===token.text);if(!uniform)fail('TYPE','Undeclared material uniform '+token.text,token);return this.term({kind:'uniform',type:'float',name:token.text},'float',[uniform.min,uniform.max],[],token);
 }
 fail('SYNTAX','Material expression required',token);
 }
 private expression(min=0,nesting=0):Term{let left=this.primary(nesting);for(;;){const token=this.current(),precedence=token.text==='*'||token.text==='/'?2:token.text==='+'||token.text==='-'?1:0;if(precedence===0||precedence<min)break;this.i++;
 if(token.text==='/'){
  this.float(left,token);
  const start=this.current(),divisor=this.signedNumber(),literal={text:this.source.slice(start.start,this.list[this.i-1].end),start:start.start,end:this.list[this.i-1].end};
  if(divisor===0)fail('RANGE','Material divisor must be a nonzero numeric literal',literal);
  const reciprocal=zero(1/divisor);
  if(!Number.isFinite(reciprocal)||Math.abs(reciprocal)>1000)fail('RANGE','Material divisor reciprocal exceeds±1000',literal);
  // Lower only to the existing float/multiply IR, charging both generated nodes.
  const right=this.term({kind:'float',type:'float',value:reciprocal},'float',[reciprocal,reciprocal],[],literal),[a,b]=left.range;
  left=this.term({kind:'binary',type:'float',operator:'*',left:left.expression,right:right.expression},'float',[Math.min(a*reciprocal,b*reciprocal),Math.max(a*reciprocal,b*reciprocal)],[left,right],token);
  continue;
 }
 const right=this.expression(precedence+1,nesting+1);this.float(left,token);this.float(right,token);const[a,b]=left.range,[c,d]=right.range;const range: [number,number]=token.text==='+'?[a+c,b+d]:token.text==='-'?[a-d,b-c]:[Math.min(a*c,a*d,b*c,b*d),Math.max(a*c,a*d,b*c,b*d)];left=this.term({kind:'binary',type:'float',operator:token.text as '+'|'-'|'*',left:left.expression,right:right.expression},'float',range,[left,right],token);}return left;}
 parse():ParsedMaterial{
 this.take('@');this.take('shader');const id=this.current();if(!/^#[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(id.text))fail('SYNTAX','Shader ID requires ASCII1..64',id);this.i++;this.take('{');
 while(this.current().text==='@'&&this.list[this.i+1]?.text==='uniform'){
 this.take('@');this.take('uniform');const name=this.current();if(!/^[A-Za-z_][A-Za-z0-9_]{0,31}$/.test(name.text))fail('SYNTAX','Uniform name requires ASCII1..32',name);if(this.inputName(name.text))fail('TYPE','Uniform name shadows reserved UV input',name);if(this.uniforms.some(u=>u.name===name.text))fail('TYPE','Duplicate uniform name',name);this.i++;this.take(':');this.take('float');this.take('(');const min=this.signedNumber();this.take(',');const max=this.signedNumber();this.take(',');const value=this.signedNumber();this.take(')');this.take(';');if(min>max||value<min||value>max)fail('RANGE','Uniform min/default/max are not ordered',name);this.uniforms.push({name:name.text,type:'float',min,max,default:value});if(this.uniforms.length>16)fail('BUDGET','Material exceeds16 uniforms',name);
 }
 while(this.current().text==='@'&&this.list[this.i+1]?.text==='let'){
 this.take('@');this.take('let');const name=this.current();if(!/^[A-Za-z_][A-Za-z0-9_]{0,31}$/.test(name.text))fail('SYNTAX','Local name requires ASCII1..32',name);if(this.inputName(name.text))fail('TYPE','Local name shadows reserved UV input',name);if(this.locals.has(name.text)||this.uniforms.some(u=>u.name===name.text)||['sin','cos','mix','clamp','float','color'].includes(name.text))fail('TYPE','Local name collides with an existing or reserved name',name);if(this.locals.size>=16)fail('BUDGET','Material exceeds16 local declarations',name);this.i++;this.take(':');const type=this.current();if(type.text!=='float'&&type.text!=='color')fail('SYNTAX','Local type requires float or color',type);this.i++;this.take('(');const value=this.expression();this.take(')');this.take(';');if(value.type!==type.text)fail('TYPE','Local expression does not match its declared type',type);this.locals.set(name.text,value);
 }
 this.take('@');this.take('fragment');this.take('{');this.take('color');this.take(':');const expression=this.expression();if(expression.type!=='color')fail('TYPE','Opaque material output requires color',this.current());this.take(';');this.take('}');this.take('}');this.take('<eof>');
 return{source:this.source,shaderId:id.text.slice(1),uniforms:this.uniforms,expression:expression.expression};
 }
}
export function compileMeshMaterial(source:string):{ok:true;material:MeshMaterialIR}|{ok:false;diagnostics:MeshMaterialDiagnostic[]}{
 // Default parser mode cannot resolve input leaves; the legacy public type stays unchanged.
 try{const parsed=parseMaterialSource(source);return{ok:true,material:freeze({format:'barocss-gpu-mesh-material',version:0,profile:'mesh-opaque-fragment-v0',...parsed,expression:parsed.expression as MeshMaterialExpression})};}
 catch(error){const e=error instanceof MeshMaterialError?error:new MeshMaterialError('SYNTAX',error instanceof Error?error.message:'Material compile failed');return{ok:false,diagnostics:[{code:e.code,message:e.message,start:e.start,end:e.end}]};}
}
function parseMaterialSource(source:string,uvInputs=false):ParsedMaterial{
 if(typeof source!=='string')fail('INPUT','Material source must be text');
 if(new TextEncoder().encode(source).length>65536)fail('BUDGET','Material source exceeds64KiB');
 return new Parser(source,tokens(source),uvInputs).parse();
}
export function compileEngineUVMaterial(source:string):{ok:true;material:EngineUVMaterialIR}|{ok:false;diagnostics:MeshMaterialDiagnostic[]}{
 try{return{ok:true,material:freeze({format:'barocss-gpu-engine-uv-material',version:0,profile:'engine-opaque-uv-fragment-v0',...parseMaterialSource(source,true)})};}
 catch(error){const e=error instanceof MeshMaterialError?error:new MeshMaterialError('SYNTAX',error instanceof Error?error.message:'Material compile failed');return{ok:false,diagnostics:[{code:e.code,message:e.message.slice(0,1024),start:e.start,end:e.end}]};}
}
function ownSnapshot(input:unknown):unknown{let budget=8192;const active=new WeakSet<object>();const copy=(v:unknown,depth:number):unknown=>{if(--budget<0||depth>24)fail('BUDGET','Material own-data value/depth limit');if(typeof v==='number'){if(!Number.isFinite(v))fail('INPUT','Material data must be finite');return zero(v);}if(typeof v==='string'){if(v.length>65536)fail('BUDGET','Material string limit');return v;}if(typeof v==='boolean'||v===null)return v;if(!v||typeof v!=='object'||active.has(v))fail('INPUT','Material requires acyclic plain data');const array=Array.isArray(v),proto=Object.getPrototypeOf(v),d=Object.getOwnPropertyDescriptors(v),keys=Reflect.ownKeys(v);if(array?proto!==Array.prototype:proto!==Object.prototype)fail('INPUT','Material foreign prototype');if(keys.length>(array?257:16)||keys.some(k=>typeof k!=='string'||!('value'in d[k])||(!array||k!=='length')&&!d[k].enumerable))fail('INPUT','Material getter/hidden/symbol/excess fields');active.add(v);let out:unknown;if(array){const n=d.length.value;if(!Number.isInteger(n)||n<0||n>256||keys.length!==n+1||Array.from({length:n},(_,i)=>!Object.hasOwn(d,String(i))).some(Boolean))fail('INPUT','Material requires dense bounded arrays');out=Array.from({length:n},(_,i)=>copy(d[String(i)].value,depth+1));}else out=Object.fromEntries((keys as string[]).map(k=>[k,copy(d[k].value,depth+1)]));active.delete(v);return out;};return copy(input,0);}
const canonical=(value:unknown):unknown=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)])):value;
export function validateMeshMaterialIR(input:unknown):MeshMaterialIR{const data=ownSnapshot(input) as Partial<MeshMaterialIR>;if(!data||typeof data!=='object'||typeof data.source!=='string')fail('IR','Material IR source required');const compiled=compileMeshMaterial(data.source);if(!compiled.ok)throw new MeshMaterialError('IR',compiled.diagnostics[0].message);if(JSON.stringify(canonical(data))!==JSON.stringify(canonical(compiled.material)))fail('IR','Material IR does not match its reconstructed source');return compiled.material;}
function uvError(code:MeshMaterialCode,message:string,start=0,end=0,cause?:unknown):MeshMaterialError{
 const error=new MeshMaterialError(code,message.slice(0,1024),start,end);
 if(cause!==undefined)Object.defineProperty(error,'cause',{value:cause,writable:true,configurable:true});
 return error;
}
export function validateEngineUVMaterialIR(input:unknown):EngineUVMaterialIR{
 let data:Partial<EngineUVMaterialIR>;
 try{data=ownSnapshot(input) as Partial<EngineUVMaterialIR>;}
 catch(cause){if(cause instanceof MeshMaterialError)throw cause;throw uvError('INPUT','UV material own-data reflection refused',0,0,cause);}
 if(!data||typeof data!=='object'||typeof data.source!=='string')throw uvError('IR','UV material IR source required');
 const compiled=compileEngineUVMaterial(data.source);
 if(!compiled.ok){const diagnostic=freeze(compiled.diagnostics[0]);throw uvError('IR',diagnostic.message,diagnostic.start,diagnostic.end,diagnostic);}
 if(JSON.stringify(canonical(data))!==JSON.stringify(canonical(compiled.material)))throw uvError('IR','UV material IR does not match its reconstructed source');
 return compiled.material;
}
const glFloat=(n:number)=>n.toPrecision(17);
function lowerMaterial(material:ParsedMaterial):LoweredMeshMaterial{const uniformLayout=material.uniforms.map((u,i)=>({...u,glslName:'mat_u_'+i}));const expression=(e:EngineUVMaterialExpression):string=>{switch(e.kind){case'float':return glFloat(e.value);case'color':return'vec3('+e.linear.map(glFloat).join(',')+')';case'uniform':return uniformLayout.find(u=>u.name===e.name)!.glslName;case'input':return e.name==='uv_u'?'v_engine_uv.x':'v_engine_uv.y';case'unary':return'('+e.operator+expression(e.value)+')';case'binary':return'('+expression(e.left)+e.operator+expression(e.right)+')';case'call':{const args=e.args.map(expression);if(e.name==='mix')args[2]='clamp('+args[2]+',0.0,1.0)';return e.name+'('+args.join(',')+')';}}};return{expression:'clamp('+expression(material.expression)+',vec3(0.0),vec3(1.0))',uniformDeclarations:uniformLayout.map(u=>'uniform float '+u.glslName+';').join('\n'),uniformLayout};}
export function lowerMeshMaterial(input:unknown):LoweredMeshMaterial{return lowerMaterial(validateMeshMaterialIR(input));}
export function lowerEngineUVMaterial(input:unknown):LoweredEngineUVMaterial{
 const result:LoweredEngineUVMaterial={...lowerMaterial(validateEngineUVMaterialIR(input)),inputDeclarations:'in vec2 v_engine_uv;'};
 return freeze(result);
}
/** Internal catalog provider: distinct UV profile; no caller-supplied input values. */
export function validateEngineUVMaterialBinding(input:unknown):EngineUVMaterialBinding{
 let data:Record<string,unknown>;
 try{data=ownSnapshot(input) as Record<string,unknown>;}
 catch(cause){if(cause instanceof MeshMaterialError)throw cause;throw uvError('INPUT','UV material binding own-data reflection refused',0,0,cause);}
 if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).length!==2||!Object.hasOwn(data,'material')||!Object.hasOwn(data,'uniforms'))throw uvError('INPUT','UV material binding requires material/uniforms');
 const material=validateEngineUVMaterialIR(data.material),values=data.uniforms;
 if(!values||typeof values!=='object'||Array.isArray(values))throw uvError('UNIFORM','Uniform values require own record');
 const entries=Object.entries(values);
 if(entries.length>16||entries.some(([name])=>!material.uniforms.some(u=>u.name===name)))throw uvError('UNIFORM','Unknown/excess uniform value');
 const uniforms=Object.fromEntries(material.uniforms.map(u=>{
  const n=Object.hasOwn(values,u.name)?(values as Record<string,unknown>)[u.name]:u.default;
  if(typeof n!=='number'||!Number.isFinite(n)||n<u.min||n>u.max)throw uvError('UNIFORM','Uniform '+u.name+' outside its finite declared range');
  return[u.name,zero(n)];
 }));
 return freeze({material,uniforms});
}
export function validateMeshMaterialBinding(input:unknown):MeshMaterialBinding{
 const data=ownSnapshot(input) as Record<string,unknown>;if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).length!==2||!Object.hasOwn(data,'material')||!Object.hasOwn(data,'uniforms'))fail('INPUT','Material binding requires material/uniforms');const material=validateMeshMaterialIR(data.material),values=data.uniforms;if(!values||typeof values!=='object'||Array.isArray(values))fail('UNIFORM','Uniform values require own record');const entries=Object.entries(values);if(entries.length>16||entries.some(([name])=>!material.uniforms.some(u=>u.name===name)))fail('UNIFORM','Unknown/excess uniform value');const uniforms:Record<string,number>={};for(const u of material.uniforms){const n=Object.hasOwn(values,u.name)?(values as Record<string,unknown>)[u.name]:u.default;if(typeof n!=='number'||!Number.isFinite(n)||n<u.min||n>u.max)fail('UNIFORM','Uniform '+u.name+' outside its finite declared range');uniforms[u.name]=zero(n);}return freeze({material,uniforms});
}

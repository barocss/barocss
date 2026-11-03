// Data-only literal expansion. Author must not execute. No candidate imports.
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const home=dirname(fileURLToPath(import.meta.url));
function gcd(a,b){a=a<0n?-a:a;while(b){const r=a%b;a=b;b=r;}return a;}
export function literal(value){
  if(Array.isArray(value))return value.map(literal);
  if(value&&typeof value==='object'){
    if(Object.keys(value).sort().join(',')==='n,power2'){
      if(!/^-?\d{1,64}$/.test(value.n)||!Number.isInteger(value.power2)||Math.abs(value.power2)>2048)throw new Error('LITERAL_DYADIC_ENCODING');
      let n=BigInt(value.n),d=1n;
      if(value.power2<0)d=1n<<BigInt(-value.power2);else n<<=BigInt(value.power2);
      const g=gcd(n,d);return `${n/g}/${d/g}`;
    }
    return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,literal(v)]));
  }
  return value;
}
export function materializeBank(){
  const bank=JSON.parse(readFileSync(resolve(home,'bank.json'),'utf8'));
  if(bank.cases.length!==52||bank.privateCalls!==52||bank.privateCallCap!==64)throw new Error('LITERAL_BANK_CENSUS');
  const rational=s=>{if(typeof s!=='string'||! /^-?\d+(?:\/\d+)?$/.test(s))throw new Error('LITERAL_RATIONAL_ENCODING');return s.includes('/')?s:s+'/1';};
  const requestOf=request=>{
    const value=literal(request);
    if(value.kind==='polynomial'){value.coefficients=value.coefficients.map(rational);value.normalNumerator=value.normalNumerator.map(rational);}
    else if(value.kind==='multiply'){value.left=value.left.map(rational);value.right=value.right.map(rational);}
    else if(value.kind==='round')value.value=rational(value.value);
    else if(value.kind==='presentation')value.interval=value.interval.map(rational);
    else if(value.kind==='operation'&&value.operation==='parse')value.values=value.values.map(rational);
    return value;
  };
  return {format:'independent-coupled-arithmetic-materialized-bank-01',privateCalls:52,privateCallCap:64,
    cases:bank.cases.map(({id,request})=>({id,request:requestOf(request)}))};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv.length!==3)throw new Error('FRESH_OUTPUT_PATH_REQUIRED');
  writeFileSync(resolve(process.argv[2]),JSON.stringify(materializeBank(),null,2)+'\n',{flag:'wx'});
}

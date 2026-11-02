"""Independent Fraction Gram checks on nine fixed saved helper calls; no candidate import."""
from fractions import Fraction as F
from pathlib import Path
import json,struct,math,sys

def need(x,message):
    if not x:raise ValueError(message)
def words(xs):return [struct.pack('>d',x).hex() for x in xs]
def rational(x):return F(int(x['n']),int(x['d']))
def dot(a,b):return sum((x*y for x,y in zip(a,b)),F(0))
def main(bank,actual):
    rows=[];failure=None;cursor=None;maximum=F(0)
    try:
        need(bank['caseCount']==9 and len(bank['cases'])==9,'Fixed nine-case bank');need(bank['WorldCalls']==0 and bank['candidateCalls']==0,'Independent reference ownership');need(len(actual['cases'])==9 and actual['WorldCalls']==0,'Nine helper-only calls before World')
        for case,got in zip(bank['cases'],actual['cases']):
            cursor=case['id'];need(got['id']==cursor,'Case order');need(got['tangentWords']==case['tangentWords']==words(case['tangentNs']),'Original tangent words');need(got['normalWords']==case['normalWords']==words(case['normal']),'Original normal words');need(got['afterTangentWords']==got['tangentWords'] and got['afterNormalWords']==got['normalWords'],'Helper must preserve caller arrays')
            t,n=([F.from_float(float(v)) for v in case[k]] for k in ['tangentNs','normal']);n2=dot(n,n)
            if n2==0:
                need(case['expected']['status']=='UNRESOLVED' and got['status']=='UNRESOLVED' and got['code']==case['expected']['code']=='WARM_TRANSPORT_UNRESOLVED' and got['typedError'] is True,'Typed zero-normal refusal');rows.append(dict(id=cursor,status='EXECUTED_PASS_TYPED_REFUSAL'));continue
            gram=[v-u*dot(t,n)/n2 for v,u in zip(t,n)];need(case['expected']['status']=='PROJECTED' and gram==[rational(x) for x in case['expected']['tangentExactNs']],'Exact independent Gram bank consistency');need(dot(gram,n)==0 and dot(gram,gram)<=dot(t,t),'Exact reference plane/nonincrease');need(got['status']=='PROJECTED' and len(got['outputNs'])==3 and all(math.isfinite(v) for v in got['outputNs']),'Finite successful candidate output');need(len(got['outputWords'])==3,'Three preserved output words');wireOut=[struct.unpack('>d',bytes.fromhex(w))[0] for w in got['outputWords']];need(all(math.isfinite(v) for v in wireOut) and words(wireOut)==got['outputWords'],'Canonical finite preserved output words');need(all(a==b for a,b in zip(wireOut,got['outputNs'])),'Numeric JSON output matches preserved words (JSON may lose zero sign)');out=[F.from_float(v) for v in wireOut];residual=max(abs(x-y) for x,y in zip(out,gram));plane=abs(dot(out,n));maximum=max(maximum,residual,plane);need(residual<=F(1,10**12) and plane<=F(1,10**12),'Unchanged component/plane 1e-12 gates');rows.append(dict(id=cursor,status='EXECUTED_PASS',gramExactNs=[str(x) for x in gram],maximumComponentErrorNs=float(residual),tangentDotNormalNs=float(plane)))
    except Exception as error:failure=dict(case=cursor,type=type(error).__name__,message=str(error))
    return dict(status='EXECUTED_NO_GO_HELPER_GRAM_BANK' if failure else 'EXECUTED_PASS_HELPER_GRAM_BANK',firstFailure=failure,rows=rows,maximumResidualNs=float(maximum),WorldCalls=0,candidateCalls=0)
if __name__=='__main__':
    result=main(json.loads(Path(sys.argv[1]).read_text()),json.loads(Path(sys.argv[2]).read_text()))
    with Path(sys.argv[3]).open('x') as f:json.dump(result,f,separators=(',',':'));f.write('\n')
    print(json.dumps(dict(status=result['status'],firstFailure=result['firstFailure'])))
    if result['firstFailure']:sys.exit(1)

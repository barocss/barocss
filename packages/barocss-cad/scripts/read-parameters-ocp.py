"""Independent installed OCCT consumer of actual source2-derived original IGES."""
import hashlib
import json
from pathlib import Path
import runpy
import sys

UTIL = Path(__file__).with_name('read-derivatives-ocp.py')
helpers = runpy.run_path(str(UTIL))
require = helpers['require']


def main():
    output = Path(sys.argv[1]).resolve()
    mode = sys.argv[2] if len(sys.argv)>2 else ''
    require(mode in ('','--wrong-scale','--swap-partials','--changed-source-parameter'), 'Unknown parameter consumer mode')
    manifest = json.loads((output/'manifest.json').read_text())
    require(len(manifest['fixtures'])==4,'Four parameterized native/literal controls required')
    results=[]
    for index,original in enumerate(manifest['fixtures']):
        fixture=json.loads(json.dumps(original))
        require(fixture['sourceVersion']==2 and fixture['irSchemaVersion']==2 and fixture['geometryVersion']==0,
                'Source/IR/native version provenance changed')
        # ALL original source/AST/IR/native/packet/export/literal files are retained
        # and hashed before the independent reader loads the actual IGES bytes.
        for key,relative in fixture['files'].items():
            filename=(output/relative).resolve()
            require(filename.is_relative_to(output),'Evidence path escapes output')
            require(hashlib.sha256(filename.read_bytes()).hexdigest()==fixture['hashes'][key],key+' provenance hash mismatch')
        if mode and index==0:
            for sample in fixture['samples']:
                if mode=='--wrong-scale': sample['du']=[x*2 for x in sample['du']]
                elif mode=='--swap-partials': sample['du'],sample['dv']=sample['dv'],sample['du']
                else: sample['du']=[sample['du'][0]+20,sample['du'][1],sample['du'][2]]
                # A wrong expected source derivative must reach actual vector
                # comparison, not fail the prerequisite native analytic oracle.
                sample['analyticDu']=list(sample['du']);sample['analyticDv']=list(sample['dv'])
        # Reuse the existing independent reader, with its own closed-form oracle;
        # source-derived negative vectors are compared AFTER the baseline read.
        if mode and index==0:
            baseline=helpers['read_fixture'](output,original,'')
            actual=baseline['samples'][0]['derivatives']
            expected=[fixture['samples'][0]['du'],fixture['samples'][0]['dv']]
            for value,target in zip(actual,expected):
                absolute,scaled=helpers['vector_error'](value,target)
                require(scaled<=1e-7,'Parameter derivative comparison failed: '+str(absolute)+' mm/parameter')
            raise AssertionError('Parameter negative vector control unexpectedly passed')
        results.append(helpers['read_fixture'](output,fixture,''))
    require(not mode,'Parameter negative mode did not reach comparison')
    report={'base':manifest['base'],'head':manifest['head'],'readerDependencies':{'read-derivatives-ocp.py':hashlib.sha256(UTIL.read_bytes()).hexdigest()},
            'fixtures':results,'sourceVersion':2,'irSchemaVersion':2,'nativeVersion':0,
            'limits':manifest['limits'],'scope':'Actual original IGES128 bytes from resolved source2 compiler output; independent test-only reader.'}
    (output/'parameter-readback.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'fixtures':len(results),'samples':sum(f['sampleCount'] for f in results),'head':report['head']}))


if __name__=='__main__':main()

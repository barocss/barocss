"""D405 bounded controls: OCP load-only truncation and valid reverse geometry mismatch.
No default-healing STEP transfer is performed. Args: output, current importer probe, Node22 executable.
"""
import json
from pathlib import Path
import runpy
import subprocess
import sys

from OCP.STEPControl import STEPControl_Reader
from OCP.IFSelect import IFSelect_RetDone

out=Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=True)
probe=Path(sys.argv[2]);node=sys.argv[3]
h=runpy.run_path(str(Path(__file__).with_name('step-ocp-profile.py')))
truncated=out/'truncated.step'
truncated.write_text("ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('truncated'),'2;1');\n")
reader=STEPControl_Reader()
status=reader.ReadFile(str(truncated))
assert status!=IFSelect_RetDone, str(status)
wrong=out/'valid-wrong-dimensions.step'
producer=h['write_ocp_box'](wrong,[5,-4,2],[12,7,4])
metric=producer['geometryBeforeWrite']
assert metric['valid'] and abs(metric['volume']-336)<=1e-5
comparison=h['compare']({'whole':metric,'solids':[metric]},h['REVERSE'])
assert not comparison['pass']
run=subprocess.run([node,str(probe),str(wrong)],capture_output=True,text=True)
(out/'wrong-import.stdout.txt').write_text(run.stdout)
(out/'wrong-import.stderr.txt').write_text(run.stderr)
assert run.returncode!=0 and 'AssertionError' in run.stderr and '[5,-4,2,17,3,6]' in run.stderr, run.stderr
report={'status':'PASS','truncated':{'detected':True,'loadStatus':str(status),'transfer':'NOT_RUN','healing':'NOT_RUN'},'validWrongDimensions':{'detected':True,'producer':producer,'nativeComparison':comparison,'currentImporterExit':run.returncode,'currentImporterGate':'numeric bounds mismatch [5,-4,2,17,3,6] against [5,-4,2,17,3,5]'},'forwardGeometry':'NOT_RUN_CONTROL_BLOCKED'}
(out/'negative-controls.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report))

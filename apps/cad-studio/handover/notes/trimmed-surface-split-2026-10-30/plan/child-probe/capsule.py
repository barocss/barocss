from pathlib import Path
import hashlib,json,subprocess,sys
r=Path('/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b')
files=sorted([*r.joinpath('packages/barocss-cad/src').rglob('*.ts'),*r.joinpath('packages/barocss-cad/dist').rglob('*.js')])
s={'head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=r,text=True).strip(),'status':subprocess.check_output(['git','status','--short'],cwd=r,text=True),'boundary':'all cad src .ts and existing dist .js, not whole Studio served graph','files':{str(f.relative_to(r)):hashlib.sha256(f.read_bytes()).hexdigest() for f in files}}
Path(sys.argv[1]).write_text(json.dumps(s,indent=2)+'\n')
print(json.dumps({'head':s['head'],'files':len(files),'status':s['status']}))

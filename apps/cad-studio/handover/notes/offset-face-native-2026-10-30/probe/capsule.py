from pathlib import Path
import hashlib,json,subprocess,sys
root=Path('/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b')
files=[]
for folder,pattern in [('packages/barocss-cad/src','*.ts'),('packages/barocss-cad/dist','*.js'),('packages/barocss-cad-model/src','*.ts')]:
    files.extend((root/folder).rglob(pattern))
value={'head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),'files':{str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(files)}}
Path('/tmp/d342-probe/'+sys.argv[1]+'.json').write_text(json.dumps(value,indent=2)+'\n')

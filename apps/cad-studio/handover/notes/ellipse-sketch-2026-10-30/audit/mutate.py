import os, subprocess, sys, json
T='/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20'
S='/private/tmp/claude-501/-Users-user-github-barocss-barocss--claude-worktrees-heuristic-gould-b94e20/de70f387-aaec-4213-a427-f7006e5caab3/scratchpad/auditEll'
E=T+'/packages/barocss-cad-model/src/sketch/ellipse.ts'; C=T+'/packages/barocss-cad-model/src/engine/curveSource.ts'
ST=T+'/packages/barocss-cad-model/src/sketch/settle.ts'; R=T+'/packages/barocss-cad-model/src/sketch/reopen.ts'; L=T+'/packages/barocss-cad-model/src/sketch/loops.ts'
CO=T+'/packages/barocss-cad-model/src/sketch/corner.ts'; EI=T+'/packages/barocss-cad-model/src/sketch/entityIds.ts'
U=T+'/apps/cad-studio/src/sketch/useSketchActions.ts'; DR=T+'/apps/cad-studio/src/viewport/ellipseDraft.ts'; SC=T+'/apps/cad-studio/src/app/sketchControls.ts'
M=[
 ('tangent sign', E, "handles.push(Math.atan2(d.ry * Math.cos(t), -d.rx * Math.sin(t))", "handles.push(Math.atan2(-d.ry * Math.cos(t), d.rx * Math.sin(t))"),
 ('N 96->80', E, "ELLIPSE_POINTS = 96", "ELLIPSE_POINTS = 80"),
 ('N 96->64', E, "ELLIPSE_POINTS = 96", "ELLIPSE_POINTS = 64"),
 ('fit angle radians', E, "const a = d.angle * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), fit", "const a = d.angle, ca = Math.cos(a), sa = Math.sin(a), fit"),
 ('handles drop +angle', E, "* 180 / Math.PI + d.angle);", "* 180 / Math.PI);"),
 ('curve rx/ry swapped', C, "const x = d.rx * q[0], y = d.ry * q[1];", "const x = d.ry * q[0], y = d.rx * q[1];"),
 ('curve angle radians', C, "const unit = circleCurve(xyPlane(), [0, 0], 1), a = d.angle * Math.PI / 180", "const unit = circleCurve(xyPlane(), [0, 0], 1), a = d.angle"),
 ('curve angle sign', C, "d.center[0] + ca * x - sa * y, d.center[1] + sa * x + ca * y]); }) };", "d.center[0] + ca * x + sa * y, d.center[1] - sa * x + ca * y]); }) };"),
 ('curve no centre', C, "return toWorld(plane, [d.center[0] + ca * x - sa * y, d.center[1] + sa * x + ca * y]);", "return toWorld(plane, [ca * x - sa * y, sa * x + ca * y]);"),
 ('matches tol x1e4', E, "return outlineMatches(ellipseOutline(d), s, Math.max(100,", "return outlineMatches(ellipseOutline(d), s, 1e4 * Math.max(100,"),
 ('matches always true', E, "return outlineMatches(ellipseOutline(d), s,", "return true || outlineMatches(ellipseOutline(d), s,"),
 ('settle keeps stale def', ST, "if (out?.kind === 'polygon' && out.ellipse && (drivenOutline(out) || !ellipseMatches(out)))", "if (false && out?.kind === 'polygon' && out.ellipse && (drivenOutline(out) || !ellipseMatches(out)))"),
 ('settle keeps driven def', ST, "out.ellipse && (drivenOutline(out) || !ellipseMatches(out))", "out.ellipse && (!ellipseMatches(out))"),
 ('settle infers tangents', ST, "? base.fromEllipse ? { tangents: [], equalRadii: [], concentric: [] } :", "? false ? { tangents: [], equalRadii: [], concentric: [] } :"),
 ('ratio refusal removed', E, "if (Math.min(d.rx, d.ry) / Math.max(d.rx, d.ry) < ELLIPSE_MIN_RATIO - 1e-9)", "if (false)"),
 ('ratio 0.2->0.1', E, "ELLIPSE_MIN_RATIO = 0.2", "ELLIPSE_MIN_RATIO = 0.1"),
 ('kernel refusal removed', E, "if (splineEditError({ fit, closed: true, handles }))", "if (false)"),
 ('axes>0 refusal removed', E, "if (!(d.rx > 0 && d.ry > 0)) return", "if (false) return"),
 ('reopen skips match', R, "return ellipse && ellipseMatches({ ...poly, ellipse }) ?", "return ellipse ?"),
 ('reopen drops def', R, "return ellipse && ellipseMatches({ ...poly, ellipse }) ?", "return false && ellipse ?"),
 ('wellFormed skips ellipseError', E, "return ellipseError(def) ? null : def;", "return def;"),
 ('outlineOf no match check', L, "ellipse = s.ellipse && ellipseMatches(s) ? s.ellipse : undefined", "ellipse = s.ellipse"),
 ('outlineOf drops def', L, "if (ellipse) out.ellipse =", "if (false) out.ellipse ="),
 ('reellipse keeps constraints', E, "for (const k of ['lengths', 'radii', 'tangents', 'equalRadii', 'concentric', 'rules', 'hv'] as const) delete out[k];", ""),
 ('reellipse drops ids', E, "for (const k of ['lengths', 'radii',", "delete out.ids; for (const k of ['lengths', 'radii',"),
 ('reellipse drops circles', E, "for (const k of ['lengths', 'radii',", "delete out.circles; delete out.circleIds; for (const k of ['lengths', 'radii',"),
 ('shape no fromEllipse', E, "closed: true, fromEllipse: true, ellipse: copyDef(d) };\n}\n\n/** The ellipse polygon regenerated", "closed: true, ellipse: copyDef(d) };\n}\n\n/** The ellipse polygon regenerated"),
 ('corner keeps def', CO, "delete out.fromEllipse; delete out.ellipse;", ""),
 ('carryPolygon keeps def', EI, "delete out.fromEllipse; delete out.ellipse;", ""),
 ('MakeCurves no match check', U, "s.ellipse && s.closed && ellipseMatches(s) ?", "s.ellipse && s.closed ?"),
 ('MakeCurves no ellipse branch', U, "s.ellipse && s.closed && ellipseMatches(s) ?", "false ?"),
 ('draft ry from centre', DR, "const ry = r6(Math.abs((p[0] - d.c[0]) * Math.sin(ax.angle * Math.PI / 180) - (p[1] - d.c[1]) * Math.cos(ax.angle * Math.PI / 180)));", "const ry = r6(Math.hypot(p[0] - d.c[0], p[1] - d.c[1]));"),
 ('draft angle sign', DR, "normalAngle(r6(Math.atan2(a[1] - c[1], a[0] - c[0])", "normalAngle(r6(Math.atan2(c[1] - a[1], a[0] - c[0])"),
 ('tool key I->E', SC, "{ tool: 'ellipse', key: 'I'", "{ tool: 'ellipse', key: 'E'"),
]

CM=T+'/packages/barocss-cad-model/src/app/commands.ts'; EP=T+'/apps/cad-studio/src/ui/ellipsePanel.ts'
M+=[
 ('side: any side refused', E, "if (m[2] !== undefined ? !!outer?.includes(m[2]) : !outer && m[3] !== undefined) return true;", "return true;"),
 ('side: no ellipse check', E, "if (!sk || sk.kind !== 'sketch' || !sk.outline?.ellipse) continue;", "if (!sk || sk.kind !== 'sketch') continue;"),
 ('side: tag not checked', E, "!!outer?.includes(m[2])", "true"),
 ('cmd: refusal helper null', CM, "return edges.some(e => e.names.some(n => ellipseSideEdge(ctx.doc.nodes, n))) ? ELLIPSE_SIDE_EDGE_REFUSAL : null;", "return null;"),
 ('ALL cmd: available unchecked', CM, "const why = ellipseSideRefusal(ctx, sel.edges); return why ? no(why) : ok;", "return ok;"),
 ('ALL cmd: build unchecked', CM, "why = ellipseSideRefusal(ctx, edges); if (why) throw refusal('VALUE', why);", "why = null;"),
 ('normalAngle identity', E, "const r = ((a % 360) + 360) % 360; return r === 0 ? 0 : r;", "return a;"),
 ('angle 1e6 refusal removed', E, "if (Math.abs(d.angle) > 1e6) return 'The angle is not a usable number.';", ""),
 ('panel apply no refusal', EP, "onError(why);\n  if (!why) onShape(reellipse(s, def));", "onError(null);\n  onShape(reellipse(s, def));"),
 ('panel rows unfiltered', EP, "rows.filter(r => r.label !== 'Arc')", "rows"),
]

CF=T+'/packages/barocss-cad-model/src/chat/features.ts'
M+=[
 ('id lookup by index', E, "nodes.find((n, i) => (n.id ?? `n${i}`) === m[1])", "nodes[Number(m[1].slice(1))]"),
 ('id lookup ignores id', E, "(n.id ?? `n${i}`) === m[1]", "`n${i}` === m[1]"),
 ('#k suffix dropped', E, "(?:#\\d+)?$/", "$/"),
 ('.s infix dropped', E, "(?:\\.s\\d+)?\\.side", "\\.side"),
 ('chat check removed', CF, "if ((kind === 'fillet' || kind === 'chamfer') && (node.edges as string[]).some(e => ellipseSideEdge(nodes, e)))", "if (false)"),
 ('sketch index via id', E, "const sk = nodes[feature.sketch];", "const sk = nodes.find(n => n.id === `n${feature.sketch}`);"),
]
MT=T+'/packages/barocss-cad-model/test/sketch-ellipse.test.ts'; STT=T+'/apps/cad-studio/test/sketch-ellipse-studio.test.ts'
only = sys.argv[1:]
res=[]
for i,(name,f,old,new) in enumerate(M):
  if only and str(i) not in only: continue
  src=open(f).read(); n=src.count(old); allm=name.startswith('ALL')
  if n<1 or (n!=1 and not allm): res.append((name,'BAD-ANCHOR %d'%n)); print(name,'BAD-ANCHOR',n,flush=True); continue
  mp=f'{S}/mut/m{i}_'+os.path.basename(f); open(mp,'w').write(src.replace(old,new) if allm else src.replace(old,new,1))
  env=dict(os.environ, SWAPS=f'{f}={mp}')
  out={}
  for tag,tf,dn in (('model',MT,None),('side',T+'/packages/barocss-cad-model/test/sketch-ellipse-side.test.ts',None),('studio',STT,T+'/apps/cad-studio/test')):
    e=dict(env); 
    if dn: e['DIRNAME']=dn
    p=subprocess.run(['node',S+'/run.mjs',tf,'--test'],env=e,capture_output=True,text=True,timeout=900)
    txt=p.stdout+p.stderr
    import re
    fails=re.findall(r'^# fail (\d+)',txt,re.M); out[tag]=('fail='+fails[-1]) if fails else ('rc=%d'%p.returncode + ' ' + txt[-200:].replace('\n',' '))
  killed = any(v!='fail=0' for v in out.values())
  res.append((name,('KILLED' if killed else 'SURVIVED')+' '+json.dumps(out)))
  print(i,name,res[-1][1],flush=True)

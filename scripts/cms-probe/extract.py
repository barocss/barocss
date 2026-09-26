# #253: raw/<model>-<block>.json -> blocks/<model>-<block>.html (first ```html fence, else whole reply). Prints total cost.
import json, re, glob, os
O = os.path.dirname(os.path.abspath(__file__)); cost = 0
for f in sorted(glob.glob(O + '/raw/*.json')):
    d = json.load(open(f)); cost += d.get('total_cost_usd', 0); t = d.get('result', '')
    m = re.search(r'```(?:html)?\s*\n(.*?)```', t, re.S)
    open(O + '/blocks/' + os.path.basename(f)[:-5] + '.html', 'w').write((m.group(1) if m else t).strip() + '\n')
print('cost_usd', round(cost, 4))

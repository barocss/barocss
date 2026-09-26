#!/bin/bash
# usage: [T=<dir>] [V=<barocss version>] agent-run.sh <name> <model> <budget>   (#282 used cms282/0.6.0, #289 cms289/0.7.0)
T=${T:-/private/tmp/claude-501/cms289}; V=${V:-0.7.0}
N=$1; M=$2; BUD=$3
rm -rf $T/$N && cp -R $T/starter $T/$N && rm -rf $T/$N/dist
cd $T/$N
TASK="CMS content on this site contains Tailwind utility classes that the production build doesn't include, so they render unstyled. Make them render correctly on the server-rendered pages, including on first paint, using BaroCSS (npm packages @barocss/kit, @barocss/browser, @barocss/server, version $V; docs at https://barocss.com and in the package READMEs). Don't change the content."
start=$(date +%s)
env -u CLAUDECODE npm_config_cache=/private/tmp/claude-501/npm-cache claude -p "$TASK" --model $M --permission-mode acceptEdits \
  --max-budget-usd $BUD --strict-mcp-config \
  --allowedTools "Read" "Edit" "Write" "Glob" "Grep" "WebFetch" "Bash(npm:*)" "Bash(npx:*)" "Bash(node:*)" "Bash(ls:*)" "Bash(cat:*)" "Bash(grep:*)" "Bash(find:*)" "Bash(head:*)" "Bash(tail:*)" "Bash(sed:*)" "Bash(curl:*)" "Bash(git diff:*)" "Bash(git status:*)" \
  --output-format json > $T/$N.json 2> $T/$N.err
echo "wall=$(( $(date +%s) - start ))" >> $T/$N.err

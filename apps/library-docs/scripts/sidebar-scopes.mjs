/** Static navigation contract; the canonical page/lane inventory stays separate. */
export function sidebarScopeProblems(inventory, sections, byRoute) {
  const problems = [], seen = new Set();
  const selected = path => Object.keys(byRoute)
    .sort((a, b) => b.split('/').length - a.split('/').length)
    .find(prefix => path.startsWith(prefix));
  const visit = (item, check) => { if (item.link) check(item.link); for (const child of item.items ?? []) visit(child, check); };
  const owners = new Map();
  for (const group of inventory) visit(group, link => {
    if (owners.has(link)) problems.push(`navigation: duplicate canonical link ${link}`);
    owners.set(link, group);
    if (link.startsWith('/how/') && link !== '/how/') {
      const items = byRoute[link];
      if (items?.length !== 1 || items[0] !== group) problems.push(`navigation: explicit topic owner missing for ${link}`);
    }
  });
  for (const section of sections) {
    const group = inventory.find(item => item.text === section.group);
    if (!group) { problems.push(`navigation: missing canonical group ${section.group}`); continue; }
    for (const prefix of section.prefixes) {
      if (!prefix.startsWith('/') || seen.has(prefix)) problems.push(`navigation: invalid or duplicate prefix ${prefix}`);
      seen.add(prefix);
      const items = byRoute[prefix];
      if (items?.length !== 1 || items[0] !== group) problems.push(`navigation: ${prefix} must show only ${section.group}`);
    }
    const paths = [section.link];
    visit(group, link => paths.push(link.split('#')[0]));
    for (const path of paths) {
      const active = sections.filter(candidate => {
        try { return typeof candidate.activeMatch === 'string' && new RegExp(candidate.activeMatch).test(path); }
        catch { return false; }
      });
      if (active.length !== 1 || active[0] !== section) problems.push(`navigation: ${path} must activate only ${section.text}`);
      const prefix = selected(path), items = prefix === undefined ? undefined : byRoute[prefix];
      if (items?.length !== 1 || items[0] !== group) problems.push(`navigation: ${path} leaves ${section.group}`);
    }
  }
  for (const prefix of Object.keys(byRoute)) if (!seen.has(prefix)) problems.push(`navigation: undeclared prefix ${prefix}`);
  for (const item of inventory) if (!sections.some(section => section.group === item.text)) problems.push(`navigation: unowned canonical group ${item.text}`);
  return problems;
}

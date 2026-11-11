export const modelGroupNames = ['Shapes', 'Create', 'Modify', 'Pattern', 'Combine', 'Inspect'];

export function modelRail(page) {
  return page.getByRole('navigation', { name: 'Tools', exact: true });
}

export async function openModelGroup(page, name) {
  const rail = modelRail(page);
  const toggle = rail.getByRole('button', { name, exact: true });
  if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
  const group = rail.getByRole('group', { name, exact: true });
  await group.waitFor();
  return group;
}

export async function clickModelCommand(page, group, name) {
  const tools = await openModelGroup(page, group);
  await tools.getByRole('button', { name, exact: true }).click();
}

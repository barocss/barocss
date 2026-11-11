// Leave Browser button focus without changing the current CAD selection.
export async function pressWorkspaceSpace(page) {
  await page.locator('.outliner button:focus').evaluateAll(buttons => {
    for (const button of buttons) button.blur();
  });
  await page.keyboard.press('Space');
}

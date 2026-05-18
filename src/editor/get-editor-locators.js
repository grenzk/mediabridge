/**
 * @param {import('playwright').Locator} articlePage
 */
export function getEditorLocators(articlePage) {
  return {
    sourceEditor: articlePage.getByRole('textbox', { name: 'Editor' }),

    editorBody: articlePage
      .frameLocator('iframe')
      .locator('body[contenteditable="true"]'),

    sourceButton: articlePage.locator('a[title="Source"]'),
  }
}

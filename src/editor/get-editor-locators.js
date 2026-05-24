/**
 * @param {import('playwright').Page} articlePage
 * @returns {{
 *   sourceEditor: import('playwright').Locator,
 *   editorBody: import('playwright').Locator,
 *   sourceButton: import('playwright').Locator,
 * }}
 */
export function getEditorLocators(articlePage) {
  return {
    sourceEditor: articlePage.getByRole('textbox', { name: 'Editor' }),

    editorBody: articlePage
      .frameLocator('iframe[title^="Editor"]')
      .locator('body[contenteditable="true"]'),

    sourceButton: articlePage.locator('a[title="Source"]'),
  }
}

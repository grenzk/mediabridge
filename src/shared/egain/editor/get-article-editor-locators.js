/**
 * Returns the shared controls exposed by the eGain article editor.
 *
 * @param {import('playwright').Page} articlePage
 * @returns {{
 *   sourceEditor: import('playwright').Locator,
 *   editorBody: import('playwright').Locator,
 *   sourceButton: import('playwright').Locator,
 *   linkArticleButton: import('playwright').Locator,
 *   selectLinkArticleModal: import('playwright').Locator,
 * }}
 */
export function getArticleEditorLocators(articlePage) {
  return {
    sourceEditor: articlePage.getByRole('textbox', { name: 'Editor' }),

    editorBody: articlePage.frameLocator('iframe[title^="Editor"]').locator('body[contenteditable="true"]'),

    sourceButton: articlePage.locator('a[title="Source"]'),

    linkArticleButton: articlePage.locator('.cke_button__linkarticle_icon'),

    selectLinkArticleModal: articlePage.locator('div[data-testid="pop-up-window-select-link-article"]'),
  }
}

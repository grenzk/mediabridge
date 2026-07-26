import type { Locator, Page } from 'playwright'

export type ArticleEditorLocators = {
  sourceEditor: Locator
  editorBody: Locator
  sourceButton: Locator
  linkArticleButton: Locator
  selectLinkArticleModal: Locator
}

/**
 * Returns the shared controls exposed by the eGain article editor.
 */
export function getArticleEditorLocators(articlePage: Page): ArticleEditorLocators {
  return {
    sourceEditor: articlePage.getByRole('textbox', { name: 'Editor' }),

    editorBody: articlePage.frameLocator('iframe[title^="Editor"]').locator('body[contenteditable="true"]'),

    sourceButton: articlePage.locator('a[title="Source"]'),

    linkArticleButton: articlePage.locator('.cke_button__linkarticle_icon'),

    selectLinkArticleModal: articlePage.locator('div[data-testid="pop-up-window-select-link-article"]'),
  }
}

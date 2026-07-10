/**
 * @typedef {import('./linking-modes.js').LinkingMode} LinkingMode
 * @typedef {{
 *   articleId?: string,
 *   displayName?: string,
 *   filename: string,
 * }} ArticleEditorTarget
 * @typedef {{
 *   linkArticleButton: import('playwright').Locator,
 *   selectLinkArticleModal: import('playwright').Locator,
 * }} ArticleDialogLocators
 */

/**
 * Opens the matching media server target and inserts it into the article editor.
 * Missing filenames are skipped instead of failing the whole run.
 *
 * @param {import('playwright').Page} mediaPage
 * @param {ArticleEditorTarget} target
 * @param {LinkingMode} linkingMode
 * @returns {Promise<boolean>} true when the media server target was inserted.
 */
export async function insertMediaLink(mediaPage, target, linkingMode) {
  const file = mediaPage.locator('div.p-3').filter({ hasText: target.filename }).first()

  if ((await file.count()) === 0) {
    return false
  }

  await file.locator('.lucide-ellipsis-vertical').click()
  await mediaPage.getByText(getInsertActionLabel(linkingMode)).click()

  if (linkingMode.targetType !== 'image') {
    await mediaPage.getByPlaceholder('Enter display name').fill(target.displayName)
    await mediaPage.getByText('Insert').click()
  }

  return true
}

/**
 * Uses the eGain article-link dialog to resolve the selected editor anchor by
 * article ID. Missing search results are skipped so the run can continue.
 *
 * @param {import('playwright').Page} articlePage
 * @param {ArticleEditorTarget} target
 * @param {ArticleDialogLocators} editorLocators
 * @returns {Promise<boolean>} true when the article was linked.
 */
export async function insertArticleLink(articlePage, target, editorLocators) {
  const { linkArticleButton, selectLinkArticleModal } = editorLocators

  await linkArticleButton.click()
  await articlePage.waitForTimeout(500)
  await selectLinkArticleModal.locator('.btn-dropdown').click()
  await selectLinkArticleModal
    .getByText('Article ID', {
      exact: true,
    })
    .click()

  await selectLinkArticleModal.locator('.css-1uw98w5 input').fill(target.articleId)
  await articlePage.keyboard.press('Enter')

  const result = selectLinkArticleModal.getByText(target.articleId, { exact: true })

  try {
    await result.waitFor({ state: 'visible', timeout: 10000 })
  } catch {
    await selectLinkArticleModal.getByText('Cancel').click()

    return false
  }

  await result.click()
  await selectLinkArticleModal.getByText('OK', { exact: true }).click()

  return true
}

/**
 * @param {LinkingMode} linkingMode
 * @returns {string}
 */
function getInsertActionLabel(linkingMode) {
  return linkingMode.targetType === 'image' ? 'Insert as inline image' : 'Insert as link'
}

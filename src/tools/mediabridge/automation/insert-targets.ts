import type { Page } from 'playwright'
import type { ArticleEditorLocators } from '../../../shared/egain/editor/get-article-editor-locators.ts'
import type { ArticleEditorTarget, LinkingMode } from '../types.ts'

/**
 * Opens the matching media server target and inserts it into the article editor.
 * Missing filenames are skipped instead of failing the whole run.
 *
 * @returns true when the media server target was inserted.
 */
export async function insertMediaLink(
  mediaPage: Page,
  target: ArticleEditorTarget,
  linkingMode: LinkingMode,
): Promise<boolean> {
  const file = mediaPage.locator('div.p-3').filter({ hasText: target.filename }).first()

  if ((await file.count()) === 0) {
    return false
  }

  await file.locator('.lucide-ellipsis-vertical').click()
  await mediaPage.getByText(getInsertActionLabel(linkingMode)).click()

  if (linkingMode.targetType !== 'image') {
    if (!target.displayName) {
      throw new Error(`Could not prepare a display name for ${target.filename}.`)
    }

    await mediaPage.getByPlaceholder('Enter display name').fill(target.displayName)
    await mediaPage.getByText('Insert').click()
  }

  return true
}

/**
 * Uses the eGain article-link dialog to resolve the selected editor anchor by
 * article ID. Missing search results are skipped so the run can continue.
 *
 * @returns true when the article was linked.
 */
export async function insertArticleLink(
  articlePage: Page,
  target: ArticleEditorTarget,
  editorLocators: ArticleEditorLocators,
): Promise<boolean> {
  const { linkArticleButton, selectLinkArticleModal } = editorLocators

  if (!target.articleId) {
    return false
  }

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

function getInsertActionLabel(linkingMode: LinkingMode) {
  return linkingMode.targetType === 'image' ? 'Insert as inline image' : 'Insert as link'
}

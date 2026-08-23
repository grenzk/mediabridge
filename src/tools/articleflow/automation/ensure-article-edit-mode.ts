import type { Page } from 'playwright'
import { throwIfAutomationCancelled } from '../../../shared/automation/cancellation.ts'
import { getArticlePageActionLocators } from '../../../shared/egain/editor/get-article-editor-locators.ts'

const articleEditPollIntervalMs = 100
const articleEditTimeoutMs = 120000

/**
 * Waits for an article to finish loading and enters edit mode when needed.
 * eGain can briefly render neither Edit nor Save while changing articles.
 */
export async function ensureArticleEditMode(
  articlePage: Page,
  signal?: AbortSignal,
  timeoutMs = articleEditTimeoutMs,
): Promise<void> {
  const { editArticleButton, saveArticleButton } = getArticlePageActionLocators(articlePage)
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    throwIfAutomationCancelled(signal)

    if (await saveArticleButton.isVisible()) {
      return
    }

    if (await editArticleButton.isVisible()) {
      await editArticleButton.click()
    }

    await articlePage.waitForTimeout(articleEditPollIntervalMs)
  }

  throw new Error('eGain did not make the article available for editing.')
}

import type { Page } from 'playwright'
import { throwIfAutomationCancelled } from '../../../shared/automation/cancellation.ts'
import { getArticleEditorLocators } from '../../../shared/egain/editor/get-article-editor-locators.ts'

const sourceEditorTimeoutMs = 30000
const sourceEditorPollIntervalMs = 100
const sourceEditorSnapshotTimeoutMs = 500
const sourceButtonTimeoutMs = 10000

type ReadArticleSourceOptions = {
  restorePreview?: boolean
  signal?: AbortSignal
}

/**
 * Opens CKEditor source mode when necessary and reads its HTML through short,
 * cancellation-aware polls. Counting can restore the original preview mode;
 * linking keeps source mode open until it starts processing targets.
 */
export async function readArticleSourceHtml(
  articlePage: Page,
  options: ReadArticleSourceOptions = {},
): Promise<string> {
  const { restorePreview = false, signal } = options
  const { sourceButton, sourceEditor } = getArticleEditorLocators(articlePage)
  let openedSourceMode = false

  try {
    throwIfAutomationCancelled(signal)

    if (!(await sourceEditor.isVisible())) {
      await sourceButton.click({ timeout: sourceButtonTimeoutMs })
      openedSourceMode = true
    }

    const deadline = Date.now() + sourceEditorTimeoutMs

    while (Date.now() < deadline) {
      throwIfAutomationCancelled(signal)

      if (await sourceEditor.isVisible()) {
        try {
          return await sourceEditor.inputValue({ timeout: sourceEditorSnapshotTimeoutMs })
        } catch {
          throwIfAutomationCancelled(signal)
        }
      }

      await articlePage.waitForTimeout(sourceEditorPollIntervalMs)
    }

    throw new Error('CKEditor source mode did not become available.')
  } finally {
    if (openedSourceMode && restorePreview) {
      await sourceButton.click({ timeout: sourceButtonTimeoutMs })
    }
  }
}

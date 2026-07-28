import { readFile } from 'node:fs/promises'
import type { Locator, Page } from 'playwright'
import {
  getArticleEditorLocators,
  getArticlePageActionLocators,
  getNewArticleDialogLocators,
} from '../../../shared/egain/editor/get-article-editor-locators.ts'
import type { ArticleImportEntry, ArticleImportPlan } from './create-import-plan.ts'
import { ensureFolderPath, getSelectedFolderReference, selectFolderPath } from './ensure-folder-path.ts'

const editorSyncTimeoutMs = 10000
const editorSyncPollIntervalMs = 100
const saveSettleDelayMs = 1000

export type ArticleCompletionAction = 'check-in' | 'publish'

export type ArticleImportFailure = {
  article: ArticleImportEntry
  message: string
}

export type ArticleImportResult = {
  completedArticles: ArticleImportEntry[]
  createdFolderPaths: string[][]
  existingFolderPaths: string[][]
  failedArticles: ArticleImportFailure[]
}

/**
 * Recreates the planned folder hierarchy under the currently selected eGain
 * folder, then creates each article sequentially. Individual article failures
 * are recorded and do not end the batch.
 */
export async function runArticleImport(
  articlePage: Page,
  plan: ArticleImportPlan,
  completionAction: ArticleCompletionAction,
): Promise<ArticleImportResult> {
  const importParent = await getSelectedFolderReference(articlePage)
  const completedArticles: ArticleImportEntry[] = []
  const createdFolderPaths: string[][] = []
  const existingFolderPaths: string[][] = []
  const failedArticles: ArticleImportFailure[] = []

  for (const folderPath of plan.folderPaths) {
    const createdFinalFolder = await ensureFolderPath(articlePage, importParent, folderPath)

    if (createdFinalFolder) {
      createdFolderPaths.push(folderPath)
    } else {
      existingFolderPaths.push(folderPath)
    }
  }

  for (const article of plan.articles) {
    try {
      await selectFolderPath(articlePage, importParent, article.folderPath)
      await createArticle(articlePage, article, completionAction)
      completedArticles.push(article)
    } catch (error) {
      failedArticles.push({
        article,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return { completedArticles, createdFolderPaths, existingFolderPaths, failedArticles }
}

async function createArticle(
  articlePage: Page,
  article: ArticleImportEntry,
  completionAction: ArticleCompletionAction,
) {
  const html = await readFile(article.sourcePath, 'utf8')
  const destinationFolderName = article.folderPath.at(-1)

  if (!html.trim()) {
    throw new Error(`The source file is empty: ${article.relativeSourcePath}`)
  }

  if (!destinationFolderName) {
    throw new Error(`The article has no destination folder: ${article.relativeSourcePath}`)
  }

  const { createArticleButton, saveArticleButton, checkInArticleButton, publishArticleButton } =
    getArticlePageActionLocators(articlePage)
  const { articleTitleInput, editorBody, sourceButton, sourceEditor } = getArticleEditorLocators(articlePage)
  const { dialog, doneButton, folderPathInput, titleInput } = getNewArticleDialogLocators(articlePage)

  await requireUniqueLocator(createArticleButton, 'Create article button')
  await createArticleButton.click()

  await requireUniqueLocator(dialog, 'New Article dialog')
  await requireUniqueLocator(folderPathInput, 'New Article folder path')

  const selectedFolderName = await folderPathInput.inputValue()

  if (selectedFolderName !== destinationFolderName) {
    throw new Error(
      `Expected the New Article folder to be "${destinationFolderName}", but found "${selectedFolderName || 'none'}".`,
    )
  }

  await requireUniqueLocator(titleInput, 'New Article title input')
  await titleInput.fill(article.title)

  await requireUniqueLocator(doneButton, 'New Article Done button')
  await doneButton.click()
  await dialog.waitFor({ state: 'hidden' })

  await requireUniqueLocator(articleTitleInput, 'article title input')
  await waitForInputValue(articlePage, articleTitleInput, article.title, 'created article title')

  await requireUniqueLocator(sourceButton, 'Source button')
  await sourceButton.click()
  await requireUniqueLocator(sourceEditor, 'source editor')
  await setSourceEditorHtml(sourceEditor, html)
  await verifySourceEditorHtml(sourceEditor, html)
  await sourceButton.click()
  await sourceEditor.waitFor({ state: 'hidden' })
  await editorBody.waitFor({ state: 'visible' })
  await waitForEditorContent(articlePage, editorBody, html)

  await requireUniqueLocator(saveArticleButton, 'Save button')
  await saveArticleButton.click()
  await articlePage.waitForTimeout(saveSettleDelayMs)

  const completionButton = completionAction === 'publish' ? publishArticleButton : checkInArticleButton
  const completionLabel = completionAction === 'publish' ? 'Publish button' : 'Check-In button'

  await requireUniqueLocator(completionButton, completionLabel)
  await completionButton.click()
}

async function requireUniqueLocator(locator: Locator, description: string) {
  let matchCount = await locator.count()

  if (matchCount === 0) {
    await locator.waitFor({ state: 'visible' })
    matchCount = await locator.count()
  }

  if (matchCount !== 1) {
    throw new Error(`Expected one ${description}, but found ${matchCount}.`)
  }
}

async function setSourceEditorHtml(sourceEditor: Locator, html: string) {
  await sourceEditor.evaluate((element, nextHtml) => {
    const sourceTextArea = element as HTMLTextAreaElement

    sourceTextArea.value = nextHtml
    sourceTextArea.dispatchEvent(new Event('input', { bubbles: true }))
    sourceTextArea.dispatchEvent(new Event('change', { bubbles: true }))
  }, html)
}

async function verifySourceEditorHtml(sourceEditor: Locator, expectedHtml: string) {
  const sourceHtml = await sourceEditor.inputValue()

  if (sourceHtml !== expectedHtml) {
    throw new Error('CKEditor did not receive the complete source HTML.')
  }
}

async function waitForInputValue(articlePage: Page, input: Locator, expectedValue: string, description: string) {
  const deadline = Date.now() + editorSyncTimeoutMs
  let actualValue = ''

  while (Date.now() < deadline) {
    actualValue = await input.inputValue()

    if (actualValue === expectedValue) {
      return
    }

    await articlePage.waitForTimeout(editorSyncPollIntervalMs)
  }

  throw new Error(`Expected the ${description} to be "${expectedValue}", but found "${actualValue}".`)
}

async function waitForEditorContent(articlePage: Page, editorBody: Locator, expectedHtml: string) {
  const deadline = Date.now() + editorSyncTimeoutMs

  while (Date.now() < deadline) {
    const editorIsSynchronized = await editorBody.evaluate((element, html) => {
      const template = element.ownerDocument.createElement('template')
      const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim()

      template.innerHTML = html
      template.content.querySelectorAll('script, style').forEach(ignoredElement => ignoredElement.remove())

      const expectedText = normalizeText(template.content.textContent ?? '')
      const actualText = normalizeText(element.textContent ?? '')

      if (expectedText) {
        return actualText.includes(expectedText.slice(0, 120))
      }

      return element.innerHTML.trim().length > 0
    }, expectedHtml)

    if (editorIsSynchronized) {
      return
    }

    await articlePage.waitForTimeout(editorSyncPollIntervalMs)
  }

  throw new Error('CKEditor did not display the inserted article content before saving.')
}

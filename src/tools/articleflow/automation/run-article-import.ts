import { readFile } from 'node:fs/promises'
import type { Locator, Page } from 'playwright'
import {
  getArticleEditorLocators,
  getArticlePageActionLocators,
  getNewArticleDialogLocators,
  getPublishSummaryDialogLocators,
} from '../../../shared/egain/editor/get-article-editor-locators.ts'
import { collectExistingArticleTitles } from './collect-existing-article-titles.ts'
import type { ArticleImportEntry, ArticleImportPlan } from './create-import-plan.ts'
import { ensureFolderPath, getSelectedFolderReference, selectFolderPath } from './ensure-folder-path.ts'

const editorSyncTimeoutMs = 10000
const editorSyncPollIntervalMs = 100
const articleCompletionTimeoutMs = 60000
const articleCompletionSettleDelayMs = 5000
const newArticleDialogSubmitAttempts = 3
const newArticleDialogSubmitTimeoutMs = 10000
const saveSettleDelayMs = 1000

export type ArticleCompletionAction = 'check-in' | 'publish'

export type ArticleImportFailure = {
  article: ArticleImportEntry
  message: string
}

export type ArticleImportResult = {
  createdArticles: ArticleImportEntry[]
  createdFolderPaths: string[][]
  existingArticles: ArticleImportEntry[]
  existingFolderPaths: string[][]
  failedArticles: ArticleImportFailure[]
}

export type ArticleImportProgress =
  | {
      article: ArticleImportEntry
      status: 'created' | 'existing' | 'started'
      type: 'article'
    }
  | {
      article: ArticleImportEntry
      message: string
      status: 'failed'
      type: 'article'
    }
  | {
      folderPath: string[]
      status: 'created' | 'existing'
      type: 'folder'
    }

export type ArticleImportOptions = {
  onProgress?: (progress: ArticleImportProgress) => void
}

/**
 * Recreates the planned folder hierarchy under the currently selected eGain
 * folder, then creates each missing article sequentially. Existing exact-title
 * matches are skipped, and individual article failures do not end the batch.
 */
export async function runArticleImport(
  articlePage: Page,
  plan: ArticleImportPlan,
  completionAction: ArticleCompletionAction,
  options: ArticleImportOptions = {},
): Promise<ArticleImportResult> {
  const importParent = await getSelectedFolderReference(articlePage)
  const createdArticles: ArticleImportEntry[] = []
  const createdFolderPaths: string[][] = []
  const existingArticles: ArticleImportEntry[] = []
  const existingFolderPaths: string[][] = []
  const failedArticles: ArticleImportFailure[] = []
  const existingTitlesByFolder = new Map<string, Set<string>>()

  for (const folderPath of plan.folderPaths) {
    const createdFinalFolder = await ensureFolderPath(articlePage, importParent, folderPath)

    if (createdFinalFolder) {
      createdFolderPaths.push(folderPath)
      options.onProgress?.({ folderPath, status: 'created', type: 'folder' })
    } else {
      existingFolderPaths.push(folderPath)
      options.onProgress?.({ folderPath, status: 'existing', type: 'folder' })
    }
  }

  for (const article of plan.articles) {
    try {
      await selectFolderPath(articlePage, importParent, article.folderPath)

      const folderKey = JSON.stringify(article.folderPath)
      let existingTitles = existingTitlesByFolder.get(folderKey)

      if (!existingTitles) {
        existingTitles = await collectExistingArticleTitles(articlePage)
        existingTitlesByFolder.set(folderKey, existingTitles)
      }

      if (existingTitles.has(article.title)) {
        existingArticles.push(article)
        options.onProgress?.({ article, status: 'existing', type: 'article' })
        continue
      }

      options.onProgress?.({ article, status: 'started', type: 'article' })
      await createArticle(articlePage, article, completionAction)
      existingTitles.add(article.title)
      createdArticles.push(article)
      options.onProgress?.({ article, status: 'created', type: 'article' })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      failedArticles.push({
        article,
        message,
      })
      options.onProgress?.({ article, message, status: 'failed', type: 'article' })
    }
  }

  return { createdArticles, createdFolderPaths, existingArticles, existingFolderPaths, failedArticles }
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
  await submitNewArticleDialog(articlePage, dialog, doneButton)

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
  await waitForEditorPreview(articlePage, editorBody)

  await requireUniqueLocator(saveArticleButton, 'Save button')
  await saveArticleButton.click()
  await articlePage.waitForTimeout(saveSettleDelayMs)

  const completionButton = completionAction === 'publish' ? publishArticleButton : checkInArticleButton
  const completionLabel = completionAction === 'publish' ? 'Publish button' : 'Check-In button'

  await requireUniqueLocator(completionButton, completionLabel)
  await completionButton.click()

  if (completionAction === 'publish') {
    const { dialog: publishDialog, doneButton: publishDoneButton } = getPublishSummaryDialogLocators(articlePage)

    await requireUniqueLocator(publishDialog, 'Publish summary dialog')
    await requireUniqueLocator(publishDoneButton, 'Publish summary Done button')
    await publishDoneButton.click()
    await publishDialog.waitFor({ state: 'hidden' })
  }

  await waitForArticleCompletion(articlePage, completionButton)
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

async function submitNewArticleDialog(articlePage: Page, dialog: Locator, doneButton: Locator) {
  const duplicateConflict = articlePage.getByText('Conflicts Article with same name already exists.', { exact: true })

  for (let attempt = 1; attempt <= newArticleDialogSubmitAttempts; attempt += 1) {
    await doneButton.click()

    try {
      await dialog.waitFor({ state: 'hidden', timeout: newArticleDialogSubmitTimeoutMs })
      return
    } catch {
      if (await duplicateConflict.isVisible()) {
        throw new Error('eGain rejected the article because an article with the same title already exists.')
      }

      if (attempt === newArticleDialogSubmitAttempts) {
        throw new Error(`eGain did not close the New Article dialog after ${newArticleDialogSubmitAttempts} attempts.`)
      }
    }
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

  if (normalizeHtmlLineEndings(sourceHtml) !== normalizeHtmlLineEndings(expectedHtml)) {
    throw new Error('CKEditor did not receive the complete source HTML.')
  }
}

export function normalizeHtmlLineEndings(value: string): string {
  return value.replace(/\r\n?/g, '\n')
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

async function waitForEditorPreview(articlePage: Page, editorBody: Locator) {
  const deadline = Date.now() + editorSyncTimeoutMs

  while (Date.now() < deadline) {
    const editorIsReady = hasRenderedEditorContent(await editorBody.innerHTML())

    if (editorIsReady) {
      return
    }

    await articlePage.waitForTimeout(editorSyncPollIntervalMs)
  }

  throw new Error('CKEditor did not render the inserted article content before saving.')
}

export function hasRenderedEditorContent(editorHtml: string): boolean {
  return editorHtml.trim().length > 0
}

async function waitForArticleCompletion(articlePage: Page, completionButton: Locator) {
  await completionButton.waitFor({ state: 'hidden', timeout: articleCompletionTimeoutMs })
  await articlePage.waitForTimeout(articleCompletionSettleDelayMs)
}

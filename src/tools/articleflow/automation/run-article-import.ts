import { readFile } from 'node:fs/promises'
import type { Locator, Page } from 'playwright'
import {
  getArticleEditorLocators,
  getArticleFolderLocators,
  getArticlePageActionLocators,
  getNewArticleDialogLocators,
} from '../../../shared/egain/editor/get-article-editor-locators.ts'
import type { ArticleImportEntry, ArticleImportPlan } from './create-import-plan.ts'

export type ArticleCompletionAction = 'check-in' | 'publish'

export type ArticleImportFailure = {
  article: ArticleImportEntry
  message: string
}

export type ArticleImportResult = {
  completedArticles: ArticleImportEntry[]
  failedArticles: ArticleImportFailure[]
}

/**
 * Creates each planned article sequentially so one browser operation cannot
 * race another. Individual failures are recorded and do not end the batch.
 */
export async function runArticleImport(
  articlePage: Page,
  plan: ArticleImportPlan,
  completionAction: ArticleCompletionAction,
): Promise<ArticleImportResult> {
  const completedArticles: ArticleImportEntry[] = []
  const failedArticles: ArticleImportFailure[] = []

  for (const article of plan.articles) {
    try {
      await selectArticleFolderPath(articlePage, article.folderPath)
      await createArticle(articlePage, article, completionAction)
      completedArticles.push(article)
    } catch (error) {
      failedArticles.push({
        article,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return { completedArticles, failedArticles }
}

async function selectArticleFolderPath(articlePage: Page, folderPath: string[]) {
  for (const [index, folderName] of folderPath.entries()) {
    const { cell, collapseButton, expandButton } = getArticleFolderLocators(articlePage, folderName)

    await requireUniqueLocator(cell, `folder "${folderName}"`)

    if (index === folderPath.length - 1) {
      await cell.click()
      continue
    }

    const collapseButtonCount = await collapseButton.count()

    if (collapseButtonCount === 1) {
      continue
    }

    if (collapseButtonCount > 1) {
      throw new Error(
        `Expected at most one collapse button for folder "${folderName}", but found ${collapseButtonCount}.`,
      )
    }

    await requireUniqueLocator(expandButton, `expand button for folder "${folderName}"`)
    await expandButton.click()
  }
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
  const { articleTitleInput, sourceButton, sourceEditor } = getArticleEditorLocators(articlePage)
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

  const createdArticleTitle = await articleTitleInput.inputValue()

  if (createdArticleTitle !== article.title) {
    throw new Error(`Expected the created article title to be "${article.title}", but found "${createdArticleTitle}".`)
  }

  await requireUniqueLocator(sourceButton, 'Source button')
  await sourceButton.click()
  await requireUniqueLocator(sourceEditor, 'source editor')
  await setSourceEditorHtml(sourceEditor, html)
  await sourceButton.click()

  await requireUniqueLocator(saveArticleButton, 'Save button')
  await saveArticleButton.click()

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

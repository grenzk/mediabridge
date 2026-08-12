import type { Locator, Page } from 'playwright'
import { getArticleListLocators } from '../../../shared/egain/editor/get-article-editor-locators.ts'

const articleListTimeoutMs = 60000
const articleListPollIntervalMs = 100
const articleListStablePollCount = 20
const articleListSnapshotTimeoutMs = 1000

/**
 * Collects exact article titles across every article-list page for the selected
 * eGain folder, then restores the list to its first page.
 */
export async function collectExistingArticleTitles(articlePage: Page): Promise<Set<string>> {
  const { articleIds, currentPageInput, emptyState, firstPageButton, nextPageButton, titleLabels, totalPagesLabel } =
    getArticleListLocators(articlePage)

  if (
    (await waitForArticleListState(
      articlePage,
      articleIds,
      currentPageInput,
      emptyState,
      titleLabels,
      totalPagesLabel,
    )) === 'empty'
  ) {
    return new Set()
  }

  await requireUniqueLocator(currentPageInput, 'current article-list page input')
  await requireUniqueLocator(totalPagesLabel, 'article-list total pages label')

  const totalPages = await getTotalPageCount(totalPagesLabel)
  let currentPage = await getCurrentPageNumber(currentPageInput)

  if (currentPage < 1 || currentPage > totalPages) {
    throw new Error(`The eGain article list reported page ${currentPage} of ${totalPages}.`)
  }

  if (currentPage !== 1) {
    await requireUniqueLocator(firstPageButton, 'article-list first-page button')
    await changeArticleListPage(articlePage, currentPageInput, articleIds, titleLabels, firstPageButton, 1)
    currentPage = 1
  }

  const titles = new Set<string>()

  while (currentPage <= totalPages) {
    const pageTitles = await titleLabels.allTextContents()

    pageTitles
      .map(title => title.trim())
      .filter(Boolean)
      .forEach(title => titles.add(title))

    if (currentPage === totalPages) {
      break
    }

    await requireUniqueLocator(nextPageButton, 'article-list next-page button')
    await changeArticleListPage(articlePage, currentPageInput, articleIds, titleLabels, nextPageButton, currentPage + 1)
    currentPage += 1
  }

  if (totalPages > 1) {
    await requireUniqueLocator(firstPageButton, 'article-list first-page button')
    await changeArticleListPage(articlePage, currentPageInput, articleIds, titleLabels, firstPageButton, 1)
  }

  return titles
}

async function waitForArticleListState(
  articlePage: Page,
  articleIds: Locator,
  currentPageInput: Locator,
  emptyState: Locator,
  titleLabels: Locator,
  totalPagesLabel: Locator,
): Promise<'empty' | 'ready'> {
  const deadline = Date.now() + articleListTimeoutMs
  let previousSignature = ''
  let stablePollCount = 0

  while (Date.now() < deadline) {
    const emptyStateVisible = await emptyState.isVisible()
    const readyStateVisible = (await currentPageInput.isVisible()) && (await totalPagesLabel.isVisible())
    const state = emptyStateVisible ? 'empty' : readyStateVisible ? 'ready' : undefined

    if (state) {
      const signature = await getArticleListStateSignature(
        articleIds,
        currentPageInput,
        titleLabels,
        totalPagesLabel,
        emptyStateVisible,
      )

      if (signature === undefined) {
        previousSignature = ''
        stablePollCount = 0
        await articlePage.waitForTimeout(articleListPollIntervalMs)
        continue
      }

      if (signature === previousSignature) {
        stablePollCount += 1
      } else {
        previousSignature = signature
        stablePollCount = 1
      }

      if (stablePollCount >= articleListStablePollCount) {
        return state
      }
    } else {
      previousSignature = ''
      stablePollCount = 0
    }

    await articlePage.waitForTimeout(articleListPollIntervalMs)
  }

  throw new Error('eGain did not finish loading the selected folder article list.')
}

async function getArticleListStateSignature(
  articleIds: Locator,
  currentPageInput: Locator,
  titleLabels: Locator,
  totalPagesLabel: Locator,
  emptyStateVisible: boolean,
): Promise<string | undefined> {
  if (emptyStateVisible) {
    return 'empty'
  }

  try {
    const [currentPage, ids, titles, totalPages] = await Promise.all([
      currentPageInput.inputValue({ timeout: articleListSnapshotTimeoutMs }),
      articleIds.allTextContents(),
      titleLabels.allTextContents(),
      totalPagesLabel.textContent({ timeout: articleListSnapshotTimeoutMs }),
    ])

    return [currentPage, totalPages ?? '', ...ids, '|', ...titles].join('\u0000')
  } catch {
    return undefined
  }
}

async function changeArticleListPage(
  articlePage: Page,
  currentPageInput: Locator,
  articleIds: Locator,
  titleLabels: Locator,
  navigationButton: Locator,
  expectedPage: number,
) {
  const previousSignature = await getArticlePageSignature(articleIds, titleLabels)

  await navigationButton.click()

  const deadline = Date.now() + articleListTimeoutMs

  while (Date.now() < deadline) {
    const currentPage = await getCurrentPageNumber(currentPageInput)
    const currentSignature = await getArticlePageSignature(articleIds, titleLabels)

    if (currentPage === expectedPage && currentSignature !== previousSignature) {
      return
    }

    await articlePage.waitForTimeout(articleListPollIntervalMs)
  }

  throw new Error(`eGain did not display article-list page ${expectedPage}.`)
}

async function getArticlePageSignature(articleIds: Locator, titleLabels: Locator) {
  const [ids, titles] = await Promise.all([articleIds.allTextContents(), titleLabels.allTextContents()])

  return [...ids, '|', ...titles].join('\u0000')
}

async function getCurrentPageNumber(currentPageInput: Locator) {
  const value = await currentPageInput.inputValue()
  const pageNumber = Number.parseInt(value, 10)

  if (!Number.isInteger(pageNumber)) {
    throw new Error(`Could not determine the current eGain article-list page from "${value}".`)
  }

  return pageNumber
}

async function getTotalPageCount(totalPagesLabel: Locator) {
  const value = (await totalPagesLabel.textContent())?.trim() ?? ''
  const pageCount = Number.parseInt(value.match(/\d+$/)?.[0] ?? '', 10)

  if (!Number.isInteger(pageCount) || pageCount < 1) {
    throw new Error(`Could not determine the eGain article-list page count from "${value}".`)
  }

  return pageCount
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

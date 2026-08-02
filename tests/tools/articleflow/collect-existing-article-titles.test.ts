import type { Locator, Page } from 'playwright'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const locatorMocks = vi.hoisted(() => ({
  getArticleListLocators: vi.fn(),
}))

vi.mock('../../../src/shared/egain/editor/get-article-editor-locators.ts', () => locatorMocks)

import { collectExistingArticleTitles } from '../../../src/tools/articleflow/automation/collect-existing-article-titles.ts'

type ArticlePageState = {
  currentPage: number
  idsByPage: Record<number, string[]>
  titlesByPage: Record<number, string[]>
}

beforeEach(() => {
  locatorMocks.getArticleListLocators.mockReset()
})

describe('collectExistingArticleTitles', () => {
  it('collects exact titles from every page and restores the first page', async () => {
    const state: ArticlePageState = {
      currentPage: 2,
      idsByPage: {
        1: ['ECV3-100', 'ECV3-101'],
        2: ['ECV3-102'],
      },
      titlesByPage: {
        1: ['Manuals', ' Specifications '],
        2: ['Manuals'],
      },
    }
    const firstPageClick = vi.fn(async () => {
      state.currentPage = 1
    })
    const nextPageClick = vi.fn(async () => {
      state.currentPage += 1
    })

    locatorMocks.getArticleListLocators.mockReturnValue({
      articleIds: createTextListLocator(() => state.idsByPage[state.currentPage]),
      currentPageInput: createSingleLocator({ inputValue: () => String(state.currentPage) }),
      firstPageButton: createSingleLocator({ click: firstPageClick }),
      nextPageButton: createSingleLocator({ click: nextPageClick }),
      titleLabels: createTextListLocator(() => state.titlesByPage[state.currentPage]),
      totalPagesLabel: createSingleLocator({ textContent: () => ' of 2' }),
    })

    const titles = await collectExistingArticleTitles(createPage())

    expect([...titles]).toEqual(['Manuals', 'Specifications'])
    expect(state.currentPage).toBe(1)
    expect(firstPageClick).toHaveBeenCalledTimes(2)
    expect(nextPageClick).toHaveBeenCalledTimes(1)
  })

  it('returns an empty set for an empty single-page article list', async () => {
    locatorMocks.getArticleListLocators.mockReturnValue({
      articleIds: createTextListLocator(() => []),
      currentPageInput: createSingleLocator({ inputValue: () => '1' }),
      firstPageButton: createSingleLocator(),
      nextPageButton: createSingleLocator(),
      titleLabels: createTextListLocator(() => []),
      totalPagesLabel: createSingleLocator({ textContent: () => ' of 1' }),
    })

    await expect(collectExistingArticleTitles(createPage())).resolves.toEqual(new Set())
  })
})

function createPage(): Page {
  return {
    waitForTimeout: async () => {},
  } as unknown as Page
}

function createSingleLocator(
  overrides: {
    click?: () => Promise<void>
    inputValue?: () => Promise<string> | string
    textContent?: () => Promise<string | null> | string | null
  } = {},
): Locator {
  return {
    click: overrides.click ?? (async () => {}),
    count: async () => 1,
    inputValue: async () => overrides.inputValue?.() ?? '',
    textContent: async () => overrides.textContent?.() ?? '',
    waitFor: async () => {},
  } as Locator
}

function createTextListLocator(getValues: () => string[]): Locator {
  return {
    allTextContents: async () => getValues(),
  } as Locator
}

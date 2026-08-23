import type { Page } from 'playwright'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const actionMocks = vi.hoisted(() => ({
  editArticleButton: {
    click: vi.fn(),
    isVisible: vi.fn(),
  },
  saveArticleButton: {
    isVisible: vi.fn(),
  },
}))

vi.mock('../../../src/shared/egain/editor/get-article-editor-locators.ts', () => ({
  getArticlePageActionLocators: () => actionMocks,
}))

import { ensureArticleEditMode } from '../../../src/tools/articleflow/automation/ensure-article-edit-mode.ts'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ensureArticleEditMode', () => {
  it('waits through the transition where neither Edit nor Save is visible', async () => {
    const articlePage = createPage()

    actionMocks.saveArticleButton.isVisible.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    actionMocks.editArticleButton.isVisible.mockResolvedValue(false)

    await ensureArticleEditMode(articlePage)

    expect(actionMocks.editArticleButton.click).not.toHaveBeenCalled()
    expect(articlePage.waitForTimeout).toHaveBeenCalledOnce()
  })

  it('clicks Edit when an article opens in its read-only state', async () => {
    const articlePage = createPage()

    actionMocks.saveArticleButton.isVisible.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    actionMocks.editArticleButton.isVisible.mockResolvedValueOnce(true)

    await ensureArticleEditMode(articlePage)

    expect(actionMocks.editArticleButton.click).toHaveBeenCalledOnce()
    expect(articlePage.waitForTimeout).toHaveBeenCalledOnce()
  })
})

function createPage(): Page {
  return {
    waitForTimeout: vi.fn(),
  } as unknown as Page
}

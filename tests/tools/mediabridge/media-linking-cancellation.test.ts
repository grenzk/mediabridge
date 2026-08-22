import type { Page } from 'playwright'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ArticleEditorTarget, LinkingMode } from '../../../src/tools/mediabridge/types.ts'

const mocks = vi.hoisted(() => ({
  extractArticleLinks: vi.fn(),
  filterTargetsByLinkedState: vi.fn(),
  filterTargetsByMode: vi.fn(),
  findRequiredPage: vi.fn(),
  getArticleEditorLocators: vi.fn(),
  getLinkingMode: vi.fn(),
  highlightArticleLink: vi.fn(),
  insertMediaLink: vi.fn(),
  restoreLinkedTargets: vi.fn(),
  sourceButtonClick: vi.fn(),
  sourceEditorInputValue: vi.fn(),
  sourceEditorIsVisible: vi.fn(),
}))

vi.mock('../../../src/shared/egain/editor/get-article-editor-locators.ts', () => ({
  getArticleEditorLocators: mocks.getArticleEditorLocators,
}))
vi.mock('../../../src/tools/mediabridge/helpers/extract-article-images.ts', () => ({
  extractArticleImages: vi.fn(),
}))
vi.mock('../../../src/tools/mediabridge/helpers/extract-article-links.ts', () => ({
  extractArticleLinks: mocks.extractArticleLinks,
}))
vi.mock('../../../src/tools/mediabridge/helpers/extract-article-reference-links.ts', () => ({
  extractArticleReferenceLinks: vi.fn(),
}))
vi.mock('../../../src/tools/mediabridge/helpers/highlight-article-image.ts', () => ({
  highlightArticleImage: vi.fn(),
}))
vi.mock('../../../src/tools/mediabridge/helpers/highlight-article-link.ts', () => ({
  highlightArticleLink: mocks.highlightArticleLink,
}))
vi.mock('../../../src/tools/mediabridge/automation/insert-targets.ts', () => ({
  insertArticleLink: vi.fn(),
  insertMediaLink: mocks.insertMediaLink,
}))
vi.mock('../../../src/tools/mediabridge/automation/linked-targets.ts', () => ({
  filterTargetsByLinkedState: mocks.filterTargetsByLinkedState,
  filterTargetsByMode: mocks.filterTargetsByMode,
}))
vi.mock('../../../src/tools/mediabridge/automation/linking-modes.ts', () => ({
  getLinkingMode: mocks.getLinkingMode,
}))
vi.mock('../../../src/tools/mediabridge/automation/required-pages.ts', () => ({
  findRequiredPage: mocks.findRequiredPage,
}))
vi.mock('../../../src/tools/mediabridge/automation/restore-linked-targets.ts', () => ({
  restoreLinkedTargets: mocks.restoreLinkedTargets,
}))

import { analyzeArticleLinks, runMediaLinking } from '../../../src/tools/mediabridge/automation/media-linking.ts'

const linkingMode: LinkingMode = {
  className: 'pdf',
  extensions: ['.pdf'],
  label: 'PDF',
  targetType: 'link',
}
const targets: ArticleEditorTarget[] = [
  { classNames: [], filename: 'first.pdf', href: './first.pdf', sourceIndex: 0, text: 'First' },
  { classNames: [], filename: 'second.pdf', href: './second.pdf', sourceIndex: 1, text: 'Second' },
]

beforeEach(() => {
  vi.clearAllMocks()
  mocks.sourceButtonClick.mockResolvedValue(undefined)
  mocks.sourceEditorInputValue.mockResolvedValue('<a href="./first.pdf">First</a>')
  mocks.sourceEditorIsVisible.mockResolvedValue(true)

  mocks.getArticleEditorLocators.mockReturnValue({
    editorBody: {},
    sourceButton: { click: mocks.sourceButtonClick },
    sourceEditor: {
      inputValue: mocks.sourceEditorInputValue,
      isVisible: mocks.sourceEditorIsVisible,
    },
  })
  mocks.getLinkingMode.mockReturnValue(linkingMode)
  mocks.extractArticleLinks.mockResolvedValue(targets)
  mocks.filterTargetsByMode.mockReturnValue(targets)
  mocks.filterTargetsByLinkedState.mockImplementation((_targets, _mode, linked) => (linked ? [] : targets))
  mocks.findRequiredPage.mockImplementation((_pages, path) => ({ path }))
})

describe('runMediaLinking cancellation', () => {
  it('stops promptly and restores preview mode while source mode is opening', async () => {
    const controller = new AbortController()

    mocks.sourceEditorIsVisible.mockResolvedValue(false)
    mocks.sourceButtonClick.mockImplementationOnce(async () => controller.abort())

    await expect(analyzeArticleLinks([] as Page[], 'pdf', { signal: controller.signal })).rejects.toMatchObject({
      name: 'AutomationCancellationError',
    })
    expect(mocks.sourceButtonClick).toHaveBeenCalledTimes(2)
    expect(mocks.extractArticleLinks).not.toHaveBeenCalled()
  })

  it('stops counting after source targets have been read', async () => {
    const controller = new AbortController()

    mocks.extractArticleLinks.mockImplementationOnce(async () => {
      controller.abort()
      return targets
    })

    await expect(analyzeArticleLinks([] as Page[], 'pdf', { signal: controller.signal })).rejects.toMatchObject({
      name: 'AutomationCancellationError',
    })
    expect(mocks.filterTargetsByMode).not.toHaveBeenCalled()
  })

  it('stops before the next target and still restores the editor source', async () => {
    const controller = new AbortController()
    const pages = [] as Page[]

    mocks.highlightArticleLink.mockImplementationOnce(async () => controller.abort())

    const result = await runMediaLinking({ pages }, 'pdf', { signal: controller.signal })

    expect(result.canceled).toBe(true)
    expect(result.processedCount).toBe(0)
    expect(mocks.highlightArticleLink).toHaveBeenCalledTimes(1)
    expect(mocks.insertMediaLink).not.toHaveBeenCalled()
    expect(mocks.restoreLinkedTargets).toHaveBeenCalledTimes(1)
  })
})

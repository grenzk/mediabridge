import type { Page } from 'playwright'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ArticleImportPlan } from '../../../src/tools/articleflow/automation/create-import-plan.ts'

const articleListMocks = vi.hoisted(() => ({
  collectExistingArticleTitles: vi.fn(),
}))
const folderMocks = vi.hoisted(() => ({
  ensureFolderPath: vi.fn(),
  getSelectedFolderReference: vi.fn(),
  selectFolderPath: vi.fn(),
}))

vi.mock('../../../src/tools/articleflow/automation/collect-existing-article-titles.ts', () => articleListMocks)
vi.mock('../../../src/tools/articleflow/automation/ensure-folder-path.ts', () => folderMocks)

import {
  getImportDestinationPath,
  hasRenderedEditorContent,
  normalizeHtmlLineEndings,
  runArticleImport,
  type ArticleImportProgress,
} from '../../../src/tools/articleflow/automation/run-article-import.ts'

beforeEach(() => {
  vi.clearAllMocks()
  folderMocks.getSelectedFolderReference.mockResolvedValue({ id: 'folder-1', name: 'Destination' })
  folderMocks.ensureFolderPath.mockResolvedValue(false)
  folderMocks.selectFolderPath.mockResolvedValue(undefined)
})

describe('runArticleImport rerun safety', () => {
  it('removes a pre-created product root from template import paths', () => {
    expect(getImportDestinationPath(['Sample Product', '[004]Manuals'], 'Sample Product')).toEqual(['[004]Manuals'])
    expect(getImportDestinationPath(['Sample Product'], 'Sample Product')).toEqual([])
  })

  it('rejects template import paths that do not match the selected product root', () => {
    expect(() => getImportDestinationPath(['Other Product', '[004]Manuals'], 'Sample Product')).toThrow(
      'Expected the import path to start with "Sample Product": Other Product > [004]Manuals',
    )
  })

  it('normalizes Windows and legacy line endings before comparing source HTML', () => {
    expect(normalizeHtmlLineEndings('<p>Line one\r\nLine two\r</p>')).toBe('<p>Line one\nLine two\n</p>')
  })

  it('requires the editor preview to change from the template content', () => {
    expect(hasRenderedEditorContent('<div><strong>Rendered content</strong></div>', '<p><br></p>')).toBe(true)
    expect(hasRenderedEditorContent('<p><br></p>', '<p><br></p>')).toBe(false)
    expect(hasRenderedEditorContent('   ')).toBe(false)
  })

  it('skips exact-title matches and scans each destination folder once', async () => {
    const folderPath = ['Sample Product', 'Manuals']
    const plan: ArticleImportPlan = {
      articles: [
        {
          folderPath,
          relativeSourcePath: 'Manuals/Installation.htm',
          sourcePath: '/tmp/Manuals/Installation.htm',
          title: 'Installation',
        },
        {
          folderPath,
          relativeSourcePath: 'Manuals/Service.htm',
          sourcePath: '/tmp/Manuals/Service.htm',
          title: 'Service',
        },
      ],
      folderPaths: [folderPath],
      ignoredPaths: [],
      rootPath: '/tmp/Sample Product',
    }
    const progress: ArticleImportProgress[] = []

    articleListMocks.collectExistingArticleTitles.mockResolvedValue(new Set(['Installation', 'Service']))

    const result = await runArticleImport({} as unknown as Page, plan, 'check-in', {
      onProgress: update => progress.push(update),
    })

    expect(result.createdArticles).toEqual([])
    expect(result.existingArticles).toEqual(plan.articles)
    expect(result.failedArticles).toEqual([])
    expect(articleListMocks.collectExistingArticleTitles).toHaveBeenCalledTimes(1)
    expect(folderMocks.selectFolderPath).toHaveBeenCalledTimes(2)
    expect(progress).toEqual([
      { folderPath, status: 'started', type: 'folder' },
      { folderPath, status: 'existing', type: 'folder' },
      { article: plan.articles[0], status: 'existing', type: 'article' },
      { article: plan.articles[1], status: 'existing', type: 'article' },
    ])
  })

  it('finishes ensuring every folder before processing articles', async () => {
    const firstFolderPath = ['Sample Product']
    const secondFolderPath = ['Sample Product', 'Manuals']
    const plan: ArticleImportPlan = {
      articles: [
        {
          folderPath: secondFolderPath,
          relativeSourcePath: 'Manuals/Installation.htm',
          sourcePath: '/tmp/Manuals/Installation.htm',
          title: 'Installation',
        },
      ],
      folderPaths: [firstFolderPath, secondFolderPath],
      ignoredPaths: [],
      rootPath: '/tmp/Sample Product',
    }

    articleListMocks.collectExistingArticleTitles.mockResolvedValue(new Set(['Installation']))

    await runArticleImport({} as unknown as Page, plan, 'check-in')

    expect(folderMocks.ensureFolderPath).toHaveBeenCalledTimes(2)
    expect(folderMocks.ensureFolderPath.mock.invocationCallOrder.at(-1)).toBeLessThan(
      folderMocks.selectFolderPath.mock.invocationCallOrder[0],
    )
  })

  it('reports a folder as failed when it cannot be ensured', async () => {
    const folderPath = ['Sample Product', 'Manuals']
    const plan: ArticleImportPlan = {
      articles: [],
      folderPaths: [folderPath],
      ignoredPaths: [],
      rootPath: '/tmp/Sample Product',
    }
    const progress: ArticleImportProgress[] = []

    folderMocks.ensureFolderPath.mockRejectedValueOnce(new Error('Folder tree did not settle.'))

    await expect(
      runArticleImport({} as Page, plan, 'check-in', {
        onProgress: update => progress.push(update),
      }),
    ).rejects.toThrow('Folder tree did not settle.')

    expect(progress).toEqual([
      { folderPath, status: 'started', type: 'folder' },
      { folderPath, status: 'failed', type: 'folder' },
    ])
  })

  it('reuses a prepared product root for template imports', async () => {
    const rootFolderPath = ['Sample Product']
    const manualsFolderPath = ['Sample Product', '[004]Manuals']
    const plan: ArticleImportPlan = {
      articles: [
        {
          folderPath: manualsFolderPath,
          relativeSourcePath: '[004]Manuals/Installation.htm',
          sourcePath: '/tmp/Sample Product/[004]Manuals/Installation.htm',
          title: 'Installation',
        },
      ],
      folderPaths: [rootFolderPath, manualsFolderPath],
      ignoredPaths: [],
      rootPath: '/tmp/Sample Product',
    }

    folderMocks.getSelectedFolderReference.mockResolvedValue({ id: 'product', name: 'Sample Product' })
    articleListMocks.collectExistingArticleTitles.mockResolvedValue(new Set(['Installation']))

    const result = await runArticleImport({} as unknown as Page, plan, 'check-in', {
      articleTemplateTitle: '_ArticleFlow Template',
    })

    expect(result.existingFolderPaths).toEqual(plan.folderPaths)
    expect(result.existingArticles).toEqual(plan.articles)
    expect(folderMocks.ensureFolderPath).toHaveBeenCalledOnce()
    expect(folderMocks.ensureFolderPath).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ name: 'Sample Product' }),
      ['[004]Manuals'],
      undefined,
    )
    expect(folderMocks.selectFolderPath).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ name: 'Sample Product' }),
      ['[004]Manuals'],
      undefined,
    )
  })

  it('waits for the source template row to leave a selected destination', async () => {
    const folderPath = ['Sample Product', '[004]Manuals']
    const plan: ArticleImportPlan = {
      articles: [
        {
          folderPath,
          relativeSourcePath: '[004]Manuals/Installation.htm',
          sourcePath: '/tmp/Sample Product/[004]Manuals/Installation.htm',
          title: 'Installation',
        },
      ],
      folderPaths: [folderPath],
      ignoredPaths: [],
      rootPath: '/tmp/Sample Product',
    }
    const evaluateAll = vi.fn().mockResolvedValueOnce(['source-template-id']).mockResolvedValueOnce([])
    const articlePage = {
      getByTestId: vi.fn(() => ({ evaluateAll })),
      waitForTimeout: vi.fn(),
    } as unknown as Page

    folderMocks.getSelectedFolderReference.mockResolvedValue({ id: 'product', name: 'Sample Product' })
    articleListMocks.collectExistingArticleTitles.mockResolvedValue(new Set(['Installation']))

    const result = await runArticleImport(articlePage, plan, 'check-in', {
      articleTemplateTitle: '_ArticleFlow Template',
      sourceTemplateArticleId: 'source-template-id',
    })

    expect(result.existingArticles).toEqual(plan.articles)
    expect(evaluateAll).toHaveBeenCalledTimes(2)
    expect(articlePage.waitForTimeout).toHaveBeenCalledOnce()
  })

  it('keeps the source template available for articles in the product root', async () => {
    const folderPath = ['Sample Product']
    const plan: ArticleImportPlan = {
      articles: [
        {
          folderPath,
          relativeSourcePath: 'Overview.htm',
          sourcePath: '/tmp/Sample Product/Overview.htm',
          title: 'Overview',
        },
      ],
      folderPaths: [folderPath],
      ignoredPaths: [],
      rootPath: '/tmp/Sample Product',
    }
    const articlePage = {
      getByTestId: vi.fn(),
    } as unknown as Page

    folderMocks.getSelectedFolderReference.mockResolvedValue({ id: 'product', name: 'Sample Product' })
    articleListMocks.collectExistingArticleTitles.mockResolvedValue(new Set(['Overview']))

    const result = await runArticleImport(articlePage, plan, 'check-in', {
      articleTemplateTitle: '_ArticleFlow Template',
      sourceTemplateArticleId: 'source-template-id',
    })

    expect(result.existingArticles).toEqual(plan.articles)
    expect(articlePage.getByTestId).not.toHaveBeenCalled()
  })

  it('does not start the import when cancellation was already requested', async () => {
    const controller = new AbortController()
    const plan: ArticleImportPlan = {
      articles: [],
      folderPaths: [['Sample Product']],
      ignoredPaths: [],
      rootPath: '/tmp/Sample Product',
    }

    controller.abort()

    const result = await runArticleImport({} as Page, plan, 'check-in', { signal: controller.signal })

    expect(result.canceled).toBe(true)
    expect(folderMocks.getSelectedFolderReference).not.toHaveBeenCalled()
    expect(folderMocks.ensureFolderPath).not.toHaveBeenCalled()
  })

  it('does not begin the next folder after cancellation is requested', async () => {
    const controller = new AbortController()
    const firstFolderPath = ['Sample Product']
    const secondFolderPath = ['Sample Product', 'Manuals']
    const plan: ArticleImportPlan = {
      articles: [],
      folderPaths: [firstFolderPath, secondFolderPath],
      ignoredPaths: [],
      rootPath: '/tmp/Sample Product',
    }

    folderMocks.ensureFolderPath.mockImplementationOnce(async () => {
      controller.abort()
      return false
    })

    const result = await runArticleImport({} as Page, plan, 'check-in', { signal: controller.signal })

    expect(result.canceled).toBe(true)
    expect(folderMocks.ensureFolderPath).toHaveBeenCalledTimes(1)
    expect(folderMocks.selectFolderPath).not.toHaveBeenCalled()
  })
})

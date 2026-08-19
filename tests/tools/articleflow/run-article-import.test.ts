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
  it('normalizes Windows and legacy line endings before comparing source HTML', () => {
    expect(normalizeHtmlLineEndings('<p>Line one\r\nLine two\r</p>')).toBe('<p>Line one\nLine two\n</p>')
  })

  it('accepts rendered editor markup without comparing transformed preview text', () => {
    expect(hasRenderedEditorContent('  <div><strong>Rendered content</strong></div>  ')).toBe(true)
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
})

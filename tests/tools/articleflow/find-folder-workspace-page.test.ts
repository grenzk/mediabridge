import type { Page } from 'playwright'
import { describe, expect, it } from 'vitest'
import { findFolderWorkspacePage } from '../../../src/tools/articleflow/automation/find-folder-workspace-page.ts'

describe('findFolderWorkspacePage', () => {
  it('returns the only eGain folder workspace with no article selected', () => {
    const folderPage = createPage('https://example.egain.cloud/system/web/apps/kb/work/Service/folder/202300000074995')
    const articlePage = createPage(
      'https://example.egain.cloud/system/web/apps/kb/work/Service/folder/202300000074995/article/202300000106816',
    )

    expect(findFolderWorkspacePage([articlePage, folderPage])).toBe(folderPage)
  })

  it('reports the open tabs when no destination folder workspace exists', () => {
    const articleUrl =
      'https://example.egain.cloud/system/web/apps/kb/work/Service/folder/202300000074995/article/202300000106816'

    expect(() => findFolderWorkspacePage([createPage(articleUrl)])).toThrow(
      `Could not find an eGain folder page with no article selected. Open tabs: ${articleUrl}`,
    )
  })

  it('rejects ambiguous destination folders', () => {
    const firstUrl = 'https://example.egain.cloud/system/web/apps/kb/work/Service/folder/100'
    const secondUrl = 'https://example.egain.cloud/system/web/apps/kb/work/Service/folder/200'

    expect(() => findFolderWorkspacePage([createPage(firstUrl), createPage(secondUrl)])).toThrow(
      `Found multiple eGain folder pages. Keep only the intended destination open: ${firstUrl}, ${secondUrl}`,
    )
  })
})

function createPage(url: string): Page {
  return { url: () => url } as Page
}

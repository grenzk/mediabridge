import type { Page } from 'playwright'

/**
 * Returns the single eGain folder workspace that can receive an ArticleFlow
 * import. An article must not be selected because the folder is the import root.
 */
export function findFolderWorkspacePage(pages: Page[]): Page {
  const folderPages = pages.filter(page => isFolderWorkspaceUrl(page.url()))

  if (folderPages.length === 0) {
    const openUrls = pages
      .map(page => page.url())
      .filter(Boolean)
      .join(', ')

    throw new Error(`Could not find an eGain folder page with no article selected. Open tabs: ${openUrls || 'none'}`)
  }

  if (folderPages.length > 1) {
    throw new Error(
      `Found multiple eGain folder pages. Keep only the intended destination open: ${folderPages
        .map(page => page.url())
        .join(', ')}`,
    )
  }

  return folderPages[0]
}

function isFolderWorkspaceUrl(value: string): boolean {
  try {
    const { pathname } = new URL(value)

    return pathname.includes('/system/web/apps/kb/work/') && /\/folder\/[^/]+\/?$/.test(pathname)
  } catch {
    return false
  }
}

import 'dotenv/config'
import type { Page } from 'playwright'
import { connectToBrowser } from '../../../shared/browser/connect-to-browser.ts'
import { getDefaultCdpUrl } from '../../../shared/config/runtime.ts'

const { pages } = await connectToBrowser(getDefaultCdpUrl())
const articlePage = findArticlePage(pages)

console.log(`ArticleFlow connected to "${await articlePage.title()}" at ${articlePage.url()}.`)

// Add the ArticleFlow Playwright prototype here.

function findArticlePage(pages: Page[]): Page {
  const articlePage = pages.find(page => page.url().includes('/article/'))

  if (!articlePage) {
    const openUrls = pages.map(page => page.url()).filter(Boolean).join(', ')

    throw new Error(
      `Could not find an article page. Open a tab with "/article/" in the controlled browser. Open tabs: ${
        openUrls || 'none'
      }`,
    )
  }

  return articlePage
}

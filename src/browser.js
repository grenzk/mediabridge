import { chromium } from 'playwright'

/**
 * @param {string} cdpUrl
 * @returns {Promise<{
 *   browser: import('playwright').Browser,
 *   context: import('playwright').BrowserContext,
 *   pages: import('playwright').Page[],
 * }>}
 */
export async function connectToBrowser(cdpUrl) {
  const browser = await chromium.connectOverCDP(cdpUrl)
  const context = browser.contexts()[0]
  const pages = context.pages()

  return { browser, context, pages }
}

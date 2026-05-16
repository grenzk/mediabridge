import { chromium } from 'playwright'

export async function connectToBrowser(cdpUrl) {
  const browser = await chromium.connectOverCDP(cdpUrl)
  const context = browser.contexts()[0]
  const pages = context.pages()

  return { browser, context, pages }
}

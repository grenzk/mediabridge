import { chromium } from 'playwright'
import type { Browser, BrowserContext, Page } from 'playwright'

export type BrowserSession = {
  browser: Browser
  context: BrowserContext
  pages: Page[]
}

export async function connectToBrowser(cdpUrl: string): Promise<BrowserSession> {
  const browser = await chromium.connectOverCDP(cdpUrl)
  const context = browser.contexts()[0]

  if (!context) {
    await browser.close()

    throw new Error('The controlled browser did not expose a browser context.')
  }

  const pages = context.pages()

  return { browser, context, pages }
}

import type { Page } from 'playwright'

export type AssetLibrarySweepResult = {
  site: 'Asset Library'
  status: 'Found' | 'Not Found' | 'Error'
  message: string
}

const EXPECTED_HOST = 'asset-library.vertiv.com'

const SEARCH_INPUT_SELECTOR = '#searchInput'
const CLEAR_BUTTON_SELECTOR = 'div.content-header-button a'
const KEYWORD_SELECTOR = 'li span[title]'
const NO_RESULTS_SELECTOR = 'xpath=//span[text()="No Assets Found"]'

export async function sweepAssetLibrary(pages: Page[], controlNumber: string): Promise<AssetLibrarySweepResult> {
  const page = pages.find(page => page.url().toLowerCase().includes(EXPECTED_HOST))

  if (!page) {
    return {
      site: 'Asset Library',
      status: 'Error',
      message: 'Asset Library tab is not open.',
    }
  }

  try {
    await clearSearch(page)

    const search = page.locator(SEARCH_INPUT_SELECTOR).first()

    await search.waitFor({
      state: 'visible',
      timeout: 10_000,
    })

    await search.fill(controlNumber)
    await search.press('Enter')

    await waitForSearchComplete(page, controlNumber)

    if (await hasNoResults(page)) {
      return {
        site: 'Asset Library',
        status: 'Not Found',
        message: 'NA',
      }
    }

    return {
      site: 'Asset Library',
      status: 'Found',
      message: 'Check',
    }
  } catch (error) {
    return {
      site: 'Asset Library',
      status: 'Error',
      message: error instanceof Error ? error.message : String(error),
    }
  }
}

async function clearSearch(page: Page): Promise<void> {
  const clearButton = page
    .locator(CLEAR_BUTTON_SELECTOR)
    .filter({ hasText: /^Clear$/ })
    .first()

  if (!(await clearButton.count())) {
    return
  }

  await clearButton.click()

  await page.waitForFunction(selector => document.querySelectorAll(selector).length === 0, KEYWORD_SELECTOR, {
    timeout: 10_000,
  })

  await waitUntilLoadingComplete(page)

  await page.locator(SEARCH_INPUT_SELECTOR).first().waitFor({
    state: 'visible',
    timeout: 10_000,
  })
}

async function waitForSearchComplete(page: Page, controlNumber: string): Promise<void> {
  await page.waitForFunction(
    ({ selector, expected }) => {
      const elements = document.querySelectorAll(selector)

      if (elements.length === 0) {
        return false
      }

      const title = elements[0]?.getAttribute('title')?.trim()

      return title?.toUpperCase() === expected.toUpperCase()
    },
    {
      selector: KEYWORD_SELECTOR,
      expected: controlNumber,
    },
    {
      timeout: 15_000,
    },
  )

  await waitUntilLoadingComplete(page)
}

async function waitUntilLoadingComplete(page: Page): Promise<void> {
  await page.waitForFunction(() => !document.body.innerText.includes('Loading...'), undefined, {
    timeout: 15_000,
  })
}

async function hasNoResults(page: Page): Promise<boolean> {
  const elements = page.locator(NO_RESULTS_SELECTOR)

  const count = await elements.count()

  if (count === 0) {
    return false
  }

  return elements.first().isVisible()
}

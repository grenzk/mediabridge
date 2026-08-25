import type { Page } from 'playwright'

export type PDCloudSweepResult = {
  site: 'PD Cloud'
  status: 'Found' | 'Not Found' | 'Error'
  message: string
}

const EXPECTED_HOST = 'egup.fa.us2.oraclecloud.com'
const ADVANCED_SEARCH_BUTTON = 'a[aria-label*="Advanced Search"]'
const SEARCH_INPUT = 'input[aria-label=" Keyword"]'
const SEARCH_BUTTON = 'button[id$="::search"]'
const RESULT_TABLE = 'table[summary="Item Search Results"]'
const BUSY_CLASS = 'p_AFBusy'
const NO_RESULTS_SELECTOR = 'xpath=//*[normalize-space()="No results found."]'

export async function sweepPDCloud(pages: Page[], controlNumber: string): Promise<PDCloudSweepResult> {
  const page = pages.find(page => page.url().toLowerCase().includes(EXPECTED_HOST))

  if (!page) {
    return {
      site: 'PD Cloud',
      status: 'Error',
      message: 'PD Cloud tab is not open.',
    }
  }

  try {
    await prepareSearch(page)

    await executeSearch(page, controlNumber)

    if (await hasNoResults(page)) {
      return {
        site: 'PD Cloud',
        status: 'Not Found',
        message: 'NA',
      }
    }

    return {
      site: 'PD Cloud',
      status: 'Found',
      message: 'Check',
    }
  } catch (error) {
    return {
      site: 'PD Cloud',
      status: 'Error',
      message: error instanceof Error ? error.message : String(error),
    }
  }
}

async function prepareSearch(page: Page): Promise<void> {
  const button = page.locator(ADVANCED_SEARCH_BUTTON).first()

  await button.waitFor({
    state: 'visible',
    timeout: 10_000,
  })

  const expanded = await button.getAttribute('aria-expanded')

  if (expanded === 'true') {
    return
  }

  await button.click()

  await page.waitForFunction(
    selector => {
      const element = document.querySelector(selector)

      return element?.getAttribute('aria-expanded') === 'true'
    },
    ADVANCED_SEARCH_BUTTON,
    {
      timeout: 10_000,
    },
  )
}

async function executeSearch(page: Page, controlNumber: string): Promise<void> {
  const search = page.locator(SEARCH_INPUT).first()

  await search.waitFor({
    state: 'visible',
    timeout: 10_000,
  })

  await search.fill(controlNumber)

  const button = page.locator(SEARCH_BUTTON).first()

  await button.waitFor({
    state: 'visible',
    timeout: 10_000,
  })

  await button.click()

  await waitForSearchComplete(page)
}

async function waitForSearchComplete(page: Page, timeout = 30_000): Promise<void> {
  const table = page.locator(RESULT_TABLE).first()

  await table.waitFor({
    state: 'attached',
    timeout: 10_000,
  })

  /*
   * Python implementation:
   *
   * 1. Wait briefly for busy state to appear.
   * 2. Wait for busy state to disappear.
   *
   * The busy state may not appear for very fast searches,
   * so failure of the first wait is intentionally ignored.
   */

  try {
    await page.waitForFunction(
      ({ selector, busyClass }) => {
        const element = document.querySelector(selector)

        if (!element) {
          return false
        }

        return element.classList.contains(busyClass)
      },
      {
        selector: RESULT_TABLE,
        busyClass: BUSY_CLASS,
      },
      {
        timeout: 2_000,
      },
    )
  } catch {
    // Busy state may not appear for fast searches.
  }

  /*
   * Wait until Oracle finishes updating the table.
   */
  await page.waitForFunction(
    ({ selector, busyClass }) => {
      const element = document.querySelector(selector)

      if (!element) {
        return false
      }

      return !element.classList.contains(busyClass)
    },
    {
      selector: RESULT_TABLE,
      busyClass: BUSY_CLASS,
    },
    {
      timeout,
    },
  )

  /*
   * Oracle can replace/update the table several times after
   * the busy class disappears. Match the Python implementation
   * by waiting until the table HTML remains unchanged.
   */
  let previousHtml = ''
  let stableCount = 0

  const endTime = Date.now() + timeout

  while (Date.now() < endTime) {
    const html = await table.evaluate(element => element.innerHTML)

    if (html === previousHtml) {
      stableCount += 1

      if (stableCount >= 3) {
        return
      }
    } else {
      stableCount = 0
      previousHtml = html
    }

    await page.waitForTimeout(200)
  }

  throw new Error('PD Cloud search results did not stabilize within the timeout.')
}

async function hasNoResults(page: Page): Promise<boolean> {
  const elements = page.locator(NO_RESULTS_SELECTOR)

  return (await elements.count()) > 0
}

import type { Page } from 'playwright'

export type VertivSweepResult = {
  site: 'Vertiv'
  status: 'Found' | 'Not Found' | 'Error'
  message: string
}

const VERTIV_MATCH_URL = 'https://www.vertiv.com/en-us/'

const SEARCH_BUTTON_SELECTOR = 'button.search-expand__icon'
const SEARCH_FORM_SELECTOR = 'form.search-expand'
const SEARCH_INPUT_SELECTOR = "input[ng-model='self.query']"

const SEARCH_RESULTS_SELECTOR = 'div.product-tile-component.search-tile'
const RESULT_TITLE_SELECTOR = 'div.product-tile-component.search-tile h3 a'

const NO_RESULTS_SELECTOR = '#noResults'

const SEARCH_EXPANDED_CLASS = 'search-is-expanded'

export async function sweepVertiv(pages: Page[], controlNumber: string): Promise<VertivSweepResult> {
  const page = pages.find(page => page.url().startsWith(VERTIV_MATCH_URL))

  if (!page) {
    return {
      site: 'Vertiv',
      status: 'Error',
      message: 'Vertiv website is not open.',
    }
  }

  try {
    await prepareSearch(page)

    await executeSearch(page, controlNumber)

    if (await hasNoResults(page)) {
      return {
        site: 'Vertiv',
        status: 'Not Found',
        message: 'NA',
      }
    }

    return await findMatchingResult(page, controlNumber)
  } catch (error) {
    return {
      site: 'Vertiv',
      status: 'Error',
      message: error instanceof Error ? error.message : String(error),
    }
  }
}

async function prepareSearch(page: Page): Promise<void> {
  const searchForm = page.locator(SEARCH_FORM_SELECTOR).first()

  const isExpanded = await searchForm
    .getAttribute('class')
    .then(className => className?.split(/\s+/).includes(SEARCH_EXPANDED_CLASS) ?? false)
    .catch(() => false)

  if (isExpanded) {
    return
  }

  const searchButton = page.locator(SEARCH_BUTTON_SELECTOR).first()

  await searchButton.waitFor({
    state: 'visible',
    timeout: 15_000,
  })

  await searchButton.click()

  await page.waitForFunction(
    selector => {
      const form = document.querySelector(selector)

      return form?.classList.contains('search-is-expanded') ?? false
    },
    SEARCH_FORM_SELECTOR,
    {
      timeout: 15_000,
    },
  )
}

async function executeSearch(page: Page, controlNumber: string): Promise<void> {
  const search = page.locator(SEARCH_INPUT_SELECTOR).first()

  await search.waitFor({
    state: 'visible',
    timeout: 10_000,
  })

  await search.fill(controlNumber)

  /*
   * Start waiting for the API response BEFORE pressing Enter.
   * This prevents missing a fast response.
   */
  const responsePromise = page.waitForResponse(
    response => response.url().endsWith('/api-lang/en/searchResults/search'),
    {
      timeout: 30_000,
    },
  )

  await search.press('Enter')

  await responsePromise

  /*
   * API response does not necessarily mean the result tiles
   * have already been rendered.
   */
  await waitForSearchResults(page)
}

async function waitForSearchResults(page: Page): Promise<void> {
  const results = page.locator(SEARCH_RESULTS_SELECTOR)

  const noResults = page.locator(NO_RESULTS_SELECTOR)

  await Promise.race([
    results.first().waitFor({
      state: 'visible',
      timeout: 10_000,
    }),

    noResults.waitFor({
      state: 'visible',
      timeout: 10_000,
    }),
  ]).catch(() => {
    /*
     * Let the caller perform the final result check.
     * This prevents a rendering delay from being treated
     * immediately as a search failure.
     */
  })
}

async function findMatchingResult(page: Page, controlNumber: string): Promise<VertivSweepResult> {
  const results = page.locator(SEARCH_RESULTS_SELECTOR)

  /*
   * Match Python:
   *
   * WaitHelper.present(driver, RESULTS)
   */
  await results.first().waitFor({
    state: 'attached',
    timeout: 10_000,
  })

  const titles = await page.locator(RESULT_TITLE_SELECTOR).allTextContents()

  // console.info(`Vertiv: ${titles.length} search result(s) found.`)

  const normalizedControlNumber = controlNumber.trim().toUpperCase()

  for (const title of titles) {
    if (title.trim().toUpperCase().includes(normalizedControlNumber)) {
      return {
        site: 'Vertiv',
        status: 'Found',
        message: 'Check',
      }
    }
  }

  return {
    site: 'Vertiv',
    status: 'Not Found',
    message: 'NA',
  }
}

async function hasNoResults(page: Page): Promise<boolean> {
  return page
    .locator(NO_RESULTS_SELECTOR)
    .first()
    .isVisible()
    .catch(() => false)
}

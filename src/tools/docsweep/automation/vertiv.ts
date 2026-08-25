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

    const searchInput = page.locator(SEARCH_INPUT_SELECTOR).first()

    await searchInput.waitFor({
      state: 'visible',
      timeout: 10_000,
    })

    await searchInput.fill(controlNumber)

    await searchInput.press('Enter')

    await waitForSearchResponse(page)

    if (
      await page
        .locator(NO_RESULTS_SELECTOR)
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      return {
        site: 'Vertiv',
        status: 'Not Found',
        message: 'NA',
      }
    }

    const titles = await page.locator(RESULT_TITLE_SELECTOR).allTextContents()

    const matchingResult = titles.some(title => title.trim().toUpperCase().includes(controlNumber.toUpperCase()))

    if (matchingResult) {
      return {
        site: 'Vertiv',
        status: 'Found',
        message: 'Check',
      }
    }

    return {
      site: 'Vertiv',
      status: 'Not Found',
      message: 'NA',
    }
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
    timeout: 10_000,
  })

  await searchButton.click()

  await page.waitForFunction(
    selector => {
      const form = document.querySelector(selector)

      return form?.classList.contains('search-is-expanded') ?? false
    },
    SEARCH_FORM_SELECTOR,
    {
      timeout: 10_000,
    },
  )
}

async function waitForSearchResponse(page: Page): Promise<void> {
  await page.waitForResponse(response => response.url().endsWith('/api-lang/en/searchResults/search'), {
    timeout: 15_000,
  })
}

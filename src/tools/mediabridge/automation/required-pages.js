/**
 * @param {import('playwright').Page[]} pages
 * @param {string} urlPart
 * @param {string} pageName
 * @returns {import('playwright').Page}
 */
export function findRequiredPage(pages, urlPart, pageName) {
  const page = pages.find(candidatePage => candidatePage.url().includes(urlPart))

  if (!page) {
    const openUrls = pages
      .map(candidatePage => candidatePage.url())
      .filter(Boolean)
      .join(', ')

    throw new Error(
      `Could not find ${pageName}. Open a tab with "${urlPart}" in the controlled browser. Open tabs: ${openUrls || 'none'}`,
    )
  }

  return page
}

/**
 * @param {import('playwright').Page} articlePage
 */
export async function extractArticleLinks(articlePage) {
  const html = await articlePage.locator('.cke_source').first().inputValue()
  const links = await articlePage.evaluate((html) => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')

    return [...doc.querySelectorAll('a')].map((link) => {
      const url = new URL(link.href)
      const filename = url.pathname.split('/').pop()

      return {
        filename,
        text: link.textContent.trim(),
      }
    })
  }, html)

  return links
}

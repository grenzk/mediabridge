import { getEditorLocators } from '../editor/get-editor-locators.js'

/**
 * @param {import('playwright').Page} articlePage
 * @returns {Promise<{ classNames: string[], filename: string, href: string, sourceIndex: number, text: string }[]>}
 */
export async function extractArticleLinks(articlePage) {
  const { sourceEditor } = getEditorLocators(articlePage)

  const html = await sourceEditor.inputValue()

  const links = await articlePage.evaluate(html => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')

    const decodeFilename = filename => {
      try {
        return decodeURIComponent(filename)
      } catch {
        return filename
      }
    }

    return [...doc.querySelectorAll('a')].map((link, sourceIndex) => {
      const href = link.getAttribute('href') ?? link.href
      const url = new URL(href, window.location.href)
      const filename = decodeFilename(url.pathname.split('/').pop())

      return {
        classNames: [...link.classList],
        filename,
        href,
        sourceIndex,
        text: link.textContent.trim(),
      }
    })
  }, html)

  return links
}

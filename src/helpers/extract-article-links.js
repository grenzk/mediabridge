import { getEditorLocators } from '../editor/get-editor-locators.js'

/**
 * @param {import('playwright').Page} articlePage
 * @returns {Promise<{ filename: string, text: string }[]>}
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

    return [...doc.querySelectorAll('a')].map(link => {
      const url = new URL(link.href)
      const filename = decodeFilename(url.pathname.split('/').pop())

      return {
        filename,
        text: link.textContent.trim(),
      }
    })
  }, html)

  return links
}

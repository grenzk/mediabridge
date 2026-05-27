import { getEditorLocators } from '../editor/get-editor-locators.js'

/**
 * @param {import('playwright').Page} articlePage
 * @returns {Promise<{ alt: string, filename: string, sourceIndex: number, src: string }[]>}
 */
export async function extractArticleImages(articlePage) {
  const { sourceEditor } = getEditorLocators(articlePage)

  const html = await sourceEditor.inputValue()

  const images = await articlePage.evaluate(html => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')

    const decodeFilename = filename => {
      try {
        return decodeURIComponent(filename)
      } catch {
        return filename
      }
    }

    return [...doc.querySelectorAll('img')].map((image, sourceIndex) => {
      const src = image.getAttribute('src') ?? image.src
      let filename = ''

      try {
        const url = new URL(src, window.location.href)

        filename = decodeFilename(url.pathname.split('/').pop())
      } catch {
        filename = src
      }

      return {
        alt: image.getAttribute('alt') ?? '',
        filename,
        sourceIndex,
        src,
      }
    })
  }, html)

  return images
}

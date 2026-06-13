import { getEditorLocators } from '../editor/get-editor-locators.js'

/**
 * Reads image placeholders from the source editor. Content developers can use
 * dummy src paths as long as the path ends with the media server filename.
 *
 * @param {import('playwright').Page} articlePage
 * @returns {Promise<{ alt: string, filename: string, height: string, sourceIndex: number, src: string, style: string, width: string }[]>}
 */
export async function extractArticleImages(articlePage) {
  const { sourceEditor } = getEditorLocators(articlePage)

  const html = await sourceEditor.inputValue()

  const images = await articlePage.evaluate((html) => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')

    const decodeFilename = (filename) => {
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
        height: image.getAttribute('height') ?? '',
        sourceIndex,
        src,
        style: image.getAttribute('style') ?? '',
        width: image.getAttribute('width') ?? '',
      }
    })
  }, html)

  return images
}

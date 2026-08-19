import type { Page } from 'playwright'
import { getArticleEditorLocators } from '../../../shared/egain/editor/get-article-editor-locators.ts'
import type { ArticleEditorImage } from '../types.ts'

/**
 * Reads image placeholders from the source editor. Content developers can use
 * dummy src paths as long as the path ends with the media server filename.
 */
export async function extractArticleImages(articlePage: Page): Promise<ArticleEditorImage[]> {
  const { sourceEditor } = getArticleEditorLocators(articlePage)

  const html = await sourceEditor.inputValue()

  const images = await articlePage.evaluate(html => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')

    const decodeFilename = (filename: string) => {
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

        filename = decodeFilename(url.pathname.split('/').pop() ?? '')
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

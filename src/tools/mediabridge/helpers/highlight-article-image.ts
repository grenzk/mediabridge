import type { Locator } from 'playwright'
import type { ArticleEditorImage } from '../types.ts'

/**
 * Selects the article editor image that corresponds to a source HTML image.
 * Image selections use the node itself because img elements do not have text
 * contents to select.
 */
export async function highlightArticleImage(editorBody: Locator, targetImage: ArticleEditorImage) {
  const selected = await editorBody.evaluate((element, targetImage) => {
    const body = element as HTMLElement
    const images = [...body.querySelectorAll('img')]

    const decodeFilename = (filename: string) => {
      try {
        return decodeURIComponent(filename)
      } catch {
        return filename
      }
    }

    const getImageFilename = (image: HTMLImageElement) => {
      const src = image.getAttribute('src') ?? image.src

      try {
        const url = new URL(src, window.location.href)

        return decodeFilename(url.pathname.split('/').pop() ?? '')
      } catch {
        return ''
      }
    }

    const filenameMatches = (image: HTMLImageElement | undefined) => {
      if (!image) {
        return false
      }

      return getImageFilename(image) === targetImage.filename
    }

    const imageMatches = (image: HTMLImageElement) => {
      return filenameMatches(image) && (image.getAttribute('alt') ?? '') === targetImage.alt
    }

    const sourceImage = images[targetImage.sourceIndex]
    const matchingImage = filenameMatches(sourceImage)
      ? sourceImage
      : (images.find(imageMatches) ?? images.find(filenameMatches))

    if (!matchingImage) {
      return false
    }

    const range = body.ownerDocument.createRange()

    range.selectNode(matchingImage)

    const selection = body.ownerDocument.getSelection()

    if (!selection) {
      return false
    }

    selection.removeAllRanges()
    selection.addRange(range)
    body.focus()

    return true
  }, targetImage)

  if (!selected) {
    throw new Error(`Could not select article image for ${targetImage.filename}.`)
  }
}

/**
 * Selects the article editor image that corresponds to a source HTML image.
 * Image selections use the node itself because img elements do not have text
 * contents to select.
 *
 * @param {import('playwright').Locator} editorBody
 * @param {{ alt: string, filename: string, height: string, sourceIndex: number, src: string, width: string }} targetImage
 */
export async function highlightArticleImage(editorBody, targetImage) {
  const selected = await editorBody.evaluate((body, targetImage) => {
    const images = [...body.querySelectorAll('img')]

    const decodeFilename = filename => {
      try {
        return decodeURIComponent(filename)
      } catch {
        return filename
      }
    }

    const getImageFilename = image => {
      const src = image.getAttribute('src') ?? image.src

      try {
        const url = new URL(src, window.location.href)

        return decodeFilename(url.pathname.split('/').pop())
      } catch {
        return ''
      }
    }

    const filenameMatches = image => {
      if (!image) {
        return false
      }

      return getImageFilename(image) === targetImage.filename
    }

    const imageMatches = image => {
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

    selection.removeAllRanges()
    selection.addRange(range)
    body.focus()

    return true
  }, targetImage)

  if (!selected) {
    throw new Error(`Could not select article image for ${targetImage.filename}.`)
  }
}

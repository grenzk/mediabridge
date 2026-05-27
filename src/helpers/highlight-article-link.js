/**
 * Selects the article editor anchor that corresponds to a source HTML link.
 * Matching by anchor identity avoids duplicate visible text selecting the
 * wrong location.
 *
 * @param {import('playwright').Locator} editorBody
 * @param {{ filename: string, href: string, sourceIndex: number, text: string }} targetLink
 */
export async function highlightArticleLink(editorBody, targetLink) {
  const selected = await editorBody.evaluate((body, targetLink) => {
    const anchors = [...body.querySelectorAll('a')]

    const decodeFilename = filename => {
      try {
        return decodeURIComponent(filename)
      } catch {
        return filename
      }
    }

    const normalizeText = text => text.replace(/\s+/g, ' ').trim()

    const getAnchorFilename = anchor => {
      const href = anchor.getAttribute('href') ?? anchor.href

      try {
        const url = new URL(href, window.location.href)

        return decodeFilename(url.pathname.split('/').pop())
      } catch {
        return ''
      }
    }

    const anchorMatches = anchor => {
      if (!anchor) {
        return false
      }

      const filename = getAnchorFilename(anchor)
      const text = normalizeText(anchor.textContent)

      return (
        filename === targetLink.filename &&
        text === normalizeText(targetLink.text)
      )
    }

    const sourceAnchor = anchors[targetLink.sourceIndex]
    const matchingAnchor = anchorMatches(sourceAnchor)
      ? sourceAnchor
      : anchors.find(anchorMatches)

    if (!matchingAnchor) {
      return false
    }

    const range = body.ownerDocument.createRange()

    range.selectNodeContents(matchingAnchor)

    const selection = body.ownerDocument.getSelection()

    selection.removeAllRanges()
    selection.addRange(range)
    body.focus()

    return true
  }, targetLink)

  if (!selected) {
    throw new Error(
      `Could not select article link "${targetLink.text}" for ${targetLink.filename}.`,
    )
  }
}

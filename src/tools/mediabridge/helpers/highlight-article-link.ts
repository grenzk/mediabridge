import type { Locator } from 'playwright'
import type { ArticleEditorLink } from '../types.ts'

/**
 * Selects the article editor anchor that corresponds to a source HTML link.
 * Matching by anchor identity avoids duplicate visible text selecting the
 * wrong location.
 */
export async function highlightArticleLink(editorBody: Locator, targetLink: ArticleEditorLink) {
  const selected = await editorBody.evaluate((element, targetLink) => {
    const body = element as HTMLElement
    const anchors = [...body.querySelectorAll('a')]

    const decodeFilename = (filename: string) => {
      try {
        return decodeURIComponent(filename)
      } catch {
        return filename
      }
    }

    const normalizeText = (text: string) => text.replace(/\s+/g, ' ').trim()

    const getAnchorFilename = (anchor: HTMLAnchorElement) => {
      const href = anchor.getAttribute('href') ?? anchor.href

      try {
        const url = new URL(href, window.location.href)

        return decodeFilename(url.pathname.split('/').pop() ?? '')
      } catch {
        return ''
      }
    }

    const anchorMatches = (anchor: HTMLAnchorElement | undefined) => {
      if (!anchor) {
        return false
      }

      const filename = getAnchorFilename(anchor)
      const text = normalizeText(anchor.textContent ?? '')

      return filename === targetLink.filename && text === normalizeText(targetLink.text)
    }

    const sourceAnchor = anchors[targetLink.sourceIndex]
    const matchingAnchor = anchorMatches(sourceAnchor) ? sourceAnchor : anchors.find(anchorMatches)

    if (!matchingAnchor) {
      return false
    }

    const range = body.ownerDocument.createRange()

    range.selectNodeContents(matchingAnchor)

    const selection = body.ownerDocument.getSelection()

    if (!selection) {
      return false
    }

    selection.removeAllRanges()
    selection.addRange(range)
    body.focus()

    return true
  }, targetLink)

  if (!selected) {
    throw new Error(`Could not select article link "${targetLink.text}" for ${targetLink.filename}.`)
  }
}

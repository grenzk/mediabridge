/**
 * @param {import('playwright').Locator} editorBody
 * @param {string} targetText
 * @param {number} occurrenceIndex
 */
export async function highlightTextOccurrence(editorBody, targetText, occurrenceIndex = 0) {
  await editorBody.evaluate(
    (body, { targetText, occurrenceIndex }) => {
      const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT)

      let currentOccurrence = 0

      while (walker.nextNode()) {
        const node = walker.currentNode

        let start = node.textContent.indexOf(targetText)

        while (start !== -1) {
          if (currentOccurrence === occurrenceIndex) {
            const range = document.createRange()

            range.setStart(node, start)
            range.setEnd(node, start + targetText.length)

            const selection = body.ownerDocument.getSelection()

            selection.removeAllRanges()
            selection.addRange(range)

            body.focus()

            return true
          }

          currentOccurrence++

          start = node.textContent.indexOf(targetText, start + targetText.length)
        }
      }

      return false
    },
    { targetText, occurrenceIndex },
  )
}

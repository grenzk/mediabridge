/**
 * @param {{
 *   mode?: { targetType?: string },
 *   unlinkedTargets?: unknown[],
 * }} result
 * @returns {string}
 */
export function formatUnlinkedTargetsDetail(result) {
  if (!Array.isArray(result.unlinkedTargets) || result.unlinkedTargets.length === 0) {
    return ''
  }

  const isArticleMode = result.mode?.targetType === 'article'
  const heading = isArticleMode ? 'Unlinked article IDs:' : 'Unlinked media filenames:'
  const lines = result.unlinkedTargets.map((unlinkedTargetCandidate, index) => {
    const unlinkedTarget =
      unlinkedTargetCandidate && typeof unlinkedTargetCandidate === 'object' ? unlinkedTargetCandidate : {}

    return isArticleMode
      ? formatUnlinkedArticleId(unlinkedTarget, index)
      : formatUnlinkedMediaFilename(unlinkedTarget, index)
  })

  return [heading, ...lines].join('\n')
}

/**
 * @param {{ articleId?: string, text?: string }} unlinkedTarget
 * @param {number} index
 * @returns {string}
 */
function formatUnlinkedArticleId(unlinkedTarget, index) {
  const articleId = getReadableValue(unlinkedTarget.articleId) || `target ${index + 1}`
  const label = getReadableValue(unlinkedTarget.text)

  return label ? `- ${articleId} (${label})` : `- ${articleId}`
}

/**
 * @param {{ alt?: string, displayName?: string, filename?: string, text?: string }} unlinkedTarget
 * @param {number} index
 * @returns {string}
 */
function formatUnlinkedMediaFilename(unlinkedTarget, index) {
  const filename = getReadableValue(unlinkedTarget.filename) || `target ${index + 1}`
  const label =
    getReadableValue(unlinkedTarget.displayName) ||
    getReadableValue(unlinkedTarget.alt) ||
    getReadableValue(unlinkedTarget.text)

  return label && label !== filename ? `- ${filename} (${label})` : `- ${filename}`
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function getReadableValue(value) {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * @param {{
 *   mode?: { targetType?: string },
 *   skippedTargets?: unknown[],
 * }} result
 * @returns {string}
 */
export function formatSkippedTargetsDetail(result) {
  if (!Array.isArray(result.skippedTargets) || result.skippedTargets.length === 0) {
    return ''
  }

  const isArticleMode = result.mode?.targetType === 'article'
  const heading = isArticleMode ? 'Missing article IDs:' : 'Missing media filenames:'
  const lines = result.skippedTargets.map((skippedTargetCandidate, index) => {
    const skippedTarget =
      skippedTargetCandidate && typeof skippedTargetCandidate === 'object' ? skippedTargetCandidate : {}

    return isArticleMode
      ? formatMissingArticleId(skippedTarget, index)
      : formatMissingMediaFilename(skippedTarget, index)
  })

  return [heading, ...lines].join('\n')
}

/**
 * @param {{ articleId?: string, text?: string }} skippedTarget
 * @param {number} index
 * @returns {string}
 */
function formatMissingArticleId(skippedTarget, index) {
  const articleId = getReadableValue(skippedTarget.articleId) || `target ${index + 1}`
  const label = getReadableValue(skippedTarget.text)

  return label ? `- ${articleId} (${label})` : `- ${articleId}`
}

/**
 * @param {{ alt?: string, displayName?: string, filename?: string, text?: string }} skippedTarget
 * @param {number} index
 * @returns {string}
 */
function formatMissingMediaFilename(skippedTarget, index) {
  const filename = getReadableValue(skippedTarget.filename) || `target ${index + 1}`
  const label =
    getReadableValue(skippedTarget.displayName) ||
    getReadableValue(skippedTarget.alt) ||
    getReadableValue(skippedTarget.text)

  return label && label !== filename ? `- ${filename} (${label})` : `- ${filename}`
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function getReadableValue(value) {
  return typeof value === 'string' ? value.trim() : ''
}

type UnlinkedTargetLogResult = {
  mode?: { targetType?: string }
  unlinkedTargets?: unknown
}

type UnlinkedTargetDetails = Record<string, unknown>

export function formatUnlinkedTargetsDetail(result: UnlinkedTargetLogResult): string {
  if (!Array.isArray(result.unlinkedTargets) || result.unlinkedTargets.length === 0) {
    return ''
  }

  const isArticleMode = result.mode?.targetType === 'article'
  const heading = isArticleMode ? 'Unlinked article IDs:' : 'Unlinked media filenames:'
  const lines = result.unlinkedTargets.map((unlinkedTargetCandidate, index) => {
    const unlinkedTarget: UnlinkedTargetDetails =
      unlinkedTargetCandidate && typeof unlinkedTargetCandidate === 'object'
        ? (unlinkedTargetCandidate as UnlinkedTargetDetails)
        : {}

    return isArticleMode
      ? formatUnlinkedArticleId(unlinkedTarget, index)
      : formatUnlinkedMediaFilename(unlinkedTarget, index)
  })

  return [heading, ...lines].join('\n')
}

function formatUnlinkedArticleId(unlinkedTarget: UnlinkedTargetDetails, index: number): string {
  const articleId = getReadableValue(unlinkedTarget.articleId) || `target ${index + 1}`
  const label = getReadableValue(unlinkedTarget.text)

  return label ? `- ${articleId} (${label})` : `- ${articleId}`
}

function formatUnlinkedMediaFilename(unlinkedTarget: UnlinkedTargetDetails, index: number): string {
  const filename = getReadableValue(unlinkedTarget.filename) || `target ${index + 1}`
  const label =
    getReadableValue(unlinkedTarget.displayName) ||
    getReadableValue(unlinkedTarget.alt) ||
    getReadableValue(unlinkedTarget.text)

  return label && label !== filename ? `- ${filename} (${label})` : `- ${filename}`
}

function getReadableValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

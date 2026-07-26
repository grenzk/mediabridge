import { getLinkingMode } from './linking-modes.ts'
import type { ArticleEditorTarget, LinkingMode } from '../types.ts'

const LINKED_MEDIA_ORIGIN = 'https://napsapps.egain.services'
const LINKED_ARTICLE_CLASS_NAME = 'eGainArticleLink'

/**
 * Keeps targets that match the selected linking mode.
 */
export function filterTargetsByMode(targets: ArticleEditorTarget[], mode: string = 'pdf') {
  const { className, extensions = [], preservedClassNames, targetType } = getLinkingMode(mode)

  if (targetType === 'article') {
    return targets.filter(target => target.articleId || target.classNames?.includes(LINKED_ARTICLE_CLASS_NAME))
  }

  const modeClassNames = [className, ...(preservedClassNames?.replacements ?? [])].filter(Boolean)

  return targets.filter(target => {
    const filename = target.filename.toLowerCase()
    const hasModeClassName = target.classNames?.some(className => modeClassNames.includes(className))

    return hasModeClassName || extensions.some(extension => filename.endsWith(extension))
  })
}

/**
 * Keeps targets whose linked state matches the requested value.
 */
export function filterTargetsByLinkedState(
  targets: ArticleEditorTarget[],
  linkingMode: LinkingMode,
  isLinked: boolean,
) {
  return targets.filter(target => isLinkedTarget(target, linkingMode) === isLinked)
}

/**
 * Detects strings that already include a URL scheme. Relative dummy paths are
 * intentionally excluded so they can still be matched against media filenames.
 */
function isAbsoluteUrl(value: string) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value)
}

/**
 * Checks whether a source href/src already points at the media service. Those
 * targets should be skipped so the automation can be run repeatedly.
 */
function isLinkedMediaUrl(value: string = '') {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return false
  }

  if (trimmedValue.startsWith('//')) {
    try {
      return new URL(`https:${trimmedValue}`).origin === LINKED_MEDIA_ORIGIN
    } catch {
      return false
    }
  }

  if (!isAbsoluteUrl(trimmedValue)) {
    return false
  }

  try {
    return new URL(trimmedValue).origin === LINKED_MEDIA_ORIGIN
  } catch {
    return false
  }
}

function getTargetUrl(target: ArticleEditorTarget) {
  return target.href ?? target.src ?? ''
}

/**
 * Checks whether a target has already been linked by eGain.
 */
function isLinkedTarget(target: ArticleEditorTarget, linkingMode: LinkingMode) {
  if (linkingMode.targetType === 'article') {
    return target.classNames?.includes(LINKED_ARTICLE_CLASS_NAME) ?? false
  }

  return isLinkedMediaUrl(getTargetUrl(target))
}

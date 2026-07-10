import { getLinkingMode } from './linking-modes.js'

const LINKED_MEDIA_ORIGIN = 'https://napsapps.egain.services'
const LINKED_ARTICLE_CLASS_NAME = 'eGainArticleLink'

/**
 * @typedef {import('./linking-modes.js').LinkingMode} LinkingMode
 * @typedef {{
 *   articleId?: string,
 *   classNames?: string[],
 *   filename: string,
 *   href?: string,
 *   src?: string,
 * }} ArticleEditorTarget
 */

/**
 * @param {ArticleEditorTarget[]} targets
 * @param {string} mode
 * @returns {ArticleEditorTarget[]}
 */
export function filterTargetsByMode(targets, mode = 'pdf') {
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
 *
 * @param {ArticleEditorTarget[]} targets
 * @param {LinkingMode} linkingMode
 * @param {boolean} isLinked
 * @returns {ArticleEditorTarget[]}
 */
export function filterTargetsByLinkedState(targets, linkingMode, isLinked) {
  return targets.filter(target => isLinkedTarget(target, linkingMode) === isLinked)
}

/**
 * Detects strings that already include a URL scheme. Relative dummy paths are
 * intentionally excluded so they can still be matched against media filenames.
 *
 * @param {string} value
 * @returns {boolean}
 */
function isAbsoluteUrl(value) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value)
}

/**
 * Checks whether a source href/src already points at the media service. Those
 * targets should be skipped so the automation can be run repeatedly.
 *
 * @param {string} value
 * @returns {boolean}
 */
function isLinkedMediaUrl(value = '') {
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

/**
 * @param {ArticleEditorTarget} target
 * @returns {string}
 */
function getTargetUrl(target) {
  return target.href ?? target.src ?? ''
}

/**
 * Checks whether a target has already been linked by eGain.
 *
 * @param {ArticleEditorTarget} target
 * @param {LinkingMode} linkingMode
 * @returns {boolean}
 */
function isLinkedTarget(target, linkingMode) {
  if (linkingMode.targetType === 'article') {
    return target.classNames?.includes(LINKED_ARTICLE_CLASS_NAME) ?? false
  }

  return isLinkedMediaUrl(getTargetUrl(target))
}

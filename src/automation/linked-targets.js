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
 * @param {ArticleEditorTarget[]} links
 * @param {string} mode
 * @returns {ArticleEditorTarget[]}
 */
export function filterLinksByMode(links, mode = 'pdf') {
  const { className, extensions = [], preservedClassNames, targetType } = getLinkingMode(mode)

  if (targetType === 'article') {
    return links.filter(link => link.articleId || link.classNames?.includes(LINKED_ARTICLE_CLASS_NAME))
  }

  const modeClassNames = [className, ...(preservedClassNames?.replacements ?? [])].filter(Boolean)

  return links.filter(link => {
    const filename = link.filename.toLowerCase()
    const hasModeClassName = link.classNames?.some(linkClassName => modeClassNames.includes(linkClassName))

    return hasModeClassName || extensions.some(extension => filename.endsWith(extension))
  })
}

/**
 * Keeps targets whose linked state matches the requested value.
 *
 * @param {ArticleEditorTarget[]} links
 * @param {LinkingMode} linkingMode
 * @param {boolean} isLinked
 * @returns {ArticleEditorTarget[]}
 */
export function filterLinksByLinkedState(links, linkingMode, isLinked) {
  return links.filter(link => isLinkedTarget(link, linkingMode) === isLinked)
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
 * @param {ArticleEditorTarget} link
 * @returns {string}
 */
function getLinkUrl(link) {
  return link.href ?? link.src ?? ''
}

/**
 * Checks whether a target has already been linked by eGain.
 *
 * @param {ArticleEditorTarget} link
 * @param {LinkingMode} linkingMode
 * @returns {boolean}
 */
function isLinkedTarget(link, linkingMode) {
  if (linkingMode.targetType === 'article') {
    return link.classNames?.includes(LINKED_ARTICLE_CLASS_NAME) ?? false
  }

  return isLinkedMediaUrl(getLinkUrl(link))
}

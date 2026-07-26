import { connectToBrowser } from '../../../shared/browser/connect-to-browser.js'
import { getArticleEditorLocators } from '../../../shared/egain/editor/get-article-editor-locators.js'
import { extractArticleImages } from '../helpers/extract-article-images.js'
import { extractArticleLinks } from '../helpers/extract-article-links.js'
import { extractArticleReferenceLinks } from '../helpers/extract-article-reference-links.js'
import { highlightArticleImage } from '../helpers/highlight-article-image.js'
import { highlightArticleLink } from '../helpers/highlight-article-link.js'
import { insertArticleLink, insertMediaLink } from './insert-targets.js'
import { filterTargetsByLinkedState, filterTargetsByMode } from './linked-targets.js'
import { getLinkingMode } from './linking-modes.js'
import { findRequiredPage } from './required-pages.js'
import { restoreLinkedTargets } from './restore-linked-targets.js'

/**
 * @typedef {import('./linking-modes.js').LinkingMode} LinkingMode
 *
 * @typedef {{
 *   articleId?: string,
 *   classNames?: string[],
 *   displayName?: string,
 *   filename: string,
 *   href?: string,
 *   sourceIndex: number,
 *   text: string,
 * }} ArticleEditorLink
 *
 * @typedef {{
 *   alt?: string,
 *   filename: string,
 *   height?: string,
 *   sourceIndex: number,
 *   src?: string,
 *   style?: string,
 *   width?: string,
 * }} ArticleEditorImage
 *
 * @typedef {ArticleEditorLink | ArticleEditorImage} ArticleEditorTarget
 */

/**
 * Reads the source editor targets that match the selected automation mode.
 *
 * @param {import('playwright').Page} articlePage
 * @param {LinkingMode} linkingMode
 * @returns {Promise<ArticleEditorTarget[]>}
 */
async function extractTargetsForMode(articlePage, linkingMode) {
  if (linkingMode.targetType === 'image') {
    return extractArticleImages(articlePage)
  }

  if (linkingMode.targetType === 'article') {
    return extractArticleReferenceLinks(articlePage)
  }

  return extractArticleLinks(articlePage)
}

/**
 * The media server input field validates display names with a narrower character
 * set than the article editor supports. Use a temporary safe value there, then
 * restore the original article text during source HTML post-processing.
 *
 * @param {string} text
 * @param {string} filename
 * @returns {string}
 */
function getMediaDisplayName(text, filename) {
  const sanitize = value =>
    value
      .replace(/[^A-Za-z0-9 !\-_.*'()]/g, '')
      .replace(/\s+/g, ' ')
      .trim()

  const sanitizedText = sanitize(text)

  if (sanitizedText) return sanitizedText

  const filenameWithoutExtension = filename.replace(/\.[^.]+$/, '')

  return sanitize(filenameWithoutExtension) || 'Document'
}

/**
 * Reads the article editor source and counts targets matching the selected
 * mode without modifying the article editor.
 *
 * @param {import('playwright').Page[]} pages
 * @param {string} mode
 */
export async function analyzeArticleLinks(pages, mode = 'pdf') {
  const articlePage = findRequiredPage(pages, '/article/', 'an article page')
  const linkingMode = getLinkingMode(mode)
  const targets = await extractTargetsForMode(articlePage, linkingMode)
  const modeTargets = filterTargetsByMode(targets, mode)
  const unlinkedTargets = filterTargetsByLinkedState(modeTargets, linkingMode, false)
  const linkedTargets = filterTargetsByLinkedState(modeTargets, linkingMode, true)

  return { articlePage, linkedTargets, mode: linkingMode, targets, unlinkedTargets }
}

/**
 * Inserts media server links or inline images for matching article targets,
 * then restores source HTML details that the media server dialog cannot preserve.
 *
 * @param {{ pages: import('playwright').Page[] }} session
 * @param {string} mode
 */
export async function runMediaLinking({ pages }, mode = 'pdf') {
  const articlePage = findRequiredPage(pages, '/article/', 'an article page')
  const linkingMode = getLinkingMode(mode)
  const mediaPage = linkingMode.targetType === 'article' ? null : findRequiredPage(pages, '/media', 'a media page')

  const editorLocators = getArticleEditorLocators(articlePage)
  const { sourceEditor, editorBody, sourceButton } = editorLocators

  const targets = await extractTargetsForMode(articlePage, linkingMode)
  const modeTargets = filterTargetsByMode(targets, mode)
  const unlinkedTargetsBeforeRun = filterTargetsByLinkedState(modeTargets, linkingMode, false)
  const preparedTargets = unlinkedTargetsBeforeRun.map(target => {
    if (linkingMode.targetType === 'image' || linkingMode.targetType === 'article') {
      return target
    }

    return {
      ...target,
      displayName: getMediaDisplayName(target.text, target.filename),
    }
  })

  await sourceButton.click()

  let processedCount = 0
  const processedTargets = []
  const unlinkedTargets = []

  for (const target of preparedTargets) {
    if (linkingMode.targetType === 'image') {
      await highlightArticleImage(editorBody, target)
    } else {
      await highlightArticleLink(editorBody, target)
    }

    const inserted =
      linkingMode.targetType === 'article'
        ? await insertArticleLink(articlePage, target, editorLocators)
        : await insertMediaLink(mediaPage, target, linkingMode)

    if (inserted) {
      processedTargets.push(target)
      processedCount++
    } else {
      unlinkedTargets.push(target)
    }
  }

  await sourceButton.click()
  await restoreLinkedTargets(articlePage, sourceEditor, processedTargets, linkingMode)

  return {
    mode: linkingMode,
    processedCount,
    targets,
    unlinkedTargetCount: preparedTargets.length,
    unlinkedTargets,
    skippedCount: unlinkedTargets.length,
  }
}

/**
 * CLI-friendly entry point for running the media-linking workflow against an
 * existing Chrome DevTools Protocol endpoint.
 *
 * @param {string} cdpUrl
 * @param {string} mode
 */
export async function runMediaLinkingFromCdp(cdpUrl, mode = 'pdf') {
  const session = await connectToBrowser(cdpUrl)

  try {
    return await runMediaLinking(session, mode)
  } finally {
    await session.browser.close()
  }
}

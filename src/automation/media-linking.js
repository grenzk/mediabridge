import { connectToBrowser } from '../browser.js'
import { extractArticleImages } from '../helpers/extract-article-images.js'
import { extractArticleLinks } from '../helpers/extract-article-links.js'
import { extractArticleReferenceLinks } from '../helpers/extract-article-reference-links.js'
import { highlightArticleImage } from '../helpers/highlight-article-image.js'
import { highlightArticleLink } from '../helpers/highlight-article-link.js'
import { getEditorLocators } from '../editor/get-editor-locators.js'
import { filterLinksByLinkedState, filterLinksByMode } from './linked-targets.js'
import { getLinkingMode } from './linking-modes.js'
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
 * @typedef {{ href?: string, src?: string }} SourceUrlTarget
 * @typedef {{
 *   linkArticleButton: import('playwright').Locator,
 *   selectLinkArticleModal: import('playwright').Locator,
 * }} ArticleDialogLocators
 */

/**
 * @param {import('playwright').Page[]} pages
 * @param {string} urlPart
 * @param {string} pageName
 * @returns {import('playwright').Page}
 */
function findRequiredPage(pages, urlPart, pageName) {
  const page = pages.find(candidatePage => candidatePage.url().includes(urlPart))

  if (!page) {
    const openUrls = pages
      .map(candidatePage => candidatePage.url())
      .filter(Boolean)
      .join(', ')

    throw new Error(
      `Could not find ${pageName}. Open a tab with "${urlPart}" in the controlled browser. Open tabs: ${openUrls || 'none'}`,
    )
  }

  return page
}

/**
 * Reads the source editor targets that match the selected automation mode.
 *
 * @param {import('playwright').Page} articlePage
 * @param {LinkingMode} linkingMode
 * @returns {Promise<ArticleEditorTarget[]>}
 */
async function extractLinksForMode(articlePage, linkingMode) {
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
 * @param {LinkingMode} linkingMode
 * @returns {string}
 */
function getInsertActionLabel(linkingMode) {
  return linkingMode.targetType === 'image' ? 'Insert as inline image' : 'Insert as link'
}

/**
 * Opens the matching media server target and inserts it into the article editor.
 * Missing filenames are skipped instead of failing the whole run.
 *
 * @param {import('playwright').Page} mediaPage
 * @param {ArticleEditorTarget} link
 * @param {LinkingMode} linkingMode
 * @returns {Promise<boolean>} true when the media server target was inserted.
 */
async function insertMediaLink(mediaPage, link, linkingMode) {
  const file = mediaPage.locator('div.p-3').filter({ hasText: link.filename }).first()

  if ((await file.count()) === 0) {
    return false
  }

  await file.locator('.lucide-ellipsis-vertical').click()
  await mediaPage.getByText(getInsertActionLabel(linkingMode)).click()

  if (linkingMode.targetType !== 'image') {
    await mediaPage.getByPlaceholder('Enter display name').fill(link.displayName)
    await mediaPage.getByText('Insert').click()
  }

  return true
}

/**
 * Uses the eGain article-link dialog to resolve the selected editor anchor by
 * article ID. Missing search results are skipped so the run can continue.
 *
 * @param {import('playwright').Page} articlePage
 * @param {ArticleEditorLink} link
 * @param {ArticleDialogLocators} editorLocators
 * @returns {Promise<boolean>} true when the article was linked.
 */
async function insertArticleLink(articlePage, link, editorLocators) {
  const { linkArticleButton, selectLinkArticleModal } = editorLocators

  await linkArticleButton.click()
  await articlePage.waitForTimeout(500)
  await selectLinkArticleModal.locator('.btn-dropdown').click()
  await selectLinkArticleModal
    .getByText('Article ID', {
      exact: true,
    })
    .click()

  await selectLinkArticleModal.locator('.css-1uw98w5 input').fill(link.articleId)
  await articlePage.keyboard.press('Enter')

  const result = selectLinkArticleModal.getByText(link.articleId, { exact: true })

  try {
    await result.waitFor({ state: 'visible', timeout: 10000 })
  } catch {
    await selectLinkArticleModal.getByText('Cancel').click()

    return false
  }

  await result.click()
  await selectLinkArticleModal.getByText('OK', { exact: true }).click()

  return true
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
  const links = await extractLinksForMode(articlePage, linkingMode)
  const modeLinks = filterLinksByMode(links, mode)
  const documentLinks = filterLinksByLinkedState(modeLinks, linkingMode, false)
  const linkedLinks = filterLinksByLinkedState(modeLinks, linkingMode, true)

  return { articlePage, documentLinks, linkedLinks, links, mode: linkingMode }
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

  const editorLocators = getEditorLocators(articlePage)
  const { sourceEditor, editorBody, sourceButton } = editorLocators

  const links = await extractLinksForMode(articlePage, linkingMode)
  const modeLinks = filterLinksByMode(links, mode)
  const unlinkedLinks = filterLinksByLinkedState(modeLinks, linkingMode, false)
  const documentLinks = unlinkedLinks.map(link => {
    if (linkingMode.targetType === 'image' || linkingMode.targetType === 'article') {
      return link
    }

    return {
      ...link,
      displayName: getMediaDisplayName(link.text, link.filename),
    }
  })

  await sourceButton.click()

  let processedCount = 0
  const processedLinks = []
  const skippedTargets = []

  for (const link of documentLinks) {
    if (linkingMode.targetType === 'image') {
      await highlightArticleImage(editorBody, link)
    } else {
      await highlightArticleLink(editorBody, link)
    }

    const inserted =
      linkingMode.targetType === 'article'
        ? await insertArticleLink(articlePage, link, editorLocators)
        : await insertMediaLink(mediaPage, link, linkingMode)

    if (inserted) {
      processedLinks.push(link)
      processedCount++
    } else {
      skippedTargets.push(link)
    }
  }

  await sourceButton.click()
  await restoreLinkedTargets(articlePage, sourceEditor, processedLinks, linkingMode)

  return {
    documentLinks,
    links,
    mode: linkingMode,
    processedCount,
    skippedCount: skippedTargets.length,
    skippedTargets,
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

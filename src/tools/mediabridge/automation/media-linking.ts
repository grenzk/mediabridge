import type { Page } from 'playwright'
import { connectToBrowser } from '../../../shared/browser/connect-to-browser.ts'
import { getArticleEditorLocators } from '../../../shared/egain/editor/get-article-editor-locators.ts'
import { extractArticleImages } from '../helpers/extract-article-images.ts'
import { extractArticleLinks } from '../helpers/extract-article-links.ts'
import { extractArticleReferenceLinks } from '../helpers/extract-article-reference-links.ts'
import { highlightArticleImage } from '../helpers/highlight-article-image.ts'
import { highlightArticleLink } from '../helpers/highlight-article-link.ts'
import { insertArticleLink, insertMediaLink } from './insert-targets.ts'
import { filterTargetsByLinkedState, filterTargetsByMode } from './linked-targets.ts'
import { getLinkingMode } from './linking-modes.ts'
import { findRequiredPage } from './required-pages.ts'
import { restoreLinkedTargets } from './restore-linked-targets.ts'
import type { ArticleEditorImage, ArticleEditorLink, ArticleEditorTarget, LinkingMode } from '../types.ts'
import { throwIfAutomationCancelled } from '../../../shared/automation/cancellation.ts'

type MediaLinkingOptions = {
  signal?: AbortSignal
}

/**
 * Reads the source editor targets that match the selected automation mode.
 */
async function extractTargetsForMode(articlePage: Page, linkingMode: LinkingMode): Promise<ArticleEditorTarget[]> {
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
 */
function getMediaDisplayName(text: string, filename: string) {
  const sanitize = (value: string) =>
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
 */
export async function analyzeArticleLinks(pages: Page[], mode: string = 'pdf') {
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
 */
export async function runMediaLinking(
  { pages }: { pages: Page[] },
  mode: string = 'pdf',
  options: MediaLinkingOptions = {},
) {
  const { signal } = options

  throwIfAutomationCancelled(signal)

  const articlePage = findRequiredPage(pages, '/article/', 'an article page')
  const linkingMode = getLinkingMode(mode)
  const mediaPage = linkingMode.targetType === 'article' ? null : findRequiredPage(pages, '/media', 'a media page')

  const editorLocators = getArticleEditorLocators(articlePage)
  const { sourceEditor, editorBody, sourceButton } = editorLocators

  const targets = await extractTargetsForMode(articlePage, linkingMode)
  const modeTargets = filterTargetsByMode(targets, mode)
  const unlinkedTargetsBeforeRun = filterTargetsByLinkedState(modeTargets, linkingMode, false)
  const preparedTargets: ArticleEditorTarget[] = unlinkedTargetsBeforeRun.map(target => {
    if (linkingMode.targetType === 'image' || linkingMode.targetType === 'article') {
      return target
    }

    return {
      ...target,
      displayName: getMediaDisplayName(target.text ?? '', target.filename),
    }
  })

  throwIfAutomationCancelled(signal)
  await sourceButton.click()

  let processedCount = 0
  let canceled = false
  const processedTargets: ArticleEditorTarget[] = []
  const unlinkedTargets: ArticleEditorTarget[] = []

  for (const target of preparedTargets) {
    if (signal?.aborted) {
      canceled = true
      break
    }

    if (linkingMode.targetType === 'image') {
      if (!isArticleEditorImage(target)) {
        throw new Error(`Invalid image target: ${target.filename}`)
      }

      await highlightArticleImage(editorBody, target)
    } else {
      if (!isArticleEditorLink(target)) {
        throw new Error(`Invalid link target: ${target.filename}`)
      }

      await highlightArticleLink(editorBody, target)
    }

    if (signal?.aborted) {
      canceled = true
      break
    }

    let inserted

    if (linkingMode.targetType === 'article') {
      inserted = await insertArticleLink(articlePage, target, editorLocators)
    } else {
      if (!mediaPage) {
        throw new Error('Could not find a media page for the selected linking mode.')
      }

      inserted = await insertMediaLink(mediaPage, target, linkingMode)
    }

    if (inserted) {
      processedTargets.push(target)
      processedCount++
    } else {
      unlinkedTargets.push(target)
    }

    if (signal?.aborted) {
      canceled = true
      break
    }
  }

  await sourceButton.click()
  await restoreLinkedTargets(articlePage, sourceEditor, processedTargets, linkingMode)
  canceled ||= signal?.aborted ?? false

  return {
    canceled,
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
 */
export async function runMediaLinkingFromCdp(cdpUrl: string, mode: string = 'pdf', options: MediaLinkingOptions = {}) {
  const session = await connectToBrowser(cdpUrl)

  try {
    return await runMediaLinking(session, mode, options)
  } finally {
    await session.browser.close()
  }
}

function isArticleEditorLink(target: ArticleEditorTarget): target is ArticleEditorLink {
  return typeof target.href === 'string' && typeof target.text === 'string'
}

function isArticleEditorImage(target: ArticleEditorTarget): target is ArticleEditorImage {
  return (
    typeof target.alt === 'string' &&
    typeof target.height === 'string' &&
    typeof target.src === 'string' &&
    typeof target.style === 'string' &&
    typeof target.width === 'string'
  )
}

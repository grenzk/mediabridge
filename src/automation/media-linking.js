import { connectToBrowser } from '../browser.js'
import { extractArticleImages } from '../helpers/extract-article-images.js'
import { extractArticleLinks } from '../helpers/extract-article-links.js'
import { extractArticleReferenceLinks } from '../helpers/extract-article-reference-links.js'
import { highlightArticleImage } from '../helpers/highlight-article-image.js'
import { highlightArticleLink } from '../helpers/highlight-article-link.js'
import { getEditorLocators } from '../editor/get-editor-locators.js'

const LINKING_MODES = {
  pdf: {
    className: 'pdf',
    extensions: ['.pdf'],
    label: 'PDF',
    preservedClassNames: {
      modifiers: ['downloadable'],
      replacements: ['dwg'],
    },
    targetType: 'link',
  },
  word: {
    className: 'doc',
    extensions: ['.doc', '.docx'],
    label: 'Word',
    targetType: 'link',
  },
  excel: {
    className: 'xls',
    extensions: ['.xls', '.xlsx'],
    label: 'Excel',
    targetType: 'link',
  },
  image: {
    extensions: ['.gif', '.jpeg', '.jpg', '.png'],
    label: 'Image',
    targetType: 'image',
  },
  article: {
    label: 'Article',
    targetType: 'article',
  },
}

const LINKED_MEDIA_ORIGIN = 'https://napsapps.egain.services'

/**
 * @param {import('playwright').Page[]} pages
 * @param {string} urlPart
 * @param {string} pageName
 * @returns {import('playwright').Page}
 */
function findRequiredPage(pages, urlPart, pageName) {
  const page = pages.find(item => item.url().includes(urlPart))

  if (!page) {
    const openUrls = pages
      .map(item => item.url())
      .filter(Boolean)
      .join(', ')

    throw new Error(
      `Could not find ${pageName}. Open a tab with "${urlPart}" in the controlled browser. Open tabs: ${openUrls || 'none'}`,
    )
  }

  return page
}

/**
 * @param {string} mode
 * @returns {{ className?: string, extensions?: string[], label: string, preservedClassNames?: { modifiers: string[], replacements: string[] }, targetType?: string }}
 */
function getLinkingMode(mode = 'pdf') {
  const linkingMode = LINKING_MODES[mode]

  if (!linkingMode) {
    throw new Error(`Unsupported linking mode: ${mode}`)
  }

  return linkingMode
}

/**
 * @param {{ filename: string }[]} items
 * @param {string} mode
 * @returns {{ filename: string }[]}
 */
function filterItemsByMode(items, mode = 'pdf') {
  const { extensions = [], targetType } = getLinkingMode(mode)

  if (targetType === 'article') {
    return items
  }

  return items.filter(item => {
    const filename = item.filename.toLowerCase()

    return extensions.some(extension => filename.endsWith(extension))
  })
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
 * @param {{ href?: string, src?: string }} item
 * @returns {string}
 */
function getItemUrl(item) {
  return item.href ?? item.src ?? ''
}

/**
 * Keeps only targets that still use dummy or non-media-service URLs.
 *
 * @param {{ href?: string, src?: string }[]} items
 * @returns {{ href?: string, src?: string }[]}
 */
function filterUnlinkedItems(items) {
  return items.filter(item => !isLinkedMediaUrl(getItemUrl(item)))
}

/**
 * Reads the source editor targets that match the selected automation mode.
 *
 * @param {import('playwright').Page} articlePage
 * @param {{ targetType?: string }} linkingMode
 */
async function extractItemsForMode(articlePage, linkingMode) {
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
 * @param {{ targetType?: string }} linkingMode
 * @returns {string}
 */
function getInsertActionLabel(linkingMode) {
  return linkingMode.targetType === 'image'
    ? 'Insert as inline image'
    : 'Insert as link'
}

/**
 * Opens the matching media-library item and inserts it into the article editor.
 * Missing filenames are skipped instead of failing the whole run.
 *
 * @param {import('playwright').Page} mediaPage
 * @param {{ displayName?: string, filename: string }} item
 * @param {{ targetType?: string }} linkingMode
 * @returns {Promise<boolean>} true when the item was inserted.
 */
async function insertMediaItem(mediaPage, item, linkingMode) {
  const file = mediaPage
    .locator('div.p-3')
    .filter({ hasText: item.filename })
    .first()

  if ((await file.count()) === 0) {
    return false
  }

  await file.locator('.lucide-ellipsis-vertical').click()
  await mediaPage.getByText(getInsertActionLabel(linkingMode)).click()

  if (linkingMode.targetType !== 'image') {
    await mediaPage.getByPlaceholder('Enter display name').fill(item.displayName)
    await mediaPage.getByText('Insert').click()
  }

  return true
}

/**
 * Uses the eGain article-link dialog to resolve the selected editor anchor by
 * article ID. Missing search results are skipped so the run can continue.
 *
 * @param {import('playwright').Page} articlePage
 * @param {{ articleId: string }} item
 * @param {{ linkArticleButton: import('playwright').Locator, selectLinkArticleModal: import('playwright').Locator }} editorLocators
 * @returns {Promise<boolean>} true when the article was linked.
 */
async function insertArticleLink(articlePage, item, editorLocators) {
  const { linkArticleButton, selectLinkArticleModal } = editorLocators

  await linkArticleButton.click()
  await articlePage.waitForTimeout(500)
  await selectLinkArticleModal.locator('.btn-dropdown').click()
  await selectLinkArticleModal.getByText('Article ID', { exact: true }).click()
  await selectLinkArticleModal.locator('.css-1uw98w5 input').fill(item.articleId)
  await articlePage.keyboard.press('Enter')

  const result = selectLinkArticleModal.getByText(item.articleId, { exact: true })

  try {
    await result.waitFor({ state: 'visible', timeout: 10000 })
  } catch {
    await selectLinkArticleModal.getByText('Cancel', { exact: true }).click()

    return false
  }

  await result.click()
  await selectLinkArticleModal.getByText('OK', { exact: true }).click()

  return true
}

/**
 * Updates the source editor value directly. This avoids Playwright's fill
 * action, which can hang on large CKEditor source textareas while still
 * notifying the editor that its value changed.
 *
 * @param {import('playwright').Locator} sourceEditor
 * @param {string} html
 */
async function setSourceEditorHtml(sourceEditor, html) {
  await sourceEditor.evaluate((element, html) => {
    element.value = html
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
  }, html)
}

/**
 * Restores source HTML details that the media dialog cannot preserve. Documents
 * get their class/original text restored; images get their original alt text
 * and inline size attributes.
 *
 * @param {import('playwright').Page} articlePage
 * @param {import('playwright').Locator} sourceEditor
 * @param {Array<object>} items
 * @param {{ className?: string, targetType?: string }} linkingMode
 */
async function restoreLinkedItems(articlePage, sourceEditor, items, linkingMode) {
  const html = await sourceEditor.inputValue()

  if (linkingMode.targetType === 'image') {
    const updatedHtml = await articlePage.evaluate(
      ({ html, images }) => {
        const template = document.createElement('template')
        template.innerHTML = html

        const allImages = [...template.content.querySelectorAll('img')]
        const updatedImages = new Set()

        const decodeFilename = filename => {
          try {
            return decodeURIComponent(filename)
          } catch {
            return filename
          }
        }

        const getImageFilename = image => {
          const src = image.getAttribute('src') ?? image.src

          try {
            const url = new URL(src, window.location.href)

            return decodeFilename(url.pathname.split('/').pop())
          } catch {
            return ''
          }
        }

        images.forEach(item => {
          let matchingIndex = -1

          if (allImages[item.sourceIndex] && !updatedImages.has(item.sourceIndex)) {
            matchingIndex = item.sourceIndex
          } else {
            matchingIndex = allImages.findIndex((image, index) => {
              if (updatedImages.has(index)) return false

              return getImageFilename(image) === item.filename
            })
          }

          if (matchingIndex !== -1) {
            const matchingImage = allImages[matchingIndex]

            updatedImages.add(matchingIndex)
            matchingImage.setAttribute('alt', item.alt)

            if (item.style) {
              matchingImage.setAttribute('style', item.style)
            }

            if (item.width) {
              matchingImage.setAttribute('width', item.width)
            }

            if (item.height) {
              matchingImage.setAttribute('height', item.height)
            }
          }
        })

        return template.innerHTML
      },
      { html, images: items },
    )

    await setSourceEditorHtml(sourceEditor, updatedHtml)

    return
  }

  const updatedHtml = await articlePage.evaluate(
    ({ html, links, className, preservedClassNames }) => {
      const template = document.createElement('template')
      template.innerHTML = html

      const anchors = [...template.content.querySelectorAll('a')]
      const updatedLinks = new Set()
      const modifierClassNameSet = new Set(preservedClassNames.modifiers)
      const replacementClassNameSet = new Set(preservedClassNames.replacements)

      links.forEach(item => {
        let matchingIndex = -1

        if (anchors[item.sourceIndex] && !updatedLinks.has(item.sourceIndex)) {
          matchingIndex = item.sourceIndex
        } else {
          matchingIndex = anchors.findIndex((link, index) => {
            if (updatedLinks.has(index)) return false

            const text = link.textContent.trim()

            return text === item.text || text === item.displayName
          })
        }

        if (matchingIndex !== -1) {
          const matchingLink = anchors[matchingIndex]

          updatedLinks.add(matchingIndex)

          const itemClassNames = item.classNames ?? []
          const replacementClassName = itemClassNames.find(name =>
            replacementClassNameSet.has(name),
          )
          const modifierClassNames = itemClassNames.filter(name =>
            modifierClassNameSet.has(name),
          )

          if (replacementClassName) {
            matchingLink.classList.add(replacementClassName)
          } else if (className) {
            matchingLink.classList.add(className)
          }

          if (modifierClassNames.length > 0) {
            matchingLink.classList.add(...modifierClassNames)
          }

          matchingLink.textContent = item.text
        }
      })

      return template.innerHTML
    },
    {
      className: linkingMode.className,
      html,
      links: items,
      preservedClassNames: linkingMode.preservedClassNames ?? {
        modifiers: [],
        replacements: [],
      },
    },
  )

  await setSourceEditorHtml(sourceEditor, updatedHtml)
}

/**
 * Reads the article editor source and counts media targets matching the
 * selected mode without modifying the article or media pages.
 *
 * @param {import('playwright').Page[]} pages
 * @param {string} mode
 */
export async function analyzeArticleLinks(pages, mode = 'pdf') {
  const articlePage = findRequiredPage(pages, '/article/', 'an article page')
  const linkingMode = getLinkingMode(mode)
  const links = await extractItemsForMode(articlePage, linkingMode)
  const modeItems = filterItemsByMode(links, mode)
  const documentLinks = linkingMode.targetType === 'article'
    ? modeItems
    : filterUnlinkedItems(modeItems)

  return { articlePage, documentLinks, links, mode: linkingMode }
}

/**
 * Inserts media-library links or inline images for matching article targets,
 * then restores source HTML details that the media dialog cannot preserve.
 *
 * @param {{ pages: import('playwright').Page[] }} session
 * @param {string} mode
 */
export async function runMediaLinking({ pages }, mode = 'pdf') {
  const articlePage = findRequiredPage(pages, '/article/', 'an article page')
  const linkingMode = getLinkingMode(mode)
  const mediaPage = linkingMode.targetType === 'article'
    ? null
    : findRequiredPage(pages, '/media', 'a media page')

  const editorLocators = getEditorLocators(articlePage)
  const { sourceEditor, editorBody, sourceButton } = editorLocators

  const links = await extractItemsForMode(articlePage, linkingMode)
  const modeItems = filterItemsByMode(links, mode)
  const unlinkedItems = linkingMode.targetType === 'article'
    ? modeItems
    : filterUnlinkedItems(modeItems)
  const documentLinks = unlinkedItems.map(item => {
    if (linkingMode.targetType === 'image' || linkingMode.targetType === 'article') {
      return item
    }

    return {
      ...item,
      displayName: getMediaDisplayName(item.text, item.filename),
    }
  })

  await sourceButton.click()

  let processedCount = 0
  const processedItems = []
  const skippedItems = []

  for (const link of documentLinks) {
    if (linkingMode.targetType === 'image') {
      await highlightArticleImage(editorBody, link)
    } else {
      await highlightArticleLink(editorBody, link)
    }

    const inserted = linkingMode.targetType === 'article'
      ? await insertArticleLink(articlePage, link, editorLocators)
      : await insertMediaItem(mediaPage, link, linkingMode)

    if (inserted) {
      processedItems.push(link)
      processedCount++
    } else {
      skippedItems.push(link)
    }
  }

  await sourceButton.click()
  await restoreLinkedItems(articlePage, sourceEditor, processedItems, linkingMode)

  return {
    documentLinks,
    links,
    mode: linkingMode,
    processedCount,
    skippedCount: skippedItems.length,
    skippedItems,
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

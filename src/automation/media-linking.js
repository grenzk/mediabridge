import { connectToBrowser } from '../browser.js'
import { extractArticleImages } from '../helpers/extract-article-images.js'
import { extractArticleLinks } from '../helpers/extract-article-links.js'
import { highlightArticleImage } from '../helpers/highlight-article-image.js'
import { highlightArticleLink } from '../helpers/highlight-article-link.js'
import { getEditorLocators } from '../editor/get-editor-locators.js'

const LINKING_MODES = {
  pdf: {
    className: 'pdf',
    extensions: ['.pdf'],
    label: 'PDF',
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
}

/**
 * @param {import('playwright').Page[]} pages
 * @param {string} urlPart
 * @param {string} pageName
 * @returns {import('playwright').Page}
 */
function findRequiredPage(pages, urlPart, pageName) {
  const page = pages.find(item => item.url().includes(urlPart))

  if (!page) {
    throw new Error(`Could not find ${pageName}. Open a tab with "${urlPart}" in the controlled browser.`)
  }

  return page
}

/**
 * @param {string} mode
 * @returns {{ className?: string, extensions: string[], label: string, targetType?: string }}
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
 */
function filterItemsByMode(items, mode = 'pdf') {
  const { extensions } = getLinkingMode(mode)

  return items.filter(item => {
    const filename = item.filename.toLowerCase()

    return extensions.some(extension => filename.endsWith(extension))
  })
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

function getInsertActionLabel(linkingMode) {
  return linkingMode.targetType === 'image'
    ? 'Insert as inline image'
    : 'Insert as link'
}

async function insertMediaItem(mediaPage, item, linkingMode) {
  const file = mediaPage.locator('div.p-3').filter({ hasText: item.filename })

  await file.locator('.lucide-ellipsis-vertical').click()
  await mediaPage.getByText(getInsertActionLabel(linkingMode)).click()

  if (linkingMode.targetType !== 'image') {
    await mediaPage.getByPlaceholder('Enter display name').fill(item.displayName)
    await mediaPage.getByText('Insert').click()
  }
}

async function restoreLinkedItems(articlePage, sourceEditor, items, linkingMode) {
  const html = await sourceEditor.inputValue()

  if (linkingMode.targetType === 'image') {
    const updatedHtml = await articlePage.evaluate(
      ({ html, images }) => {
        const parser = new DOMParser()
        const doc = parser.parseFromString(html, 'text/html')

        const allImages = [...doc.querySelectorAll('img')]
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
          }
        })

        return doc.body.innerHTML
      },
      { html, images: items },
    )

    await sourceEditor.fill(updatedHtml)

    return
  }

  const updatedHtml = await articlePage.evaluate(
    ({ html, links, className }) => {
      const parser = new DOMParser()
      const doc = parser.parseFromString(html, 'text/html')

      const anchors = [...doc.querySelectorAll('a')]
      const updatedLinks = new Set()

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
          matchingLink.classList.add(className)
          matchingLink.textContent = item.text
        }
      })

      return doc.body.innerHTML
    },
    { className: linkingMode.className, html, links: items },
  )

  await sourceEditor.fill(updatedHtml)
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
  const links = getLinkingMode(mode).targetType === 'image'
    ? await extractArticleImages(articlePage)
    : await extractArticleLinks(articlePage)
  const documentLinks = filterItemsByMode(links, mode)

  return { articlePage, documentLinks, links, mode: getLinkingMode(mode) }
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
  const mediaPage = findRequiredPage(pages, '/media', 'a media page')
  const linkingMode = getLinkingMode(mode)

  const { sourceEditor, editorBody, sourceButton } =
    getEditorLocators(articlePage)

  const links = linkingMode.targetType === 'image'
    ? await extractArticleImages(articlePage)
    : await extractArticleLinks(articlePage)
  const documentLinks = filterItemsByMode(links, mode).map(item => {
    if (linkingMode.targetType === 'image') {
      return item
    }

    return {
      ...item,
      displayName: getMediaDisplayName(item.text, item.filename),
    }
  })

  await sourceButton.click()

  let processedCount = 0

  for (const link of documentLinks) {
    if (linkingMode.targetType === 'image') {
      await highlightArticleImage(editorBody, link)
    } else {
      await highlightArticleLink(editorBody, link)
    }

    await insertMediaItem(mediaPage, link, linkingMode)
    processedCount++
  }

  await sourceButton.click()
  await restoreLinkedItems(articlePage, sourceEditor, documentLinks, linkingMode)

  return { documentLinks, links, mode: linkingMode, processedCount }
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

import { connectToBrowser } from '../browser.js'
import { extractArticleLinks } from '../helpers/extract-article-links.js'
import { highlightArticleLink } from '../helpers/highlight-article-link.js'
import { getEditorLocators } from '../editor/get-editor-locators.js'

const LINKING_MODES = {
  pdf: {
    className: 'pdf',
    extensions: ['.pdf'],
    label: 'PDF',
  },
  word: {
    className: 'doc',
    extensions: ['.doc', '.docx'],
    label: 'Word',
  },
  excel: {
    className: 'xls',
    extensions: ['.xls', '.xlsx'],
    label: 'Excel',
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
 * @returns {{ className: string, extensions: string[], label: string }}
 */
function getLinkingMode(mode = 'pdf') {
  const linkingMode = LINKING_MODES[mode]

  if (!linkingMode) {
    throw new Error(`Unsupported linking mode: ${mode}`)
  }

  return linkingMode
}

/**
 * @param {{ filename: string, href: string, sourceIndex: number, text: string }[]} links
 * @param {string} mode
 * @returns {{ filename: string, href: string, sourceIndex: number, text: string }[]}
 */
function filterLinksByMode(links, mode = 'pdf') {
  const { extensions } = getLinkingMode(mode)

  return links.filter(item => {
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

/**
 * Reads the article editor source and counts links matching the selected
 * document mode without modifying the article or media pages.
 *
 * @param {import('playwright').Page[]} pages
 * @param {string} mode
 */
export async function analyzeArticleLinks(pages, mode = 'pdf') {
  const articlePage = findRequiredPage(pages, '/article/', 'an article page')
  const links = await extractArticleLinks(articlePage)
  const documentLinks = filterLinksByMode(links, mode)

  return { articlePage, documentLinks, links, mode: getLinkingMode(mode) }
}

/**
 * Inserts media-library links for matching article links, then adds the
 * selected document class to matching anchors in the article editor source.
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

  const links = await extractArticleLinks(articlePage)
  const documentLinks = filterLinksByMode(links, mode).map(link => ({
    ...link,
    displayName: getMediaDisplayName(link.text, link.filename),
  }))

  await sourceButton.click()

  let processedCount = 0

  for (const link of documentLinks) {
    await highlightArticleLink(editorBody, link)

    const file = mediaPage.locator('div.p-3').filter({ hasText: link.filename })

    if (file) {
      await file.locator('.lucide-ellipsis-vertical').click()
      await mediaPage.getByText('Insert as link').click()
      await mediaPage.getByPlaceholder('Enter display name').fill(link.displayName)
      await mediaPage.getByText('Insert').click()
      processedCount++
    }
  }

  await sourceButton.click()

  const html = await sourceEditor.inputValue()
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
    { className: linkingMode.className, html, links: documentLinks },
  )

  await sourceEditor.fill(updatedHtml)

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

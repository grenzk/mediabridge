import { connectToBrowser } from '../browser.js'
import { extractArticleLinks } from '../helpers/extract-article-links.js'
import { highlightTextOccurrence } from '../helpers/highlight-text-occurrence.js'
import { getEditorLocators } from '../editor/get-editor-locators.js'

function findRequiredPage(pages, urlPart, pageName) {
  const page = pages.find(item => item.url().includes(urlPart))

  if (!page) {
    throw new Error(`Could not find ${pageName}. Open a tab with "${urlPart}" in the controlled browser.`)
  }

  return page
}

export async function analyzeArticleLinks(pages) {
  const articlePage = findRequiredPage(pages, '/article/', 'an article page')
  const links = await extractArticleLinks(articlePage)
  const pdfLinks = links.filter(item =>
    item.filename.toLowerCase().endsWith('.pdf'),
  )

  return { articlePage, links, pdfLinks }
}

export async function runMediaLinking({ pages }) {
  const articlePage = findRequiredPage(pages, '/article/', 'an article page')
  const mediaPage = findRequiredPage(pages, '/media', 'a media page')

  const { sourceEditor, editorBody, sourceButton } =
    getEditorLocators(articlePage)

  const links = await extractArticleLinks(articlePage)
  const pdfLinks = links.filter(item =>
    item.filename.toLowerCase().endsWith('.pdf'),
  )

  await sourceButton.click()

  const seen = new Map()
  let processedCount = 0

  for (const link of pdfLinks) {
    const targetText = link.text
    const occurrenceIndex = seen.get(link.text) ?? 0

    await highlightTextOccurrence(editorBody, targetText, occurrenceIndex)

    seen.set(targetText, occurrenceIndex + 1)

    const file = mediaPage.locator('div.p-3').filter({ hasText: link.filename })

    if (file) {
      await file.locator('.lucide-ellipsis-vertical').click()
      await mediaPage.getByText('Insert as link').click()
      await mediaPage.getByPlaceholder('Enter display name').fill(targetText)
      await mediaPage.getByText('Insert').click()
      processedCount++
    }
  }

  await sourceButton.click()

  const html = await sourceEditor.inputValue()
  const updatedHtml = await articlePage.evaluate(
    ({ html, links }) => {
      const parser = new DOMParser()
      const doc = parser.parseFromString(html, 'text/html')

      links.forEach(item => {
        ;[...doc.querySelectorAll('a')]
          .filter(link => link.textContent.trim() === item.text)
          .forEach(link => link.classList.add('pdf'))
      })

      return doc.body.innerHTML
    },
    { html, links: pdfLinks },
  )

  await sourceEditor.fill(updatedHtml)

  return { links, pdfLinks, processedCount }
}

export async function runMediaLinkingFromCdp(cdpUrl) {
  const session = await connectToBrowser(cdpUrl)

  try {
    return await runMediaLinking(session)
  } finally {
    await session.browser.close()
  }
}

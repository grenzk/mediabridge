import 'dotenv/config'
import { connectToBrowser } from '../browser.js'
import { extractArticleLinks } from '../helpers/extract-article-links.js'
import { highlightTextOccurrence } from '../helpers/highlight-text-occurrence.js'
import { getEditorLocators } from '../editor/get-editor-locators.js'

const { CDP_URL } = process.env
const { browser, context, pages } = await connectToBrowser(CDP_URL)

const articlePage = pages.find(page => page.url().includes('/article/'))
const mediaPage = pages.find(page => page.url().includes('/media'))

const { sourceEditor, editorBody, sourceButton } =
  getEditorLocators(articlePage)

const links = await extractArticleLinks(articlePage)

await sourceButton.click()

const seen = new Map()

for (const link of links) {
  if (!link.filename.includes('.pdf')) continue

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
  }
}

await sourceButton.click()

const html = await sourceEditor.inputValue()

const pdfLinks = links.filter(item =>
  item.filename.toLowerCase().endsWith('.pdf'),
)

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

await browser.close()

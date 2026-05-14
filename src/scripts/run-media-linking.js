import 'dotenv/config'
import { connectToBrowser } from '../browser.js'
import { extractArticleLinks } from '../helpers/extract-article-links.js'
import { highlightTextOccurrence } from '../helpers/highlight-text-occurrence.js'

const { CDP_URL } = process.env
const { browser, context, pages } = await connectToBrowser(CDP_URL)

const articlePage = pages[0]
const mediaPage = pages[1]

const links = await extractArticleLinks(articlePage)

const editorBody = articlePage
  .frameLocator('iframe[title="Editor, 202300000099963_key_param"]')
  .locator('body[contenteditable="true"]')

await articlePage.locator('#cke_16').click()

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

  await mediaPage.waitForTimeout(2000)
}

// await browser.close()

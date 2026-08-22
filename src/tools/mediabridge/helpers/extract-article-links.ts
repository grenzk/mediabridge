import type { Page } from 'playwright'
import type { ArticleEditorLink } from '../types.ts'

export async function extractArticleLinks(articlePage: Page, html: string): Promise<ArticleEditorLink[]> {
  const links = await articlePage.evaluate(html => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')

    const decodeFilename = (filename: string) => {
      try {
        return decodeURIComponent(filename)
      } catch {
        return filename
      }
    }

    return [...doc.querySelectorAll('a')].map((link, sourceIndex) => {
      const href = link.getAttribute('href') ?? link.href
      const url = new URL(href, window.location.href)
      const filename = decodeFilename(url.pathname.split('/').pop() ?? '')

      return {
        classNames: [...link.classList],
        filename,
        href,
        sourceIndex,
        text: link.textContent.trim(),
      }
    })
  }, html)

  return links
}

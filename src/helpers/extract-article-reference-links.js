import { getEditorLocators } from '../editor/get-editor-locators.js'

const ARTICLE_ID_PREFIX = 'ECV3'

/**
 * Reads article-link placeholders from the source editor. Content developers
 * can use either a direct article ID href or a dummy path ending with the ID.
 *
 * @param {import('playwright').Page} articlePage
 * @returns {Promise<{ articleId: string, classNames: string[], filename: string, href: string, sourceIndex: number, text: string }[]>}
 */
export async function extractArticleReferenceLinks(articlePage) {
  const { sourceEditor } = getEditorLocators(articlePage)

  const html = await sourceEditor.inputValue()

  const links = await articlePage.evaluate(
    ({ html, articleIdPrefix }) => {
      const parser = new DOMParser()
      const doc = parser.parseFromString(html, 'text/html')

      const decodePathPart = value => {
        try {
          return decodeURIComponent(value)
        } catch {
          return value
        }
      }

      const getArticleId = href => {
        const pathPart = decodePathPart(href.split('/').pop() ?? '')
          .split('?')[0]
          .split('#')[0]
          .trim()
        const articleIdStart = pathPart.toUpperCase().indexOf(articleIdPrefix)

        return articleIdStart !== -1 ? pathPart.slice(articleIdStart) : ''
      }

      return [...doc.querySelectorAll('a')].map((link, sourceIndex) => {
        const href = link.getAttribute('href') ?? ''
        const articleId = getArticleId(href)

        return {
          articleId,
          classNames: [...link.classList],
          filename: articleId,
          href,
          sourceIndex,
          text: link.textContent.trim(),
        }
      })
    },
    { articleIdPrefix: ARTICLE_ID_PREFIX, html },
  )

  return links
}

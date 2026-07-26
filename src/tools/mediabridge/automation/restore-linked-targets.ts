import type { Locator, Page } from 'playwright'
import type { ArticleEditorTarget, LinkingMode } from '../types.ts'

/**
 * Restores source HTML details that the media server dialog cannot preserve.
 * Documents get their class/original text restored; images get their original
 * alt text and inline size attributes.
 */
export async function restoreLinkedTargets(
  articlePage: Page,
  sourceEditor: Locator,
  targets: ArticleEditorTarget[],
  linkingMode: LinkingMode,
) {
  const html = await sourceEditor.inputValue()

  if (linkingMode.targetType === 'image') {
    const updatedHtml = await restoreImageTargets(articlePage, html, targets)

    await setSourceEditorHtml(sourceEditor, updatedHtml)

    return
  }

  const updatedHtml = await restoreLinkTargets(articlePage, html, targets, linkingMode)

  await setSourceEditorHtml(sourceEditor, updatedHtml)
}

/**
 * Updates the source editor value directly. This avoids Playwright's fill
 * action, which can hang on large CKEditor source textareas while still
 * notifying the editor that its value changed.
 */
async function setSourceEditorHtml(sourceEditor: Locator, html: string) {
  await sourceEditor.evaluate((element, html) => {
    const sourceTextArea = element as HTMLTextAreaElement

    sourceTextArea.value = html
    sourceTextArea.dispatchEvent(new Event('input', { bubbles: true }))
    sourceTextArea.dispatchEvent(new Event('change', { bubbles: true }))
  }, html)
}

/**
 * Restores image attributes captured before the media dialog replaced each image.
 */
async function restoreImageTargets(articlePage: Page, html: string, images: ArticleEditorTarget[]) {
  return articlePage.evaluate(
    ({ html, images }) => {
      const template = document.createElement('template')
      template.innerHTML = html

      const allImages = [...template.content.querySelectorAll('img')]
      const updatedImages = new Set<number>()

      const decodeFilename = (filename: string) => {
        try {
          return decodeURIComponent(filename)
        } catch {
          return filename
        }
      }

      const getImageFilename = (image: HTMLImageElement) => {
        const src = image.getAttribute('src') ?? image.src

        try {
          const url = new URL(src, window.location.href)

          return decodeFilename(url.pathname.split('/').pop() ?? '')
        } catch {
          return ''
        }
      }

      images.forEach(imageLink => {
        let matchingIndex = -1

        if (allImages[imageLink.sourceIndex] && !updatedImages.has(imageLink.sourceIndex)) {
          matchingIndex = imageLink.sourceIndex
        } else {
          matchingIndex = allImages.findIndex((image, index) => {
            if (updatedImages.has(index)) return false

            return getImageFilename(image) === imageLink.filename
          })
        }

        if (matchingIndex !== -1) {
          const matchingImage = allImages[matchingIndex]

          updatedImages.add(matchingIndex)
          matchingImage.setAttribute('alt', imageLink.alt ?? '')

          if (imageLink.style) {
            matchingImage.setAttribute('style', imageLink.style)
          }

          if (imageLink.width) {
            matchingImage.setAttribute('width', imageLink.width)
          }

          if (imageLink.height) {
            matchingImage.setAttribute('height', imageLink.height)
          }
        }
      })

      return template.innerHTML
    },
    { html, images },
  )
}

/**
 * Restores link text and class names captured before the media dialog replaced
 * each anchor.
 */
async function restoreLinkTargets(
  articlePage: Page,
  html: string,
  targets: ArticleEditorTarget[],
  linkingMode: LinkingMode,
) {
  return articlePage.evaluate(
    ({ html, targets, className, preservedClassNames }) => {
      const template = document.createElement('template')
      template.innerHTML = html

      const anchors = [...template.content.querySelectorAll('a')]
      const updatedLinks = new Set<number>()
      const modifierClassNameSet = new Set(preservedClassNames.modifiers)
      const replacementClassNameSet = new Set(preservedClassNames.replacements)

      targets.forEach(articleLink => {
        let matchingIndex = -1

        if (anchors[articleLink.sourceIndex] && !updatedLinks.has(articleLink.sourceIndex)) {
          matchingIndex = articleLink.sourceIndex
        } else {
          matchingIndex = anchors.findIndex((link, index) => {
            if (updatedLinks.has(index)) return false

            const text = link.textContent?.trim() ?? ''

            return text === articleLink.text || text === articleLink.displayName
          })
        }

        if (matchingIndex !== -1) {
          const matchingLink = anchors[matchingIndex]

          updatedLinks.add(matchingIndex)

          const linkClassNames = articleLink.classNames ?? []
          const replacementClassName = linkClassNames.find(name => replacementClassNameSet.has(name))
          const modifierClassNames = linkClassNames.filter(name => modifierClassNameSet.has(name))

          if (replacementClassName) {
            matchingLink.classList.add(replacementClassName)
          } else if (className) {
            matchingLink.classList.add(className)
          }

          if (modifierClassNames.length > 0) {
            matchingLink.classList.add(...modifierClassNames)
          }

          matchingLink.textContent = articleLink.text ?? ''
        }
      })

      return template.innerHTML
    },
    {
      className: linkingMode.className,
      html,
      targets,
      preservedClassNames: linkingMode.preservedClassNames ?? {
        modifiers: [],
        replacements: [],
      },
    },
  )
}

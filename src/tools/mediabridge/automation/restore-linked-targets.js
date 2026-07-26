/**
 * @typedef {import('./linking-modes.js').LinkingMode} LinkingMode
 * @typedef {{
 *   alt?: string,
 *   classNames?: string[],
 *   displayName?: string,
 *   filename: string,
 *   height?: string,
 *   sourceIndex: number,
 *   style?: string,
 *   text?: string,
 *   width?: string,
 * }} ArticleEditorTarget
 */

/**
 * Restores source HTML details that the media server dialog cannot preserve.
 * Documents get their class/original text restored; images get their original
 * alt text and inline size attributes.
 *
 * @param {import('playwright').Page} articlePage
 * @param {import('playwright').Locator} sourceEditor
 * @param {ArticleEditorTarget[]} targets
 * @param {LinkingMode} linkingMode
 */
export async function restoreLinkedTargets(articlePage, sourceEditor, targets, linkingMode) {
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
 * @param {import('playwright').Page} articlePage
 * @param {string} html
 * @param {ArticleEditorTarget[]} images
 * @returns {Promise<string>}
 */
async function restoreImageTargets(articlePage, html, images) {
  return articlePage.evaluate(
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
          matchingImage.setAttribute('alt', imageLink.alt)

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
 * @param {import('playwright').Page} articlePage
 * @param {string} html
 * @param {ArticleEditorTarget[]} targets
 * @param {LinkingMode} linkingMode
 * @returns {Promise<string>}
 */
async function restoreLinkTargets(articlePage, html, targets, linkingMode) {
  return articlePage.evaluate(
    ({ html, targets, className, preservedClassNames }) => {
      const template = document.createElement('template')
      template.innerHTML = html

      const anchors = [...template.content.querySelectorAll('a')]
      const updatedLinks = new Set()
      const modifierClassNameSet = new Set(preservedClassNames.modifiers)
      const replacementClassNameSet = new Set(preservedClassNames.replacements)

      targets.forEach(articleLink => {
        let matchingIndex = -1

        if (anchors[articleLink.sourceIndex] && !updatedLinks.has(articleLink.sourceIndex)) {
          matchingIndex = articleLink.sourceIndex
        } else {
          matchingIndex = anchors.findIndex((link, index) => {
            if (updatedLinks.has(index)) return false

            const text = link.textContent.trim()

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

          matchingLink.textContent = articleLink.text
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

/**
 * @typedef {'link' | 'image' | 'article'} LinkingTargetType
 *
 * @typedef {{
 *   className?: string,
 *   extensions?: string[],
 *   label: string,
 *   preservedClassNames?: { modifiers: string[], replacements: string[] },
 *   targetType?: LinkingTargetType,
 * }} LinkingMode
 */

/** @type {Record<string, LinkingMode>} */
export const LINKING_MODES = {
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

/**
 * @param {string} mode
 * @returns {LinkingMode}
 */
export function getLinkingMode(mode = 'pdf') {
  const linkingMode = LINKING_MODES[mode]

  if (!linkingMode) {
    throw new Error(`Unsupported linking mode: ${mode}`)
  }

  return linkingMode
}

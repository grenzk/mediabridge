import type { MediaBridgeLinkingMode } from '../../../shared/types/knowledgeworks'
import type { LinkingMode, LinkingModes } from '../types.ts'

export type { LinkingMode } from '../types.ts'

export const LINKING_MODES: LinkingModes = {
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
  powerpoint: {
    className: 'ppt',
    extensions: ['.ppt', '.pptx'],
    label: 'PowerPoint',
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

export function getLinkingMode(mode: string = 'pdf'): LinkingMode {
  const modeKey = mode as MediaBridgeLinkingMode
  const linkingMode = LINKING_MODES[modeKey]

  if (!linkingMode) {
    throw new Error(`Unsupported linking mode: ${mode}`)
  }

  return linkingMode
}

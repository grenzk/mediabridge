import type { MediaBridgeLinkingMode } from '../../shared/types/knowledgeworks'

export type LinkingTargetType = 'link' | 'image' | 'article'

export type PreservedClassNames = {
  modifiers: string[]
  replacements: string[]
}

export type LinkingMode = {
  className?: string
  extensions?: string[]
  label: string
  preservedClassNames?: PreservedClassNames
  targetType: LinkingTargetType
}

export type LinkingModes = Record<MediaBridgeLinkingMode, LinkingMode>

export type ArticleEditorTarget = {
  alt?: string
  articleId?: string
  classNames?: string[]
  displayName?: string
  filename: string
  height?: string
  href?: string
  sourceIndex: number
  src?: string
  style?: string
  text?: string
  width?: string
}

export type ArticleEditorLink = ArticleEditorTarget & {
  classNames: string[]
  href: string
  text: string
}

export type ArticleReferenceLink = ArticleEditorLink & {
  articleId: string
}

export type ArticleEditorImage = ArticleEditorTarget & {
  alt: string
  height: string
  src: string
  style: string
  width: string
}

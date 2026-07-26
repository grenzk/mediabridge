import { describe, expect, it } from 'vitest'
import {
  filterTargetsByLinkedState,
  filterTargetsByMode,
} from '../../../src/tools/mediabridge/automation/linked-targets.js'
import { getLinkingMode } from '../../../src/tools/mediabridge/automation/linking-modes.js'

function target(filename, options = {}) {
  return { classNames: [], filename, ...options }
}

describe('filterTargetsByMode', () => {
  const targets = [
    target('guide.PDF'),
    target('drawing-placeholder', { classNames: ['dwg'] }),
    target('procedure.doc'),
    target('procedure.docx'),
    target('data.xls'),
    target('data.xlsx'),
    target('slides.ppt'),
    target('slides.pptx'),
    target('diagram.jpg'),
    target('animation.gif'),
  ]

  it.each([
    ['pdf', ['guide.PDF', 'drawing-placeholder']],
    ['word', ['procedure.doc', 'procedure.docx']],
    ['excel', ['data.xls', 'data.xlsx']],
    ['powerpoint', ['slides.ppt', 'slides.pptx']],
    ['image', ['diagram.jpg', 'animation.gif']],
  ])('selects only %s targets', (mode, expectedFilenames) => {
    expect(filterTargetsByMode(targets, mode).map(link => link.filename)).toEqual(expectedFilenames)
  })

  it.each([
    ['pdf', 'pdf'],
    ['word', 'doc'],
    ['excel', 'xls'],
    ['powerpoint', 'ppt'],
  ])('recognizes the %s class when a linked URL has no file extension', (mode, className) => {
    const linkedTarget = target('asset-id', {
      classNames: [className],
      href: 'https://napsapps.egain.services/media-server/v1/asset/asset-id',
    })

    expect(filterTargetsByMode([linkedTarget], mode)).toEqual([linkedTarget])
  })

  it('recognizes linked articles and unlinked article IDs', () => {
    const articleTargets = [
      target('', { articleId: 'ECV3-12345' }),
      target('', { classNames: ['eGainArticleLink'] }),
      target('unrelated.pdf'),
    ]

    expect(filterTargetsByMode(articleTargets, 'article')).toEqual(articleTargets.slice(0, 2))
  })

  it('does not treat the downloadable modifier alone as a PDF', () => {
    expect(filterTargetsByMode([target('notes.txt', { classNames: ['downloadable'] })], 'pdf')).toEqual([])
  })
})

describe('filterTargetsByLinkedState', () => {
  it('separates linked media URLs from relative placeholders', () => {
    const mode = getLinkingMode('pdf')
    const relativeTarget = target('guide.pdf', { href: './documents/guide.pdf' })
    const linkedTarget = target('asset-id', {
      href: 'https://napsapps.egain.services/media-server/v1/asset/example?display=link',
    })

    expect(filterTargetsByLinkedState([relativeTarget, linkedTarget], mode, false)).toEqual([relativeTarget])
    expect(filterTargetsByLinkedState([relativeTarget, linkedTarget], mode, true)).toEqual([linkedTarget])
  })

  it('recognizes protocol-relative media URLs', () => {
    const linkedTarget = target('image.png', {
      src: '//napsapps.egain.services/media-server/public/inline/image.png',
    })

    expect(filterTargetsByLinkedState([linkedTarget], getLinkingMode('image'), true)).toEqual([linkedTarget])
  })

  it('does not accept lookalike or unrelated absolute origins', () => {
    const targets = [
      target('fake.pdf', { href: 'https://napsapps.egain.services.example.com/fake.pdf' }),
      target('external.pdf', { href: 'https://example.com/external.pdf' }),
    ]

    expect(filterTargetsByLinkedState(targets, getLinkingMode('pdf'), false)).toEqual(targets)
  })

  it('treats malformed absolute URLs as unlinked', () => {
    const malformedTarget = target('broken.pdf', { href: 'https://[' })

    expect(filterTargetsByLinkedState([malformedTarget], getLinkingMode('pdf'), false)).toEqual([malformedTarget])
  })

  it('uses the eGain article class to determine article linked state', () => {
    const unlinkedArticle = target('', { articleId: 'ECV3-12345' })
    const linkedArticle = target('', { classNames: ['eGainArticleLink'] })
    const mode = getLinkingMode('article')

    expect(filterTargetsByLinkedState([unlinkedArticle, linkedArticle], mode, false)).toEqual([unlinkedArticle])
    expect(filterTargetsByLinkedState([unlinkedArticle, linkedArticle], mode, true)).toEqual([linkedArticle])
  })
})

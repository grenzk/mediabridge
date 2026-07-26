import { describe, expect, it } from 'vitest'
import { LINKING_MODES, getLinkingMode } from '../../../src/tools/mediabridge/automation/linking-modes.js'

describe('linking modes', () => {
  it.each([
    ['pdf', 'PDF', ['.pdf'], 'pdf'],
    ['word', 'Word', ['.doc', '.docx'], 'doc'],
    ['excel', 'Excel', ['.xls', '.xlsx'], 'xls'],
    ['powerpoint', 'PowerPoint', ['.ppt', '.pptx'], 'ppt'],
  ])('defines the %s document mode', (mode, label, extensions, className) => {
    expect(getLinkingMode(mode)).toMatchObject({ className, extensions, label, targetType: 'link' })
  })

  it('defines image and article target types', () => {
    expect(LINKING_MODES.image).toMatchObject({
      extensions: ['.gif', '.jpeg', '.jpg', '.png'],
      label: 'Image',
      targetType: 'image',
    })
    expect(LINKING_MODES.article).toMatchObject({ label: 'Article', targetType: 'article' })
  })

  it('preserves PDF modifier and replacement classes', () => {
    expect(LINKING_MODES.pdf.preservedClassNames).toEqual({
      modifiers: ['downloadable'],
      replacements: ['dwg'],
    })
  })

  it('uses PDF as the default mode', () => {
    expect(getLinkingMode()).toBe(LINKING_MODES.pdf)
  })

  it('rejects unsupported modes', () => {
    expect(() => getLinkingMode('video')).toThrow('Unsupported linking mode: video')
  })
})

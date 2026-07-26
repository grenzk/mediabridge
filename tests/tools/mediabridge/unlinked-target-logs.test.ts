import { describe, expect, it } from 'vitest'
import { formatUnlinkedTargetsDetail } from '../../../electron/tools/mediabridge/unlinked-target-logs.ts'

describe('formatUnlinkedTargetsDetail', () => {
  it.each([undefined, null, [], 'invalid'])('returns no detail for an empty unlinked target value', unlinkedTargets => {
    expect(formatUnlinkedTargetsDetail({ unlinkedTargets })).toBe('')
  })

  it('formats unlinked media filenames and readable labels', () => {
    expect(
      formatUnlinkedTargetsDetail({
        mode: { targetType: 'link' },
        unlinkedTargets: [
          { displayName: 'User guide', filename: 'guide.pdf' },
          { alt: 'Parts diagram', filename: 'diagram.png' },
          { filename: 'same-name.docx', text: 'same-name.docx' },
        ],
      }),
    ).toBe(
      [
        'Unlinked media filenames:',
        '- guide.pdf (User guide)',
        '- diagram.png (Parts diagram)',
        '- same-name.docx',
      ].join('\n'),
    )
  })

  it('lists filenames for unlinked targets returned by the counter', () => {
    expect(
      formatUnlinkedTargetsDetail({
        mode: { targetType: 'link' },
        unlinkedTargets: [{ filename: 'guide.pdf' }, { filename: 'slides.pptx' }],
      }),
    ).toBe(['Unlinked media filenames:', '- guide.pdf', '- slides.pptx'].join('\n'))
  })

  it('formats unlinked article IDs', () => {
    expect(
      formatUnlinkedTargetsDetail({
        mode: { targetType: 'article' },
        unlinkedTargets: [{ articleId: 'ECV3-12345', text: 'Reset procedure' }, { articleId: 'ECV3-67890' }],
      }),
    ).toBe(['Unlinked article IDs:', '- ECV3-12345 (Reset procedure)', '- ECV3-67890'].join('\n'))
  })

  it('uses numbered fallbacks for malformed unlinked targets', () => {
    expect(
      formatUnlinkedTargetsDetail({
        mode: { targetType: 'link' },
        unlinkedTargets: [null, {}],
      }),
    ).toBe(['Unlinked media filenames:', '- target 1', '- target 2'].join('\n'))
  })
})

import { describe, expect, it } from 'vitest'
import { formatSkippedTargetsDetail } from '../../electron/skipped-target-logs.js'

describe('formatSkippedTargetsDetail', () => {
  it.each([undefined, null, [], 'invalid'])('returns no detail for an empty skipped target value', skippedTargets => {
    expect(formatSkippedTargetsDetail({ skippedTargets })).toBe('')
  })

  it('formats missing media filenames and readable labels', () => {
    expect(
      formatSkippedTargetsDetail({
        mode: { targetType: 'link' },
        skippedTargets: [
          { displayName: 'User guide', filename: 'guide.pdf' },
          { alt: 'Parts diagram', filename: 'diagram.png' },
          { filename: 'same-name.docx', text: 'same-name.docx' },
        ],
      }),
    ).toBe(
      ['Missing media filenames:', '- guide.pdf (User guide)', '- diagram.png (Parts diagram)', '- same-name.docx'].join(
        '\n',
      ),
    )
  })

  it('formats missing article IDs', () => {
    expect(
      formatSkippedTargetsDetail({
        mode: { targetType: 'article' },
        skippedTargets: [
          { articleId: 'ECV3-12345', text: 'Reset procedure' },
          { articleId: 'ECV3-67890' },
        ],
      }),
    ).toBe(['Missing article IDs:', '- ECV3-12345 (Reset procedure)', '- ECV3-67890'].join('\n'))
  })

  it('uses numbered fallbacks for malformed skipped targets', () => {
    expect(
      formatSkippedTargetsDetail({
        mode: { targetType: 'link' },
        skippedTargets: [null, {}],
      }),
    ).toBe(['Missing media filenames:', '- target 1', '- target 2'].join('\n'))
  })
})

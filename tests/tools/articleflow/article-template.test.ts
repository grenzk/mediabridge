import { describe, expect, it } from 'vitest'
import { findImportRoot } from '../../../src/tools/articleflow/automation/article-template.ts'
import type { EgainImportParent } from '../../../src/tools/articleflow/automation/ensure-folder-path.ts'

describe('findImportRoot', () => {
  it('uses the selected folder when it is the product root', () => {
    const selectedFolder: EgainImportParent = {
      ancestorPath: [{ id: 'archive', name: 'Zzz Archive' }],
      id: 'product',
      name: 'Sample Product',
    }

    expect(findImportRoot(selectedFolder, 'Sample Product')).toEqual(selectedFolder)
  })

  it('recovers the product root while a nested destination is selected', () => {
    const selectedFolder: EgainImportParent = {
      ancestorPath: [
        { id: 'archive', name: 'Zzz Archive' },
        { id: 'product', name: 'Sample Product' },
        { id: 'information', name: '[001]Product Information' },
      ],
      id: 'manuals',
      name: '[004]Manuals',
    }

    expect(findImportRoot(selectedFolder, 'Sample Product')).toEqual({
      ancestorPath: [{ id: 'archive', name: 'Zzz Archive' }],
      id: 'product',
      name: 'Sample Product',
    })
  })

  it('returns undefined when the selected path does not contain the product root', () => {
    const selectedFolder: EgainImportParent = {
      ancestorPath: [{ id: 'archive', name: 'Zzz Archive' }],
      id: 'other-product',
      name: 'Other Product',
    }

    expect(findImportRoot(selectedFolder, 'Sample Product')).toBeUndefined()
  })
})

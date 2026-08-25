import { describe, expect, it } from 'vitest'
import {
  deduplicateFolderReferences,
  ensureFolderPath,
  type EgainFolderReference,
  type EgainImportParent,
  type FolderTraversalCache,
} from '../../../src/tools/articleflow/automation/ensure-folder-path.ts'
import type { Page } from 'playwright'

describe('deduplicateFolderReferences', () => {
  it('collapses duplicate DOM entries that represent the same eGain folder', () => {
    const folders: EgainFolderReference[] = [
      { id: 'folder-1', name: 'Manuals' },
      { id: 'folder-1', name: 'Manuals' },
      { id: 'folder-2', name: 'Drawings' },
    ]

    expect(deduplicateFolderReferences(folders)).toEqual([
      { id: 'folder-1', name: 'Manuals' },
      { id: 'folder-2', name: 'Drawings' },
    ])
  })

  it('does not collapse different folder IDs that happen to share a name', () => {
    const folders: EgainFolderReference[] = [
      { id: 'folder-1', name: 'Manuals' },
      { id: 'folder-2', name: 'Manuals' },
    ]

    expect(deduplicateFolderReferences(folders)).toEqual(folders)
  })
})

describe('ensureFolderPath', () => {
  it('does not traverse a folder path that was already confirmed during the import', async () => {
    const importParent: EgainImportParent = { ancestorPath: [], id: 'archive', name: 'Zzz Archive' }
    const cache: FolderTraversalCache = new Map([
      [JSON.stringify(['Sample Product']), { id: 'product', name: 'Sample Product' }],
    ])

    await expect(ensureFolderPath({} as Page, importParent, ['Sample Product'], undefined, cache)).resolves.toBe(false)

    expect(cache.get(JSON.stringify([]))).toEqual({ id: 'archive', name: 'Zzz Archive' })
  })
})

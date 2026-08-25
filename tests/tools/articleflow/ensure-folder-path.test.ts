import { describe, expect, it, vi } from 'vitest'
import {
  deduplicateFolderReferences,
  ensureFolderPath,
  getSelectedFolderReference,
  type EgainFolderReference,
  type EgainImportParent,
  type FolderTraversalCache,
} from '../../../src/tools/articleflow/automation/ensure-folder-path.ts'
import type { Page } from 'playwright'

type FolderTreeEntryFixture = EgainFolderReference & {
  level: number
  parentId?: string
  selected: boolean
}

function createFolderTreePage(entries: FolderTreeEntryFixture[]): Page {
  const visibleFolderRows = {
    evaluateAll: vi.fn().mockResolvedValue(entries),
  }
  const folderRows = {
    filter: vi.fn().mockReturnValue(visibleFolderRows),
  }
  const activeLoaders = {
    count: vi.fn().mockResolvedValue(0),
  }

  return {
    locator: vi.fn((selector: string) => (selector.includes('loader') ? activeLoaders : folderRows)),
  } as unknown as Page
}

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

describe('getSelectedFolderReference', () => {
  it('returns the selected folder with its visible ancestor path', async () => {
    const articlePage = createFolderTreePage([
      { id: 'archive', level: 0, name: 'Zzz Archive', selected: false },
      { id: 'product', level: 1, name: 'Sample Product', parentId: 'archive', selected: false },
      { id: 'manuals', level: 2, name: 'Manuals', parentId: 'product', selected: true },
    ])

    await expect(getSelectedFolderReference(articlePage)).resolves.toEqual({
      ancestorPath: [
        { id: 'archive', name: 'Zzz Archive' },
        { id: 'product', name: 'Sample Product' },
      ],
      id: 'manuals',
      name: 'Manuals',
    })
  })

  it('rejects an ambiguous folder selection', async () => {
    const articlePage = createFolderTreePage([
      { id: 'archive', level: 0, name: 'Zzz Archive', selected: true },
      { id: 'product', level: 1, name: 'Sample Product', parentId: 'archive', selected: true },
    ])

    await expect(getSelectedFolderReference(articlePage)).rejects.toThrow(
      'Expected one selected eGain folder, but found 2.',
    )
  })
})

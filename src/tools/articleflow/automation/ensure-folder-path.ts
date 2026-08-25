import type { Page } from 'playwright'
import { throwIfAutomationCancelled } from '../../../shared/automation/cancellation.ts'
import { createChildFolder } from './create-folder.ts'
import { cacheFolderReference, getFolderPathKey, resolveDirectChild } from './folder-tree-navigation.ts'
import type { EgainImportParent, FolderTraversalCache } from './folder-tree-state.ts'

export { getSelectedFolderReference, selectFolderPath } from './folder-tree-navigation.ts'
export { deduplicateFolderReferences } from './folder-tree-state.ts'
export type { EgainFolderReference, EgainImportParent, FolderTraversalCache } from './folder-tree-state.ts'

/**
 * Recreates a folder path beneath the import parent. Existing direct children
 * are reused and missing children are created through the parent context menu.
 */
export async function ensureFolderPath(
  articlePage: Page,
  importParent: EgainImportParent,
  folderPath: string[],
  signal?: AbortSignal,
  cache: FolderTraversalCache = new Map(),
): Promise<boolean> {
  let createdFinalFolder = false

  cacheFolderReference(cache, [], importParent)

  for (const [index, folderName] of folderPath.entries()) {
    throwIfAutomationCancelled(signal)
    const parentPath = folderPath.slice(0, index)
    const childPath = [...parentPath, folderName]

    if (cache.has(getFolderPathKey(childPath))) {
      continue
    }

    const existingChild = await resolveDirectChild(articlePage, importParent, parentPath, folderName, signal, cache)

    if (existingChild) {
      cacheFolderReference(cache, childPath, existingChild)
      continue
    }

    const createdFolder = await createChildFolder(articlePage, importParent, parentPath, folderName, signal, cache)

    cacheFolderReference(cache, childPath, createdFolder)

    if (index === folderPath.length - 1) {
      createdFinalFolder = true
    }
  }

  return createdFinalFolder
}

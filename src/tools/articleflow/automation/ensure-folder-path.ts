import type { Locator, Page } from 'playwright'
import {
  getArticleFolderLocators,
  getCreateFolderFormLocators,
} from '../../../shared/egain/editor/get-article-editor-locators.ts'

const folderTreeRowSelector = 'tr[data-testid="grid-body-row-folders"]'
const selectedFolderRowSelector = `${folderTreeRowSelector}.selected-table-row`
const folderCellTestIdPrefix = 'grid-body-cell-folders-'
const folderUiTimeoutMs = 10000
const folderUiPollIntervalMs = 100

export type EgainFolderReference = {
  id: string
  name: string
}

type FolderSelection = {
  folder: EgainFolderReference
  row: Locator
}

/**
 * Returns the eGain folder selected when an ArticleFlow import starts.
 */
export async function getSelectedFolderReference(articlePage: Page): Promise<EgainFolderReference> {
  return (await getSelectedFolderSelection(articlePage)).folder
}

/**
 * Selects a folder path beneath the import parent, creating any missing direct
 * children through each parent's context menu. Returns whether the final folder
 * in the path was created.
 */
export async function ensureFolderPath(
  articlePage: Page,
  importParent: EgainFolderReference,
  folderPath: string[],
): Promise<boolean> {
  return walkFolderPath(articlePage, importParent, folderPath, true)
}

/**
 * Selects an existing folder path beneath the import parent.
 */
export async function selectFolderPath(
  articlePage: Page,
  importParent: EgainFolderReference,
  folderPath: string[],
): Promise<void> {
  await walkFolderPath(articlePage, importParent, folderPath, false)
}

async function walkFolderPath(
  articlePage: Page,
  importParent: EgainFolderReference,
  folderPath: string[],
  createMissingFolders: boolean,
) {
  let currentSelection = await selectFolderReference(articlePage, importParent)
  let createdFinalFolder = false

  for (const [index, folderName] of folderPath.entries()) {
    await expandFolderRow(articlePage, currentSelection.row, currentSelection.folder.name)

    const childRow = await findDirectChildFolderRow(articlePage, currentSelection.row, folderName)
    let childWasCreated = false

    if (childRow) {
      currentSelection = await selectFolderRow(articlePage, childRow, folderName)
    } else if (createMissingFolders) {
      currentSelection = await createChildFolder(articlePage, currentSelection, folderName)
      childWasCreated = true
    } else {
      throw new Error(`Could not find folder "${folderName}" directly under "${currentSelection.folder.name}".`)
    }

    if (index === folderPath.length - 1) {
      createdFinalFolder = childWasCreated
    }
  }

  return createdFinalFolder
}

async function createChildFolder(
  articlePage: Page,
  parentSelection: FolderSelection,
  folderName: string,
): Promise<FolderSelection> {
  const selectedParent = await selectFolderReference(articlePage, parentSelection.folder)
  const { addFolderMenuItem, contextMenuButton } = getArticleFolderLocators(
    selectedParent.row,
    selectedParent.folder.name,
  )

  await requireUniqueLocator(contextMenuButton, `context menu for folder "${selectedParent.folder.name}"`)

  if (!(await addFolderMenuItem.isVisible())) {
    await contextMenuButton.click()
  }

  await requireUniqueLocator(addFolderMenuItem, `Add action for folder "${selectedParent.folder.name}"`)
  await addFolderMenuItem.waitFor({ state: 'visible' })
  await addFolderMenuItem.click()

  const { backButton, heading, nameInput, saveButton } = getCreateFolderFormLocators(articlePage)

  await requireUniqueLocator(heading, 'Create Folder heading')

  if (getFolderIdFromUrl(articlePage.url()) !== selectedParent.folder.id || !isCreateFolderUrl(articlePage.url())) {
    throw new Error(`The Create Folder form did not open under "${selectedParent.folder.name}".`)
  }

  await requireUniqueLocator(nameInput, 'Create Folder name input')
  await nameInput.fill(folderName)
  await requireUniqueLocator(saveButton, 'Create Folder Save button')
  await saveButton.click()

  await requireUniqueLocator(backButton, 'Create Folder Back button')
  await backButton.click()
  await heading.waitFor({ state: 'hidden' })
  await articlePage.getByRole('heading', { exact: true, name: 'Folders' }).waitFor({ state: 'visible' })

  const selectedFolder = await getSelectedFolderSelection(articlePage)

  if (selectedFolder.folder.name === folderName) {
    return selectedFolder
  }

  const restoredParent = await selectFolderReference(articlePage, selectedParent.folder)

  await expandFolderRow(articlePage, restoredParent.row, restoredParent.folder.name)

  const createdFolderRow = await waitForDirectChildFolderRow(articlePage, restoredParent.row, folderName)

  return selectFolderRow(articlePage, createdFolderRow, folderName)
}

async function selectFolderReference(articlePage: Page, folder: EgainFolderReference): Promise<FolderSelection> {
  const selectedFolder = await getSelectedFolderSelection(articlePage)

  if (selectedFolder.folder.id === folder.id) {
    return selectedFolder
  }

  const folderRow = getFolderRowById(articlePage, folder.id)

  await requireUniqueLocator(folderRow, `folder "${folder.name}"`)

  return selectFolderRow(articlePage, folderRow, folder.name)
}

async function selectFolderRow(articlePage: Page, folderRow: Locator, folderName: string): Promise<FolderSelection> {
  const { cell } = getArticleFolderLocators(folderRow, folderName)

  await requireUniqueLocator(cell, `folder "${folderName}"`)
  await cell.click()

  return waitForSelectedFolder(articlePage, folderName)
}

async function getSelectedFolderSelection(articlePage: Page): Promise<FolderSelection> {
  const row = articlePage.locator(selectedFolderRowSelector)

  await requireUniqueLocator(row, 'selected eGain folder')

  const name = await getFolderName(row)
  const contextMenuIcon = row.locator('[id^="ic-dot-menu-"][id$="-context"]')

  await requireUniqueLocator(contextMenuIcon, `context menu marker for folder "${name}"`)

  const contextMenuIconId = await contextMenuIcon.getAttribute('id')
  const id = contextMenuIconId?.match(/^ic-dot-menu-(.+)-context$/)?.[1]

  if (!id) {
    throw new Error(`Could not determine the eGain folder ID for "${name}".`)
  }

  return { folder: { id, name }, row }
}

async function waitForSelectedFolder(articlePage: Page, expectedName: string): Promise<FolderSelection> {
  const deadline = Date.now() + folderUiTimeoutMs
  let actualName = ''

  while (Date.now() < deadline) {
    const selectedRows = articlePage.locator(selectedFolderRowSelector)

    if ((await selectedRows.count()) === 1) {
      actualName = await getFolderName(selectedRows)

      if (actualName === expectedName) {
        return getSelectedFolderSelection(articlePage)
      }
    }

    await articlePage.waitForTimeout(folderUiPollIntervalMs)
  }

  throw new Error(`Expected eGain to select folder "${expectedName}", but found "${actualName || 'none'}".`)
}

async function expandFolderRow(articlePage: Page, folderRow: Locator, folderName: string) {
  const { collapseButton, expandButton } = getArticleFolderLocators(folderRow, folderName)
  const collapseButtonCount = await collapseButton.count()
  const expandButtonCount = await expandButton.count()

  if (collapseButtonCount > 1 || expandButtonCount > 1) {
    throw new Error(`Expected one hierarchy control for folder "${folderName}".`)
  }

  if (collapseButtonCount === 1 || expandButtonCount === 0) {
    return
  }

  await expandButton.click()
  await collapseButton.waitFor({ state: 'visible' })

  const deadline = Date.now() + folderUiTimeoutMs

  while (Date.now() < deadline) {
    if ((await getDirectChildFolderRowIds(folderRow)).length > 0) {
      return
    }

    await articlePage.waitForTimeout(folderUiPollIntervalMs)
  }

  throw new Error(`Folder "${folderName}" expanded, but its child folders did not load.`)
}

async function findDirectChildFolderRow(
  articlePage: Page,
  parentRow: Locator,
  folderName: string,
): Promise<Locator | null> {
  const matchingRowIds = await getDirectChildFolderRowIds(parentRow, folderName)

  if (matchingRowIds.length > 1) {
    throw new Error(`Found multiple folders named "${folderName}" under the same eGain parent.`)
  }

  return matchingRowIds[0] ? articlePage.locator(`tr[id="${matchingRowIds[0]}"]`) : null
}

async function waitForDirectChildFolderRow(
  articlePage: Page,
  parentRow: Locator,
  folderName: string,
): Promise<Locator> {
  const deadline = Date.now() + folderUiTimeoutMs

  while (Date.now() < deadline) {
    const childRow = await findDirectChildFolderRow(articlePage, parentRow, folderName)

    if (childRow) {
      return childRow
    }

    await articlePage.waitForTimeout(folderUiPollIntervalMs)
  }

  throw new Error(`eGain did not display the newly created folder "${folderName}".`)
}

async function getDirectChildFolderRowIds(parentRow: Locator, folderName?: string): Promise<string[]> {
  return parentRow.evaluate(
    (row, options) => {
      const levelMatch = row.className.match(/\blevel-(\d+)\b/)

      if (!levelMatch) {
        return []
      }

      const parentLevel = Number(levelMatch[1])
      const matchingRowIds: string[] = []
      let sibling = row.nextElementSibling

      while (sibling?.tagName === 'TR') {
        const siblingLevelMatch = sibling.className.match(/\blevel-(\d+)\b/)

        if (!siblingLevelMatch) {
          sibling = sibling.nextElementSibling
          continue
        }

        const siblingLevel = Number(siblingLevelMatch[1])

        if (siblingLevel <= parentLevel) {
          break
        }

        if (siblingLevel === parentLevel + 1) {
          const folderCell = sibling.querySelector<HTMLElement>(`[data-testid^="${options.folderCellTestIdPrefix}"]`)
          const childTestId = folderCell?.getAttribute('data-testid')
          const childName = childTestId?.slice(options.folderCellTestIdPrefix.length)

          if ((!options.folderName || childName === options.folderName) && sibling.id) {
            matchingRowIds.push(sibling.id)
          }
        }

        sibling = sibling.nextElementSibling
      }

      return matchingRowIds
    },
    { folderCellTestIdPrefix, folderName },
  )
}

function getFolderRowById(articlePage: Page, folderId: string): Locator {
  if (!/^[A-Za-z0-9_-]+$/.test(folderId)) {
    throw new Error(`Unsupported eGain folder ID: ${folderId}`)
  }

  return articlePage.locator(
    `${folderTreeRowSelector}:has([id*="-${folderId}-folder-tree-comp"]), ` +
      `${folderTreeRowSelector}:has([id="ic-dot-menu-${folderId}-context"])`,
  )
}

async function getFolderName(folderRow: Locator): Promise<string> {
  const folderCell = folderRow.locator(`[data-testid^="${folderCellTestIdPrefix}"]`)

  await requireUniqueLocator(folderCell, 'folder name cell')

  const testId = await folderCell.getAttribute('data-testid')
  const folderName = testId?.slice(folderCellTestIdPrefix.length)

  if (!folderName) {
    throw new Error('Could not determine the selected eGain folder name.')
  }

  return folderName
}

function getFolderIdFromUrl(value: string): string | undefined {
  try {
    const { pathname } = new URL(value)

    return pathname.match(/\/folder\/([^/]+)(?:\/create)?\/?$/)?.[1]
  } catch {
    return undefined
  }
}

function isCreateFolderUrl(value: string): boolean {
  try {
    return /\/create\/?$/.test(new URL(value).pathname)
  } catch {
    return false
  }
}

async function requireUniqueLocator(locator: Locator, description: string) {
  let matchCount = await locator.count()

  if (matchCount === 0) {
    await locator.waitFor({ state: 'visible' })
    matchCount = await locator.count()
  }

  if (matchCount !== 1) {
    throw new Error(`Expected one ${description}, but found ${matchCount}.`)
  }
}

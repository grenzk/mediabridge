import type { Locator, Page } from 'playwright'
import {
  getArticleFolderLocators,
  getCreateFolderFormLocators,
} from '../../../shared/egain/editor/get-article-editor-locators.ts'

const folderTreeRowSelector = 'tr[data-testid="grid-body-row-folders"]'
const selectedFolderRowSelector = `${folderTreeRowSelector}.selected-table-row`
const folderCellTestIdPrefix = 'grid-body-cell-folders-'
const activeFolderLoaderSelector = '[data-testid="loader"].loader-container-show:visible'
const folderUiTimeoutMs = 60000
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
    currentSelection = await restoreFolderPath(
      articlePage,
      importParent,
      folderPath.slice(0, index),
      currentSelection,
    )
    currentSelection = await expandFolderSelection(articlePage, currentSelection)

    const childRow = await findDirectChildFolderRow(articlePage, currentSelection.row, folderName)
    let childWasCreated = false

    if (childRow) {
      currentSelection = await selectFolderRow(articlePage, childRow, folderName)
    } else if (createMissingFolders) {
      currentSelection = await createChildFolder(
        articlePage,
        importParent,
        folderPath.slice(0, index),
        currentSelection,
        folderName,
      )
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
  importParent: EgainFolderReference,
  parentPath: string[],
  parentSelection: FolderSelection,
  folderName: string,
): Promise<FolderSelection> {
  const selectedParent = await restoreFolderPath(articlePage, importParent, parentPath, parentSelection)
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

  const restoredParent = await restoreFolderPath(articlePage, importParent, parentPath)

  const createdFolderRow = await waitForDirectChildFolderRow(
    articlePage,
    restoredParent,
    folderName,
  )

  return selectFolderRow(articlePage, createdFolderRow, folderName)
}

/**
 * Reopens a known path from the stable import parent after eGain rerenders or
 * collapses the folder tree.
 */
async function restoreFolderPath(
  articlePage: Page,
  importParent: EgainFolderReference,
  folderPath: string[],
  currentSelection?: FolderSelection,
): Promise<FolderSelection> {
  await waitForFolderUiReady(articlePage)

  if (currentSelection && (await currentSelection.row.count()) === 1) {
    return selectFolderReference(articlePage, currentSelection.folder)
  }

  let restoredSelection = await selectFolderReference(articlePage, importParent)

  for (const folderName of folderPath) {
    restoredSelection = await expandFolderSelection(articlePage, restoredSelection)

    const childRow = await waitForDirectChildFolderRow(articlePage, restoredSelection, folderName)

    restoredSelection = await selectFolderRow(articlePage, childRow, folderName)
  }

  return restoredSelection
}

async function selectFolderReference(articlePage: Page, folder: EgainFolderReference): Promise<FolderSelection> {
  const folderRow = getFolderRowById(articlePage, folder.id)

  await requireUniqueLocator(folderRow, `folder "${folder.name}"`)

  if (await isFolderRowSelected(folderRow)) {
    return { folder, row: folderRow }
  }

  return selectFolderRow(articlePage, folderRow, folder.name)
}

async function selectFolderRow(articlePage: Page, folderRow: Locator, folderName: string): Promise<FolderSelection> {
  const folder = await getFolderReference(folderRow)

  if (folder.name !== folderName) {
    throw new Error(`Expected folder "${folderName}", but found "${folder.name}".`)
  }

  if (await isFolderRowSelected(folderRow)) {
    return { folder, row: folderRow }
  }

  const { cell } = getArticleFolderLocators(folderRow, folderName)

  await waitForFolderUiReady(articlePage)
  await requireUniqueLocator(cell, `folder "${folderName}"`)
  await cell.click({ timeout: folderUiTimeoutMs })

  return waitForSelectedFolder(articlePage, folder)
}

async function getSelectedFolderSelection(articlePage: Page): Promise<FolderSelection> {
  const row = articlePage.locator(selectedFolderRowSelector)

  await requireUniqueLocator(row, 'selected eGain folder')

  return { folder: await getFolderReference(row), row }
}

async function getFolderReference(folderRow: Locator): Promise<EgainFolderReference> {
  const { contextMenuIconIds, folderCellTestIds } = await folderRow.evaluate(
    (row, options) => {
      const belongsToCurrentRow = (element: Element) => element.closest(options.folderTreeRowSelector) === row

      const folderCellTestIds = Array.from(
        row.querySelectorAll<HTMLElement>(`[data-testid^="${options.folderCellTestIdPrefix}"]`),
      )
        .filter(belongsToCurrentRow)
        .map(element => element.getAttribute('data-testid'))
        .filter((value): value is string => Boolean(value))

      const contextMenuIconIds = Array.from(
        row.querySelectorAll<HTMLElement>('[id^="ic-dot-menu-"][id$="-context"]'),
      )
        .filter(belongsToCurrentRow)
        .map(element => element.id)
        .filter(Boolean)

      return { contextMenuIconIds, folderCellTestIds }
    },
    { folderCellTestIdPrefix, folderTreeRowSelector },
  )

  if (folderCellTestIds.length !== 1) {
    throw new Error(`Expected one folder name cell, but found ${folderCellTestIds.length}.`)
  }

  const name = folderCellTestIds[0].slice(folderCellTestIdPrefix.length)

  if (!name) {
    throw new Error('Could not determine the selected eGain folder name.')
  }

  if (contextMenuIconIds.length !== 1) {
    throw new Error(`Expected one context menu marker for folder "${name}", but found ${contextMenuIconIds.length}.`)
  }

  const contextMenuIconId = contextMenuIconIds[0]
  const id = contextMenuIconId?.match(/^ic-dot-menu-(.+)-context$/)?.[1]

  if (!id) {
    throw new Error(`Could not determine the eGain folder ID for "${name}".`)
  }

  return { id, name }
}

async function waitForSelectedFolder(
  articlePage: Page,
  expectedFolder: EgainFolderReference,
): Promise<FolderSelection> {
  const deadline = Date.now() + folderUiTimeoutMs
  let actualName = ''

  while (Date.now() < deadline) {
    const selectedRows = articlePage.locator(selectedFolderRowSelector)

    if ((await selectedRows.count()) === 1) {
      const actualFolder = await getFolderReference(selectedRows)

      actualName = actualFolder.name

      if (actualFolder.id === expectedFolder.id) {
        await waitForFolderUiReady(articlePage)

        return { folder: actualFolder, row: getFolderRowById(articlePage, actualFolder.id) }
      }
    }

    await articlePage.waitForTimeout(folderUiPollIntervalMs)
  }

  throw new Error(`Expected eGain to select folder "${expectedFolder.name}", but found "${actualName || 'none'}".`)
}

async function expandFolderSelection(
  articlePage: Page,
  selection: FolderSelection,
): Promise<FolderSelection> {
  await waitForFolderUiReady(articlePage)

  const folderRow = getFolderRowById(articlePage, selection.folder.id)

  await requireUniqueLocator(folderRow, `folder "${selection.folder.name}"`)

  const { collapseButton, expandButton } = getArticleFolderLocators(folderRow, selection.folder.name)
  const collapseButtonCount = await collapseButton.count()
  const expandButtonCount = await expandButton.count()

  if (collapseButtonCount > 1 || expandButtonCount > 1) {
    throw new Error(`Expected one hierarchy control for folder "${selection.folder.name}".`)
  }

  if (await collapseButton.isVisible()) {
    return { folder: selection.folder, row: folderRow }
  }

  if (!(await expandButton.isVisible())) {
    return { folder: selection.folder, row: folderRow }
  }

  await expandButton.click({ timeout: folderUiTimeoutMs })
  await collapseButton.waitFor({ state: 'visible' })

  const deadline = Date.now() + folderUiTimeoutMs

  while (Date.now() < deadline) {
    const refreshedRow = getFolderRowById(articlePage, selection.folder.id)

    if ((await refreshedRow.count()) === 1 && (await getDirectChildFolderIds(refreshedRow)).length > 0) {
      await waitForFolderUiReady(articlePage)

      return { folder: selection.folder, row: refreshedRow }
    }

    await articlePage.waitForTimeout(folderUiPollIntervalMs)
  }

  throw new Error(`Folder "${selection.folder.name}" expanded, but its child folders did not load.`)
}

async function findDirectChildFolderRow(
  articlePage: Page,
  parentRow: Locator,
  folderName: string,
): Promise<Locator | null> {
  const matchingFolderIds = await getDirectChildFolderIds(parentRow, folderName)

  if (matchingFolderIds.length > 1) {
    throw new Error(`Found multiple folders named "${folderName}" under the same eGain parent.`)
  }

  return matchingFolderIds[0] ? getFolderRowById(articlePage, matchingFolderIds[0]) : null
}

async function waitForDirectChildFolderRow(
  articlePage: Page,
  parentSelection: FolderSelection,
  folderName: string,
): Promise<Locator> {
  const deadline = Date.now() + folderUiTimeoutMs

  while (Date.now() < deadline) {
    const expandedParent = await expandFolderSelection(articlePage, parentSelection)
    const childRow = await findDirectChildFolderRow(articlePage, expandedParent.row, folderName)

    if (childRow) {
      return childRow
    }

    await articlePage.waitForTimeout(folderUiPollIntervalMs)
  }

  throw new Error(`eGain did not display the newly created folder "${folderName}".`)
}

async function isFolderRowSelected(folderRow: Locator): Promise<boolean> {
  const className = await folderRow.getAttribute('class')

  return className?.split(/\s+/).includes('selected-table-row') ?? false
}

async function waitForFolderUiReady(articlePage: Page): Promise<void> {
  const activeLoaders = articlePage.locator(activeFolderLoaderSelector)
  const deadline = Date.now() + folderUiTimeoutMs

  while (Date.now() < deadline) {
    if ((await activeLoaders.count()) === 0) {
      return
    }

    await articlePage.waitForTimeout(folderUiPollIntervalMs)
  }

  throw new Error('eGain did not finish loading the folder workspace.')
}

async function getDirectChildFolderIds(parentRow: Locator, folderName?: string): Promise<string[]> {
  return parentRow.evaluate(
    (row, options) => {
      const levelMatch = row.className.match(/\blevel-(\d+)\b/)

      if (!levelMatch) {
        return []
      }

      const parentLevel = Number(levelMatch[1])
      const matchingFolderIds: string[] = []
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
          const folderCell = Array.from(
            sibling.querySelectorAll<HTMLElement>(`[data-testid^="${options.folderCellTestIdPrefix}"]`),
          ).find(element => element.closest(options.folderTreeRowSelector) === sibling)
          const childTestId = folderCell?.getAttribute('data-testid')
          const childName = childTestId?.slice(options.folderCellTestIdPrefix.length)

          if (!options.folderName || childName === options.folderName) {
            const contextMenuIcon = Array.from(
              sibling.querySelectorAll<HTMLElement>('[id^="ic-dot-menu-"][id$="-context"]'),
            ).find(element => element.closest(options.folderTreeRowSelector) === sibling)
            const folderId = contextMenuIcon?.id.match(/^ic-dot-menu-(.+)-context$/)?.[1]

            if (folderId) {
              matchingFolderIds.push(folderId)
            }
          }
        }

        sibling = sibling.nextElementSibling
      }

      return matchingFolderIds
    },
    { folderCellTestIdPrefix, folderName, folderTreeRowSelector },
  )
}

function getFolderRowById(articlePage: Page, folderId: string): Locator {
  if (!/^[A-Za-z0-9_-]+$/.test(folderId)) {
    throw new Error(`Unsupported eGain folder ID: ${folderId}`)
  }

  return articlePage
    .locator(`[id="ic-dot-menu-${folderId}-context"]`)
    .locator(`xpath=ancestor::tr[@data-testid="grid-body-row-folders"][1]`)
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

import type { Locator, Page } from 'playwright'
import {
  getArticleFolderLocators,
  getCreateFolderFormLocators,
} from '../../../shared/egain/editor/get-article-editor-locators.ts'

const folderTreeRowSelector = 'tr[data-testid="grid-body-row-folders"]'
const folderCellTestIdPrefix = 'grid-body-cell-folders-'
const activeFolderLoaderSelector = '[data-testid="loader"].loader-container-show:visible'
const folderTreeRetryLimit = 3
const folderUiTimeoutMs = 60000
const folderUiPollIntervalMs = 100
const folderSelectionSettleDelayMs = 500

export type EgainFolderReference = {
  id: string
  name: string
}

export type EgainImportParent = EgainFolderReference & {
  ancestorPath: EgainFolderReference[]
}

type ResolvedFolder = {
  folder: EgainFolderReference
  row: Locator
}

type FolderTreeEntry = EgainFolderReference & {
  level: number
  parentId?: string
  selected: boolean
}

class FolderTreeChangedError extends Error {}

class FolderTreeStructureError extends Error {}

/**
 * Returns the selected eGain folder and its visible ancestor path when an
 * ArticleFlow import starts.
 */
export async function getSelectedFolderReference(articlePage: Page): Promise<EgainImportParent> {
  await waitForFolderUiReady(articlePage)

  const entries = await getFolderTreeEntries(articlePage)
  const selectedEntries = entries.filter(entry => entry.selected)

  if (selectedEntries.length !== 1) {
    throw new Error(`Expected one selected eGain folder, but found ${selectedEntries.length}.`)
  }

  const selectedFolder = selectedEntries[0]
  const entriesById = new Map(entries.map(entry => [entry.id, entry]))
  const ancestorPath: EgainFolderReference[] = []
  let parentId = selectedFolder.parentId

  while (parentId) {
    const parent = entriesById.get(parentId)

    if (!parent) {
      throw new Error(`Could not determine the ancestor path for folder "${selectedFolder.name}".`)
    }

    ancestorPath.unshift(toFolderReference(parent))
    parentId = parent.parentId
  }

  return { ...toFolderReference(selectedFolder), ancestorPath }
}

/**
 * Recreates a folder path beneath the import parent. Existing direct children
 * are reused and missing children are created through the parent context menu.
 */
export async function ensureFolderPath(
  articlePage: Page,
  importParent: EgainImportParent,
  folderPath: string[],
): Promise<boolean> {
  let createdFinalFolder = false

  for (const [index, folderName] of folderPath.entries()) {
    const parentPath = folderPath.slice(0, index)
    const existingChild = await resolveDirectChild(articlePage, importParent, parentPath, folderName)

    if (existingChild) {
      continue
    }

    await createChildFolder(articlePage, importParent, parentPath, folderName)

    if (index === folderPath.length - 1) {
      createdFinalFolder = true
    }
  }

  return createdFinalFolder
}

/**
 * Resolves and selects one existing folder path beneath the import parent.
 */
export async function selectFolderPath(
  articlePage: Page,
  importParent: EgainImportParent,
  folderPath: string[],
): Promise<void> {
  await retryFolderTreeOperation(articlePage, `select folder path "${formatFolderPath(folderPath)}"`, async () => {
    const destination = await resolveFolderPathOnce(articlePage, importParent, folderPath)

    await selectResolvedFolder(articlePage, destination)
  })
}

async function resolveDirectChild(
  articlePage: Page,
  importParent: EgainImportParent,
  parentPath: string[],
  folderName: string,
): Promise<EgainFolderReference | null> {
  return retryFolderTreeOperation(
    articlePage,
    `resolve folder "${folderName}" under "${formatFolderPath(parentPath, importParent.name)}"`,
    async () => {
      const parent = await resolveFolderPathOnce(articlePage, importParent, parentPath)
      const expandedParent = await expandResolvedFolder(articlePage, parent)

      return findDirectChildFolder(articlePage, expandedParent.folder.id, folderName)
    },
  )
}

async function resolveFolderPathOnce(
  articlePage: Page,
  importParent: EgainImportParent,
  folderPath: string[],
): Promise<ResolvedFolder> {
  let current = await resolveImportParentOnce(articlePage, importParent)

  for (const folderName of folderPath) {
    current = await expandResolvedFolder(articlePage, current)

    const child = await findDirectChildFolder(articlePage, current.folder.id, folderName)

    if (!child) {
      throw new FolderTreeChangedError(`Could not find folder "${folderName}" directly under "${current.folder.name}".`)
    }

    current = await resolveVisibleFolder(articlePage, child)
  }

  return current
}

async function resolveImportParentOnce(articlePage: Page, importParent: EgainImportParent): Promise<ResolvedFolder> {
  const importPath = [...importParent.ancestorPath, toFolderReference(importParent)]
  const [topLevelFolder, ...nestedFolders] = importPath

  if (!topLevelFolder) {
    throw new FolderTreeStructureError('The selected eGain import parent has no resolvable folder path.')
  }

  let current = await resolveVisibleFolder(articlePage, topLevelFolder)

  for (const expectedFolder of nestedFolders) {
    current = await expandResolvedFolder(articlePage, current)

    const directChildren = await getDirectChildFolderReferences(articlePage, current.folder.id)
    const matchingFolder = directChildren.find(folder => folder.id === expectedFolder.id)

    if (!matchingFolder) {
      throw new FolderTreeChangedError(`Folder "${expectedFolder.name}" disappeared while reopening the import parent.`)
    }

    current = await resolveVisibleFolder(articlePage, matchingFolder)
  }

  return current
}

async function createChildFolder(
  articlePage: Page,
  importParent: EgainImportParent,
  parentPath: string[],
  folderName: string,
): Promise<void> {
  const selectedParent = await openCreateFolderForm(articlePage, importParent, parentPath)
  const { backButton, heading, nameInput, saveButton } = getCreateFolderFormLocators(articlePage)

  await requireUniqueLocator(heading, 'Create Folder heading')

  if (getFolderIdFromUrl(articlePage.url()) !== selectedParent.id || !isCreateFolderUrl(articlePage.url())) {
    throw new Error(`The Create Folder form did not open under "${selectedParent.name}".`)
  }

  await requireUniqueLocator(nameInput, 'Create Folder name input')
  await nameInput.fill(folderName)
  await requireUniqueLocator(saveButton, 'Create Folder Save button')
  await saveButton.click()

  await requireUniqueLocator(backButton, 'Create Folder Back button')
  await backButton.click()
  await heading.waitFor({ state: 'hidden' })
  await articlePage.getByRole('heading', { exact: true, name: 'Folders' }).waitFor({ state: 'visible' })

  await waitForCreatedFolder(articlePage, importParent, parentPath, folderName)
  await selectFolderPath(articlePage, importParent, [...parentPath, folderName])
}

async function openCreateFolderForm(
  articlePage: Page,
  importParent: EgainImportParent,
  parentPath: string[],
): Promise<EgainFolderReference> {
  return retryFolderTreeOperation(
    articlePage,
    `open Create Folder under "${formatFolderPath(parentPath, importParent.name)}"`,
    async () => {
      const parent = await resolveFolderPathOnce(articlePage, importParent, parentPath)
      const freshParent = await resolveVisibleFolder(articlePage, parent.folder)
      const { addFolderMenuItem, contextMenuButton } = getArticleFolderLocators(
        freshParent.row,
        freshParent.folder.name,
      )

      if ((await contextMenuButton.count()) !== 1) {
        throw new FolderTreeChangedError(`The context menu for "${freshParent.folder.name}" disappeared.`)
      }

      if (!(await addFolderMenuItem.isVisible())) {
        await contextMenuButton.click({ timeout: folderUiTimeoutMs })
      }

      await waitForFolderMenuItem(articlePage, freshParent.folder, addFolderMenuItem)
      await addFolderMenuItem.click({ timeout: folderUiTimeoutMs })

      return freshParent.folder
    },
  )
}

async function waitForFolderMenuItem(
  articlePage: Page,
  parentFolder: EgainFolderReference,
  menuItem: Locator,
): Promise<void> {
  const deadline = Date.now() + folderUiTimeoutMs

  while (Date.now() < deadline) {
    if ((await getFolderRowById(articlePage, parentFolder.id).count()) === 0) {
      throw new FolderTreeChangedError(`Folder "${parentFolder.name}" disappeared while opening its context menu.`)
    }

    if (await menuItem.isVisible()) {
      return
    }

    await articlePage.waitForTimeout(folderUiPollIntervalMs)
  }

  throw new FolderTreeChangedError(`The Add action for folder "${parentFolder.name}" did not appear.`)
}

async function waitForCreatedFolder(
  articlePage: Page,
  importParent: EgainImportParent,
  parentPath: string[],
  folderName: string,
): Promise<void> {
  const deadline = Date.now() + folderUiTimeoutMs

  while (Date.now() < deadline) {
    const createdFolder = await resolveDirectChild(articlePage, importParent, parentPath, folderName)

    if (createdFolder) {
      return
    }

    await articlePage.waitForTimeout(folderUiPollIntervalMs)
  }

  throw new Error(`eGain did not display the newly created folder "${folderName}".`)
}

async function selectResolvedFolder(articlePage: Page, destination: ResolvedFolder): Promise<void> {
  await waitForFolderUiReady(articlePage)

  const freshDestination = await resolveVisibleFolder(articlePage, destination.folder)
  const { cell } = getArticleFolderLocators(freshDestination.row, freshDestination.folder.name)

  if ((await cell.count()) !== 1) {
    throw new FolderTreeChangedError(`Folder "${freshDestination.folder.name}" disappeared before selection.`)
  }

  await cell.click({ timeout: folderUiTimeoutMs })
  await waitForFolderSelection(articlePage, freshDestination.folder)
  await articlePage.waitForTimeout(folderSelectionSettleDelayMs)
  await waitForFolderUiReady(articlePage)
}

async function waitForFolderSelection(articlePage: Page, expectedFolder: EgainFolderReference): Promise<void> {
  const deadline = Date.now() + folderUiTimeoutMs

  while (Date.now() < deadline) {
    if (await isFolderSelectionComplete(articlePage, expectedFolder.id)) {
      await waitForFolderUiReady(articlePage)

      if (await isFolderSelectionComplete(articlePage, expectedFolder.id)) {
        return
      }
    }

    await articlePage.waitForTimeout(folderUiPollIntervalMs)
  }

  throw new FolderTreeChangedError(`eGain did not select folder "${expectedFolder.name}".`)
}

async function isFolderSelectionComplete(articlePage: Page, folderId: string): Promise<boolean> {
  if (getFolderIdFromUrl(articlePage.url()) !== folderId) {
    return false
  }

  const selectedEntries = (await getFolderTreeEntries(articlePage)).filter(entry => entry.selected)

  return selectedEntries.length === 1 && selectedEntries[0].id === folderId
}

async function expandResolvedFolder(articlePage: Page, folder: ResolvedFolder): Promise<ResolvedFolder> {
  await waitForFolderUiReady(articlePage)

  const current = await resolveVisibleFolder(articlePage, folder.folder)
  const { collapseButton, expandButton } = getArticleFolderLocators(current.row, current.folder.name)
  const collapseButtonCount = await collapseButton.count()
  const expandButtonCount = await expandButton.count()

  if (collapseButtonCount > 1 || expandButtonCount > 1) {
    throw new FolderTreeStructureError(`Expected one hierarchy control for folder "${current.folder.name}".`)
  }

  if (await collapseButton.isVisible()) {
    if ((await getDirectChildFolderReferences(articlePage, current.folder.id)).length === 0) {
      throw new FolderTreeChangedError(`Folder "${current.folder.name}" lost its visible child rows.`)
    }

    return current
  }

  if (!(await expandButton.isVisible())) {
    return current
  }

  await expandButton.click({ timeout: folderUiTimeoutMs })
  await waitForFolderExpansion(articlePage, current.folder)

  return resolveVisibleFolder(articlePage, current.folder)
}

async function waitForFolderExpansion(articlePage: Page, folder: EgainFolderReference): Promise<void> {
  const deadline = Date.now() + folderUiTimeoutMs

  while (Date.now() < deadline) {
    await waitForFolderUiReady(articlePage)

    const row = getFolderRowById(articlePage, folder.id)

    if ((await row.count()) !== 1) {
      throw new FolderTreeChangedError(`Folder "${folder.name}" disappeared while it was expanding.`)
    }

    const { collapseButton } = getArticleFolderLocators(row, folder.name)

    if (
      (await collapseButton.isVisible()) &&
      (await getDirectChildFolderReferences(articlePage, folder.id)).length > 0
    ) {
      return
    }

    await articlePage.waitForTimeout(folderUiPollIntervalMs)
  }

  throw new FolderTreeChangedError(`Folder "${folder.name}" did not finish expanding.`)
}

async function resolveVisibleFolder(articlePage: Page, folder: EgainFolderReference): Promise<ResolvedFolder> {
  const row = getFolderRowById(articlePage, folder.id)
  const rowCount = await row.count()

  if (rowCount === 0) {
    throw new FolderTreeChangedError(`Folder "${folder.name}" is no longer visible in the eGain tree.`)
  }

  if (rowCount !== 1) {
    throw new FolderTreeStructureError(`Expected one folder "${folder.name}", but found ${rowCount}.`)
  }

  if (!(await row.isVisible())) {
    throw new FolderTreeChangedError(`Folder "${folder.name}" is currently hidden in the eGain tree.`)
  }

  return { folder, row }
}

async function findDirectChildFolder(
  articlePage: Page,
  parentId: string,
  folderName: string,
): Promise<EgainFolderReference | null> {
  const matchingFolders = (await getDirectChildFolderReferences(articlePage, parentId)).filter(
    folder => folder.name === folderName,
  )

  if (matchingFolders.length > 1) {
    throw new FolderTreeStructureError(`Found multiple folders named "${folderName}" under the same eGain parent.`)
  }

  return matchingFolders[0] ?? null
}

async function getDirectChildFolderReferences(articlePage: Page, parentId: string): Promise<EgainFolderReference[]> {
  return (await getFolderTreeEntries(articlePage)).filter(entry => entry.parentId === parentId).map(toFolderReference)
}

async function getFolderTreeEntries(articlePage: Page): Promise<FolderTreeEntry[]> {
  return articlePage.locator(folderTreeRowSelector).evaluateAll(
    (rows, options) => {
      const entries: FolderTreeEntry[] = []
      const folderIdsByLevel: string[] = []

      rows.forEach(row => {
        const levelMatch = row.className.match(/\blevel-(\d+)\b/)

        if (!levelMatch) {
          return
        }

        const belongsToRow = (element: Element) => element.closest(options.folderTreeRowSelector) === row
        const folderCell = Array.from(
          row.querySelectorAll<HTMLElement>(`[data-testid^="${options.folderCellTestIdPrefix}"]`),
        ).find(belongsToRow)
        const contextMenuIcon = Array.from(
          row.querySelectorAll<HTMLElement>('[id^="ic-dot-menu-"][id$="-context"]'),
        ).find(belongsToRow)
        const name = folderCell?.dataset.testid?.slice(options.folderCellTestIdPrefix.length)
        const id = contextMenuIcon?.id.match(/^ic-dot-menu-(.+)-context$/)?.[1]

        if (!id || !name) {
          return
        }

        const level = Number(levelMatch[1])

        entries.push({
          id,
          level,
          name,
          parentId: level > 0 ? folderIdsByLevel[level - 1] : undefined,
          selected: row.classList.contains('selected-table-row'),
        })

        folderIdsByLevel[level] = id
        folderIdsByLevel.length = level + 1
      })

      return entries
    },
    { folderCellTestIdPrefix, folderTreeRowSelector },
  )
}

async function retryFolderTreeOperation<T>(
  articlePage: Page,
  description: string,
  operation: () => Promise<T>,
): Promise<T> {
  let lastError: unknown

  for (let attempt = 1; attempt <= folderTreeRetryLimit; attempt += 1) {
    try {
      await waitForFolderUiReady(articlePage)

      return await operation()
    } catch (error) {
      if (error instanceof FolderTreeStructureError || !isRetryableFolderTreeError(error)) {
        throw error
      }

      lastError = error

      if (attempt < folderTreeRetryLimit) {
        await articlePage.waitForTimeout(folderUiPollIntervalMs)
      }
    }
  }

  const reason = lastError instanceof Error ? lastError.message : String(lastError)

  throw new Error(
    `Could not ${description} after ${folderTreeRetryLimit} attempts because eGain kept rerendering the folder tree. Last error: ${reason}`,
  )
}

function isRetryableFolderTreeError(error: unknown): boolean {
  if (error instanceof FolderTreeChangedError) {
    return true
  }

  if (!(error instanceof Error)) {
    return false
  }

  return /detached from the DOM|intercepts pointer events|locator\.(?:click|evaluate)|strict mode violation/i.test(
    error.message,
  )
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

function getFolderRowById(articlePage: Page, folderId: string): Locator {
  if (!/^[A-Za-z0-9_-]+$/.test(folderId)) {
    throw new FolderTreeStructureError(`Unsupported eGain folder ID: ${folderId}`)
  }

  return articlePage
    .locator(`[id="ic-dot-menu-${folderId}-context"]`)
    .locator('xpath=ancestor::tr[@data-testid="grid-body-row-folders"][1]')
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

function toFolderReference(folder: EgainFolderReference): EgainFolderReference {
  return { id: folder.id, name: folder.name }
}

function formatFolderPath(folderPath: string[], rootName?: string): string {
  return [rootName, ...folderPath].filter(Boolean).join(' > ')
}

async function requireUniqueLocator(locator: Locator, description: string): Promise<void> {
  let matchCount = await locator.count()

  if (matchCount === 0) {
    await locator.waitFor({ state: 'visible' })
    matchCount = await locator.count()
  }

  if (matchCount !== 1) {
    throw new Error(`Expected one ${description}, but found ${matchCount}.`)
  }
}

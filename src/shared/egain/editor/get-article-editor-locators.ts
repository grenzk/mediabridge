import type { Locator, Page } from 'playwright'

export type ArticleEditorLocators = {
  articleTitleInput: Locator
  sourceEditor: Locator
  editorBody: Locator
  sourceButton: Locator
  linkArticleButton: Locator
  selectLinkArticleModal: Locator
}

export type ArticlePageActionLocators = {
  createArticleButton: Locator
  saveArticleButton: Locator
  checkInArticleButton: Locator
  publishArticleButton: Locator
}

export type ArticleListLocators = {
  articleIds: Locator
  currentPageInput: Locator
  firstPageButton: Locator
  nextPageButton: Locator
  titleLabels: Locator
  totalPagesLabel: Locator
}

export type ArticleFolderLocators = {
  addFolderMenuItem: Locator
  cell: Locator
  collapseButton: Locator
  contextMenuButton: Locator
  expandButton: Locator
}

export type CreateFolderFormLocators = {
  backButton: Locator
  heading: Locator
  nameInput: Locator
  saveButton: Locator
}

export type NewArticleDialogLocators = {
  dialog: Locator
  titleInput: Locator
  folderPathInput: Locator
  doneButton: Locator
}

export type PublishSummaryDialogLocators = {
  dialog: Locator
  doneButton: Locator
}

/**
 * Returns the shared controls exposed by the eGain article editor.
 */
export function getArticleEditorLocators(articlePage: Page): ArticleEditorLocators {
  return {
    articleTitleInput: articlePage.getByTestId('text-input-field-article-content-article-name'),

    sourceEditor: articlePage.getByRole('textbox', { name: 'Editor' }),

    editorBody: articlePage.frameLocator('iframe[title^="Editor"]').locator('body[contenteditable="true"]'),

    sourceButton: articlePage.getByTestId('button_cke_source'),

    linkArticleButton: articlePage.locator('.cke_button__linkarticle_icon'),

    selectLinkArticleModal: articlePage.locator('div[data-testid="pop-up-window-select-link-article"]'),
  }
}

/**
 * Returns the page-level actions used by eGain article workflows.
 */
export function getArticlePageActionLocators(articlePage: Page): ArticlePageActionLocators {
  return {
    createArticleButton: articlePage.getByTestId('button-articles-add'),

    saveArticleButton: articlePage.getByTestId('button-article-content-save'),

    checkInArticleButton: articlePage.getByTestId('button-article-content-check-in'),

    publishArticleButton: articlePage.getByTestId('button-article-content-publish'),
  }
}

/**
 * Returns the article-list controls used to inspect a selected eGain folder.
 */
export function getArticleListLocators(articlePage: Page): ArticleListLocators {
  return {
    articleIds: articlePage.locator('[data-testid^="label-articles-alternate-id-"]'),

    currentPageInput: articlePage.getByTestId('text-input-field-articles-current-page'),

    firstPageButton: articlePage.getByTestId('button-articles-first-page'),

    nextPageButton: articlePage.getByTestId('button-articles-next-page'),

    titleLabels: articlePage.locator('[data-testid^="label-articles-article-name-"]'),

    totalPagesLabel: articlePage.getByTestId('label-articles-total-pages'),
  }
}

/**
 * Returns the controls used to create an article in the selected eGain folder.
 */
export function getNewArticleDialogLocators(articlePage: Page): NewArticleDialogLocators {
  const dialog = articlePage.getByRole('dialog').filter({
    has: articlePage.getByTestId('pop-up-window-button-new-article-done'),
  })

  return {
    dialog,

    titleInput: dialog.getByTestId('text-input-field_1_create-or-edit_kbarticle_Title'),

    folderPathInput: dialog.getByTestId('text-input-field_0_create-or-edit_kbarticle_Folder-Path'),

    doneButton: dialog.getByTestId('pop-up-window-button-new-article-done'),
  }
}

/**
 * Returns the controls used to confirm an article publication.
 */
export function getPublishSummaryDialogLocators(articlePage: Page): PublishSummaryDialogLocators {
  const dialog = articlePage.getByRole('dialog').filter({
    has: articlePage.getByText('Enter Summary', { exact: true }),
  })

  return {
    dialog,

    doneButton: dialog.getByRole('button', { exact: true, name: 'Done' }),
  }
}

/**
 * Returns the controls for an exact folder name within a page or folder row.
 */
export function getArticleFolderLocators(scope: Page | Locator, folderName: string): ArticleFolderLocators {
  const contextMenuButton = scope.getByTestId(`dropdown-toggle-folders-${folderName}`)

  return {
    addFolderMenuItem: contextMenuButton.getByRole('menuitem', { exact: true, name: 'Add' }),

    cell: scope.getByTestId(`grid-body-cell-folders-${folderName}`),

    collapseButton: scope.getByTestId(`button-folders-collapse-${folderName}`),

    contextMenuButton,

    expandButton: scope.getByTestId(`button-folders-expand-${folderName}`),
  }
}

/**
 * Returns the controls used by eGain's full-page folder creation form.
 */
export function getCreateFolderFormLocators(articlePage: Page): CreateFolderFormLocators {
  return {
    backButton: articlePage.getByTestId('button-create-or-edit-kbfolder-back'),

    heading: articlePage.getByRole('heading', { exact: true, name: 'Create Folder' }),

    nameInput: articlePage.getByTestId('text-input-field_1_create-or-edit_kbfolder_Name'),

    saveButton: articlePage.getByTestId('button-create-or-edit-kbfolder-save'),
  }
}

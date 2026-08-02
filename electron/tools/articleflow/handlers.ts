import { BrowserWindow, dialog, ipcMain } from 'electron'
import type { IpcMainInvokeEvent, OpenDialogOptions } from 'electron'
import { basename } from 'node:path'
import { connectToBrowser } from '../../../src/shared/browser/connect-to-browser.ts'
import { createArticleImportPlan } from '../../../src/tools/articleflow/automation/create-import-plan.ts'
import { findFolderWorkspacePage } from '../../../src/tools/articleflow/automation/find-folder-workspace-page.ts'
import {
  runArticleImport,
  type ArticleCompletionAction,
  type ArticleImportProgress,
} from '../../../src/tools/articleflow/automation/run-article-import.ts'
import { getErrorDetail, getErrorMessage } from '../../platform/error-format.ts'

type AddLog = (level: 'info' | 'success' | 'error', scope: string, message: string, detail?: string) => void

type BrowserService = {
  getCdpUrl: () => string
}

type ArticleFlowHandlerDependencies = {
  addLog: AddLog
  browserService: BrowserService
}

const selectDirectoryOptions: OpenDialogOptions = {
  buttonLabel: 'Select folder',
  properties: ['openDirectory'],
  title: 'Select ArticleFlow source folder',
}

export function registerArticleFlowHandlers({ addLog, browserService }: ArticleFlowHandlerDependencies) {
  ipcMain.handle('articleflow:select-root', async (event: IpcMainInvokeEvent) => {
    try {
      const parentWindow = BrowserWindow.fromWebContents(event.sender)
      const selection = parentWindow
        ? await dialog.showOpenDialog(parentWindow, selectDirectoryOptions)
        : await dialog.showOpenDialog(selectDirectoryOptions)

      if (selection.canceled || !selection.filePaths[0]) {
        return { canceled: true, ok: true }
      }

      const plan = await createArticleImportPlan(selection.filePaths[0])

      addLog(
        'success',
        'ArticleFlow',
        `Prepared ${formatCount(plan.articles.length, 'article')} across ${formatCount(plan.folderPaths.length, 'folder')}.`,
        plan.rootPath,
      )

      return { canceled: false, ok: true, plan }
    } catch (error) {
      addLog('error', 'ArticleFlow', getErrorMessage(error), getErrorDetail(error))
      throw error
    }
  })

  ipcMain.handle(
    'articleflow:run',
    async (_event: IpcMainInvokeEvent, rootPath: string, completionAction: ArticleCompletionAction) => {
      try {
        validateRunRequest(rootPath, completionAction)

        const plan = await createArticleImportPlan(rootPath)

        addLog(
          'info',
          'ArticleFlow',
          `Importing ${formatCount(plan.articles.length, 'article')} from ${basename(plan.rootPath)}.`,
          `Completion action: ${completionAction}`,
        )

        const session = await connectToBrowser(browserService.getCdpUrl())
        const folderPage = findFolderWorkspacePage(session.pages)
        const result = await runArticleImport(folderPage, plan, completionAction, {
          onProgress: progress => logProgress(addLog, progress, completionAction),
        })
        const failedArticleCount = result.failedArticles.length
        const completedArticleCount = result.completedArticles.length
        const detail = result.failedArticles
          .map(({ article, message }) => `${article.relativeSourcePath}: ${message}`)
          .join('\n')

        if (failedArticleCount > 0) {
          addLog(
            'error',
            'ArticleFlow',
            `${formatCount(completedArticleCount, 'article')} completed; ${formatCount(failedArticleCount, 'article')} failed.`,
            detail,
          )
        } else {
          addLog(
            'success',
            'ArticleFlow',
            `${formatCount(completedArticleCount, 'article')} ${formatCompletionResult(completionAction)}.`,
          )
        }

        return {
          completedArticleCount,
          createdFolderCount: result.createdFolderPaths.length,
          existingFolderCount: result.existingFolderPaths.length,
          failedArticles: result.failedArticles.map(({ article, message }) => ({
            message,
            relativeSourcePath: article.relativeSourcePath,
          })),
          ok: failedArticleCount === 0,
        }
      } catch (error) {
        addLog('error', 'ArticleFlow', getErrorMessage(error), getErrorDetail(error))
        throw error
      }
    },
  )
}

function validateRunRequest(rootPath: string, completionAction: ArticleCompletionAction) {
  if (typeof rootPath !== 'string' || rootPath.trim().length === 0) {
    throw new Error('Select an ArticleFlow source folder before running the import.')
  }

  if (completionAction !== 'check-in' && completionAction !== 'publish') {
    throw new Error(`Unsupported ArticleFlow completion action: ${completionAction}`)
  }
}

function logProgress(addLog: AddLog, progress: ArticleImportProgress, completionAction: ArticleCompletionAction) {
  if (progress.type === 'folder') {
    if (progress.status === 'created') {
      addLog('success', 'ArticleFlow', `Created folder ${progress.folderPath.join(' > ')}.`)
    }

    return
  }

  if (progress.status === 'started') {
    addLog('info', 'ArticleFlow', `Importing ${progress.article.title}.`, progress.article.relativeSourcePath)
    return
  }

  if (progress.status === 'completed') {
    addLog(
      'success',
      'ArticleFlow',
      `${progress.article.title} ${formatCompletionResult(completionAction)}.`,
      progress.article.relativeSourcePath,
    )
    return
  }

  if (progress.status === 'failed') {
    addLog(
      'error',
      'ArticleFlow',
      `${progress.article.title} failed.`,
      `${progress.article.relativeSourcePath}: ${progress.message}`,
    )
  }
}

function formatCompletionResult(completionAction: ArticleCompletionAction) {
  return completionAction === 'check-in' ? 'checked in' : 'published'
}

function formatCount(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

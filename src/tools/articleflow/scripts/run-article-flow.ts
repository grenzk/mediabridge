import 'dotenv/config'
import { parseArgs } from 'node:util'
import type { Page } from 'playwright'
import { connectToBrowser } from '../../../shared/browser/connect-to-browser.ts'
import { getDefaultCdpUrl } from '../../../shared/config/runtime.ts'
import { createArticleImportPlan } from '../automation/create-import-plan.ts'
import {
  runArticleImport,
  type ArticleCompletionAction,
  type ArticleImportResult,
} from '../automation/run-article-import.ts'

const exitCode = await main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))

  return 1
})

process.exit(exitCode)

async function main() {
  const options = getCommandOptions()

  if (options.help) {
    printHelp()
    return 0
  }

  const plan = await createArticleImportPlan(options.rootPath)

  printImportPlan(plan, options.completionAction)

  if (!options.execute) {
    console.log('\nDry run complete. Add --execute to create these folders and articles in eGain.')
    return 0
  }

  if (plan.folderPaths.length === 0) {
    console.log('\nNo folders were found.')
    return 0
  }

  const { pages } = await connectToBrowser(getDefaultCdpUrl())
  const folderPage = findFolderWorkspacePage(pages)

  console.log(`\nArticleFlow connected to "${await folderPage.title()}" at ${folderPage.url()}.`)

  const result = await runArticleImport(folderPage, plan, options.completionAction)

  printImportResult(result, options.completionAction)

  return result.failedArticles.length === 0 ? 0 : 1
}

function getCommandOptions() {
  const { values } = parseArgs({
    options: {
      action: {
        default: 'check-in',
        short: 'a',
        type: 'string',
      },
      execute: {
        default: false,
        type: 'boolean',
      },
      help: {
        default: false,
        short: 'h',
        type: 'boolean',
      },
      root: {
        default: 'Sample Product',
        short: 'r',
        type: 'string',
      },
    },
    strict: true,
  })

  return {
    completionAction: parseCompletionAction(values.action),
    execute: values.execute,
    help: values.help,
    rootPath: values.root,
  }
}

function parseCompletionAction(value: string): ArticleCompletionAction {
  if (value === 'check-in' || value === 'publish') {
    return value
  }

  throw new Error(`Unsupported completion action: ${value}. Use "check-in" or "publish".`)
}

function findFolderWorkspacePage(pages: Page[]): Page {
  const folderPages = pages.filter(page => isFolderWorkspaceUrl(page.url()))

  if (folderPages.length === 0) {
    const openUrls = pages
      .map(page => page.url())
      .filter(Boolean)
      .join(', ')

    throw new Error(`Could not find an eGain folder page with no article selected. Open tabs: ${openUrls || 'none'}`)
  }

  if (folderPages.length > 1) {
    throw new Error(
      `Found multiple eGain folder pages. Keep only the intended destination open: ${folderPages
        .map(page => page.url())
        .join(', ')}`,
    )
  }

  return folderPages[0]
}

function isFolderWorkspaceUrl(value: string): boolean {
  try {
    const { pathname } = new URL(value)

    return pathname.includes('/system/web/apps/kb/work/') && /\/folder\/[^/]+\/?$/.test(pathname)
  } catch {
    return false
  }
}

function printImportPlan(
  plan: Awaited<ReturnType<typeof createArticleImportPlan>>,
  completionAction: ArticleCompletionAction,
) {
  console.log('ArticleFlow import plan')
  console.log(`Root: ${plan.rootPath}`)
  console.log(`Folders: ${plan.folderPaths.length}`)
  console.log(`Articles: ${plan.articles.length}`)
  console.log(`Ignored: ${plan.ignoredPaths.length}`)

  console.log('\nFolder hierarchy:')
  plan.folderPaths.forEach(folderPath => {
    console.log(`- ${folderPath.join(' > ')}`)
  })

  if (plan.articles.length > 0) {
    console.log('\nArticles:')
  }

  plan.articles.forEach(article => {
    console.log(`- ${article.folderPath.join(' > ')} > ${article.title} [${completionAction}]`)
  })

  if (plan.ignoredPaths.length > 0) {
    console.log('\nIgnored files and directories:')
    plan.ignoredPaths.forEach(path => console.log(`- ${path}`))
  }
}

function printImportResult(result: ArticleImportResult, completionAction: ArticleCompletionAction) {
  console.log(`\n${result.createdFolderPaths.length} folder(s) created.`)
  console.log(`${result.existingFolderPaths.length} folder(s) already existed.`)
  console.log(`\n${result.completedArticles.length} article(s) completed with "${completionAction}".`)

  if (result.failedArticles.length === 0) {
    return
  }

  console.error(`${result.failedArticles.length} article(s) failed:`)
  result.failedArticles.forEach(({ article, message }) => {
    console.error(`- ${article.relativeSourcePath}: ${message}`)
  })
}

function printHelp() {
  console.log(`Usage:
  npm run script:articleflow -- [options]

Options:
  -r, --root <path>       Filesystem taxonomy root (default: "Sample Product")
  -a, --action <action>   Final action: "check-in" or "publish" (default: "check-in")
      --execute           Create the planned folders and articles in eGain
  -h, --help              Show this help

Examples:
  npm run script:articleflow
  npm run script:articleflow -- --root "Sample Product" --action check-in --execute
  npm run script:articleflow -- --root "Sample Product" --action publish --execute`)
}
